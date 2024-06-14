// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Contract} from "./Contract.sol";
import {SocialGraph} from "./social_graph.sol";
import {PoseidonT3} from "../lib/poseidon-solidity/contracts/PoseidonT3.sol";
import {PoseidonT2} from "../lib/poseidon-solidity/contracts/PoseidonT2.sol";
import {ABDKMath64x64} from "../lib/abdk-libraries-solidity/ABDKMath64x64.sol";
import {BinaryIMT, BinaryIMTData} from "../lib/zk-kit.solidity/packages/imt/contracts/BinaryIMT.sol";
import "../../circuits/votePour/contract/votePour/plonk_vk.sol" as voteCircuit;
import "../../circuits/claimPour/contract/claimPour/plonk_vk.sol" as claimCircuit;

contract Voting is SocialGraph {
    Contract worldIDVerificationContract;
    claimCircuit.UltraVerifier claimVerifier;
    voteCircuit.UltraVerifier voteVerifier;

    /// @notice Event for user registration as World ID holder or Candidate
    event UserRegistered(address indexed user, Status status);
    /// @notice Candidate verified event
    event CandidateVerified(address indexed user, Status status);
    /// @notice Event for reward claims
    event RewardClaimed(address indexed user, uint256 reward);
    /// @notice Event for penalising a user
    event Penalised(address indexed candidate);

    /**
     * @notice sets the state contracts used for verification of world ID and zk circuits
     * @param _worldIDVerificationContract - contract address of the world ID verification
     * @param _voteVerifier - contract address of the vote circuit solidity verifier
     * @param _claimVerifier - contract address of the claim circuit solidity verifier
     */
    constructor(Contract _worldIDVerificationContract, address _voteVerifier, address _claimVerifier) {
        // setup worldID verification
        worldIDVerificationContract = _worldIDVerificationContract;
        // setup tree and initialise with default zeros and push init root to history
        BinaryIMT.initWithDefaultZeroes(VotingTree, depth);
        BinaryIMT.initWithDefaultZeroes(RewardsTree, depth);
        voteMerkleRoot.push(VotingTree.root);
        voteVerifier = voteCircuit.UltraVerifier(_voteVerifier);
        claimVerifier = claimCircuit.UltraVerifier(_claimVerifier);
    }

    /**
     * @notice Function to register an account as a World ID holder
     * @param signal - Signal for the World ID
     * @param root - Root of the World ID
     * @param nullifierHash - Nullifier hash of the World ID
     * @param proof - Array of proof elements
     * @param tx_mint -  Mint transaction providing the coin to be minted in the voting merkle tree
     * @dev Will verify the world ID credentials and verify the mint tx was correctly constructed
     *      then will insert the mint tx commitment into the binary IMT and store the new root
     */
    function registerAsWorldIDHolder(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof,
        Mint calldata tx_mint
    ) public {
        // Perform checks to verify World ID
        worldIDVerificationContract.verifyAndExecute(signal, root, nullifierHash, proof);
        require(verifyMint(tx_mint), "Mint did not verify");
        // ensure value of mint is equal to 100
        require(tx_mint.value == 100, "Coin minted with incorrect value != 100");
        // will add commitment to the on-chain tree
        voteMerkleRoot.push(BinaryIMT.insert(VotingTree, tx_mint.commitment));
    }

    /**
     * @notice Function to register an account as a Candidate
     * @param _name Name of the candidate
     * @dev will initialise a new candidate by creating a new Binary IMT candidate tree and new user
     *      in the user map with status Candidate
     */
    function registerAsCandidate(string calldata _name) public {
        require(!users[msg.sender].isRegistered, "msg.sender is already registered");
        require(!candidateTreeNonEmpty[msg.sender], "msg.sender tree already exists");
        BinaryIMT.initWithDefaultZeroes(candidateTrees[msg.sender], depth);
        candidateTreeNonEmpty[msg.sender] = true;
        // add user to user map
        users[msg.sender] = User(id, _name, 0, 0, Status.CANDIDATE, 0, true);
        userAddress[id++] = msg.sender;
        emit UserRegistered(msg.sender, Status.CANDIDATE);
    }

    /**
     * @notice Function to register an account as a Candidate
     * @param tx_mint - mint tx used to signup a user to the vote tree
     */
    function verifyMint(Mint calldata tx_mint) public pure returns (bool) {
        return tx_mint.commitment == PoseidonT3.hash([tx_mint.value, tx_mint.k]);
    }

    /**
     * @notice Function to vote for a candidate
     * @param tx_pour - pour transaction of original coin into 2 new coins in candidate tree and vote tree
     * @param weight - weight to be voted for the candidate
     * @param uid - userID of the candidate
     * @dev will verify the pour transaction provided and if it passes will add the coin commitments to their
     *      respective trees and add the new roots to the root store
     */
    function vote(Pour calldata tx_pour, uint256 weight, uint256 uid) public {
        require(users[userAddress[uid]].status == Status.CANDIDATE, "User voted for not a candidate");
        // check user has v_in + weight <= 10
        require(
            users[userAddress[uid]].v_in + weight <= 1000,
            "Candidate exceeded maximum voting power, try with a lesser weight"
        );
        // verify pour tx
        require(verify_pour(tx_pour, true), "pour tx failed to verify");
        voteNullifiers.push(tx_pour.sn_old);
        voteNullifiersExists[tx_pour.sn_old] = true;
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_pour.cm_1);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        userIDMerkleRoot[userAddress[uid]].push(BinaryIMT.insert(candidateTrees[userAddress[uid]], tx_pour.cm_2));
        users[userAddress[uid]].v_in += weight;
        users[userAddress[uid]].numberOfVotes++;
    }

    /**
     * @notice will verify the pour transaction provided to either vote/claim
     * @param tx_pour - the pour transaction to be verified
     * @param called_by_vote - boolean to check if the calling function is vote = true OR claim = false
     * @return bool - boolean as to whether or not the checks pass
     * @dev will perform the following checks: nullifier has not been shown already, merkle root exists,
     *      finally circuit and zk proof are correct.
     */
    function verify_pour(Pour calldata tx_pour, bool called_by_vote) public view returns (bool) {
        if (voteNullifiersExists[tx_pour.sn_old]) {
            return false;
        } else if (!voteMerkleRootExists[tx_pour.rt]) {
            return false;
        }
        // compute h_sig = poseidon(pk_sig)
        uint256 h_sig = PoseidonT2.hash([uint256(tx_pour.pk_sig)]);

        // Verify pour circuit proof
        bytes32[] memory publicInputs = new bytes32[](7);
        publicInputs[0] = bytes32(tx_pour.rt);
        publicInputs[1] = bytes32(tx_pour.sn_old);
        publicInputs[2] = bytes32(tx_pour.cm_1);
        publicInputs[3] = bytes32(tx_pour.cm_2);
        publicInputs[4] = bytes32(tx_pour.v_pub);
        publicInputs[5] = bytes32(h_sig);
        publicInputs[6] = bytes32(tx_pour.h);

        // TODO: find new way to identify which tx this is
        if (!called_by_vote) {
            return (claimVerifier.verify(tx_pour.proof, publicInputs));
        } else {
            return (voteVerifier.verify(tx_pour.proof, publicInputs));
        }
    }

    function inversePower(uint256 input) public pure returns (uint256) {
        // Represent the percentage as a fixed-point number.
        int128 percentage = ABDKMath64x64.divu(input, 100);

        // Calculate e^(percentage)
        int128 result = ABDKMath64x64.exp(percentage);

        // Multiply by 10^5 to keep 5 decimal places
        result = ABDKMath64x64.mul(result, ABDKMath64x64.fromUInt(10 ** 5));

        // Invert the exponential as required
        result = ABDKMath64x64.div(ABDKMath64x64.fromUInt(10 ** 5), result);

        // Multiply by 10^5 to keep 5 decimal places
        result = ABDKMath64x64.mul(result, ABDKMath64x64.fromUInt(10 ** 5));

        // Convert the fixed-point result to a uint and return it.
        return ABDKMath64x64.toUInt(result);
    }

    function updateStatusVerified(Mint calldata tx_mint) public {
        require(users[msg.sender].isRegistered, "msg.sender not registered");
        require(users[msg.sender].status == Status.CANDIDATE, "msg.sender not candidate");
        require(users[msg.sender].v_in >= x, "v_in lower than threshold to update status");
        require(verifyMint(tx_mint), "mint tx did not verify");
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_mint.commitment);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        users[msg.sender].status = Status.VERIFIED_IDENTITIY;
        uint256 c_epoch = (block.number / 50064) + 1;
        users[msg.sender].epochV = c_epoch;
        rewards_per_epoch[c_epoch].sum += users[msg.sender].v_in;
        emit CandidateVerified(msg.sender, Status.VERIFIED_IDENTITIY);
    }

    function claimRewards(uint256 uid, Pour calldata tx_pour) public {
        //check userID is verified
        require(
            users[userAddress[uid]].status == Status.VERIFIED_IDENTITIY, "user claiming rewards for must be verified"
        );

        //compute current epoch
        uint256 c_epoch = (block.number / 50064) + 1;
        require(
            c_epoch > users[userAddress[uid]].epochV, "user claiming rewards for verified epoch less than current epoch"
        );

        require(verify_pour(tx_pour, false), "pour tx failed to verify");

        userIDNullifiers[userAddress[uid]].push(tx_pour.sn_old);

        sizeOfUserIDNullifiers[userAddress[uid]]++;

        uint256 new_root = BinaryIMT.insert(VotingTree, tx_pour.cm_1);

        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;

        rewardsMerkleRoot.push(BinaryIMT.insert(RewardsTree, tx_pour.cm_2));

        if (sizeOfUserIDNullifiers[userAddress[uid]] == users[userAddress[uid]].numberOfVotes) {
            delete(candidateTrees[userAddress[uid]]);
            candidateTreeNonEmpty[userAddress[uid]] = false;
        }

        uint256 i = users[userAddress[uid]].epochV;
        rewards_per_epoch[i].claimed += users[userAddress[uid]].v_in;
        if (rewards_per_epoch[i].sum == rewards_per_epoch[i].claimed) {
            delete(rewards_per_epoch[i]);
        }
    }

    function penalise() public {
        require(users[msg.sender].isRegistered, "msg.sender not registered");
        require(users[msg.sender].status == Status.CANDIDATE, "msg.sender not candidate");

        delete candidateTrees[msg.sender];
        delete userIDMerkleRoot[msg.sender];

        users[msg.sender].v_in = 0;
        users[msg.sender].numberOfVotes = 0;

        emit Penalised(msg.sender);
    }
}
