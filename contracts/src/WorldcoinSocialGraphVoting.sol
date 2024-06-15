// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {WorldcoinVerifier} from "./WorldcoinVerifier.sol";
import {WorldcoinSocialGraphStorage} from "./WorldcoinSocialGraphStorage.sol";
import {PoseidonT3} from "../lib/poseidon-solidity/contracts/PoseidonT3.sol";
import {PoseidonT2} from "../lib/poseidon-solidity/contracts/PoseidonT2.sol";
import {ABDKMath64x64} from "../lib/abdk-libraries-solidity/ABDKMath64x64.sol";
import {BinaryIMT, BinaryIMTData} from "../lib/zk-kit.solidity/packages/imt/contracts/BinaryIMT.sol";
import "../../circuits/votePour/contract/votePour/plonk_vk.sol" as voteCircuit;
import "../../circuits/claimPour/contract/claimPour/plonk_vk.sol" as claimCircuit;

contract WorldcoinSocialGraphVoting is WorldcoinSocialGraphStorage {
    WorldcoinVerifier worldIDVerificationContract;
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
    constructor(WorldcoinVerifier _worldcoinVerifier, address _voteVerifier, address _claimVerifier) {
        // setup worldID verification
        worldIDVerificationContract = _worldcoinVerifier;
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
        require(users[msg.sender].status == Status.UNREGISTERED, "msg.sender is already registered");
        require(!candidateTreeNonEmpty[msg.sender], "msg.sender tree already exists");
        BinaryIMT.initWithDefaultZeroes(candidateTrees[msg.sender], depth);
        candidateTreeNonEmpty[msg.sender] = true;
        // add user to user map
        users[msg.sender] = User(_name, 0, 0, Status.CANDIDATE, 0, true);
        emit UserRegistered(msg.sender, Status.CANDIDATE);
    }

    /**
     * @notice Function to verify a Mint transaction
     * @param tx_mint - mint tx used to signup a user to the vote tree
     */
    function verifyMint(Mint calldata tx_mint) public pure returns (bool) {
        return tx_mint.commitment == PoseidonT3.hash([tx_mint.value, tx_mint.k]);
    }

    /**
     * @notice Function to vote for a candidate
     * @param tx_pour - pour transaction of original coin into 2 new coins in candidate tree and vote tree
     * @param weight - weight to be voted for the candidate
     * @param _user - address of the candidate
     * @dev will verify the pour transaction provided and if it passes will add the coin commitments to their
     *      respective trees and add the new roots to the root store
     */
    function recommendCandidate(Pour calldata tx_pour, uint256 weight, address _user) public {
        require(users[_user].status == Status.CANDIDATE, "User voted for not a candidate");
        // check user has v_in + weight <= 10
        require(users[_user].v_in + weight <= 1000, "Candidate exceeded maximum voting power, try with a lesser weight");
        // verify pour tx
        require(verifyPour(tx_pour, true), "pour tx failed to verify");
        voteNullifiers.push(tx_pour.sn_old);
        voteNullifiersExists[tx_pour.sn_old] = true;
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_pour.cm_1);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        userIDMerkleRoot[_user].push(BinaryIMT.insert(candidateTrees[_user], tx_pour.cm_2));
        users[_user].v_in += weight;
        users[_user].numberOfVotes++;
    }

    /**
     * @notice will verify the pour transaction provided to either vote/claim
     * @param tx_pour - the pour transaction to be verified
     * @param called_by_vote - boolean to check if the calling function is vote = true OR claim = false
     * @return bool - boolean as to whether or not the checks pass
     * @dev will perform the following checks: nullifier has not been shown already, merkle root exists,
     *      finally circuit and zk proof are correct.
     */
    function verifyPour(Pour calldata tx_pour, bool called_by_vote) public view returns (bool) {
        if (voteNullifiersExists[tx_pour.sn_old] || !voteMerkleRootExists[tx_pour.rt]) {
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

        if (!called_by_vote) {
            return (claimVerifier.verify(tx_pour.proof, publicInputs));
        } else {
            return (voteVerifier.verify(tx_pour.proof, publicInputs));
        }
    }

    /**
     * @notice Computes the inverse of the exponential function for a given input.
     * @param input - The value for which the inverse exponential is to be calculated, represented as an integer percentage.
     * @return The result of the inverse exponential calculation, scaled to keep 5 decimal places.
     * @dev Use the ABDKMath64x64 library to perform fixed-point arithmetic operations. The input is first converted to a
     *      fixed-point percentage. The exponential of this percentage is calculated and then inverted.
     */
    function inversePower(uint256 input) public pure returns (uint256) {
        // Represent the percentage as a fixed-point number
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

    /**
     * @notice will update the user to verified and allow them to vote on future world ID members
     * @param tx_mint - mint transaction of the candidate in the voting tree
     * @dev will verify the user is eligible for this and if so will insert the tx commitment to the vote tree
     *      and change the status from Candidate to verified identity
     */
    function updateStatusVerified(Mint calldata tx_mint) public {
        // msg.sender should be a candidate
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

    /**
     * @notice will provide the user with rewards and a portion of their voting power back
     * @param _user - candidate user address that got updated to verified
     * @param tx_pour - pour transaction minting 2 coins in the rewards & vote tree
     * @dev will verify that the _user corresponds to a verified identity and if so will mint a coin in
     *      the rewards tree and the voting tree of value equal porportional to the weight voted with
     */
    function claimRewards(address _user, Pour calldata tx_pour) public {
        //check user is verified
        require(users[_user].status == Status.VERIFIED_IDENTITIY, "user claiming rewards for must be verified");

        //compute current epoch
        uint256 c_epoch = (block.number / 50064) + 1;
        uint256 epoch = users[_user].epochV;
        require(c_epoch > epoch, "user claiming rewards for verified epoch less than current epoch");
        //check if public parameters are valid
        require(tx_pour.v_pub == rewards_per_epoch[epoch].sum);
        require(verifyPour(tx_pour, false), "pour tx failed to verify");

        userIDNullifiers[_user].push(tx_pour.sn_old);

        sizeOfUserIDNullifiers[_user]++;

        uint256 new_root = BinaryIMT.insert(VotingTree, tx_pour.cm_1);

        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;

        rewardsMerkleRoot.push(BinaryIMT.insert(RewardsTree, tx_pour.cm_2));

        if (sizeOfUserIDNullifiers[_user] == users[_user].numberOfVotes) {
            delete(candidateTrees[_user]);
            candidateTreeNonEmpty[_user] = false;
        }

        uint256 i = users[_user].epochV;
        rewards_per_epoch[i].claimed += users[_user].v_in;
        if (rewards_per_epoch[i].sum == rewards_per_epoch[i].claimed) {
            delete(rewards_per_epoch[i]);
        }
    }

    /**
     * @notice the penalise function that will delete the candidate tree in order to punish malicious voters
     */
    function penalise() public {
        require(users[msg.sender].status == Status.CANDIDATE, "msg.sender not candidate");

        delete candidateTrees[msg.sender];
        delete userIDMerkleRoot[msg.sender];

        users[msg.sender].v_in = 0;
        users[msg.sender].numberOfVotes = 0;

        emit Penalised(msg.sender);
    }
}