// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { WorldcoinSocialGraphStorage } from "./WorldcoinSocialGraphStorage.sol";
import { PoseidonT4 } from "../lib/poseidon-solidity/contracts/PoseidonT4.sol";
import { PoseidonT2 } from "../lib/poseidon-solidity/contracts/PoseidonT2.sol";
import { ABDKMath64x64 } from "../lib/abdk-libraries-solidity/ABDKMath64x64.sol";
import { BinaryIMT, BinaryIMTData } from "../lib/zk-kit.solidity/packages/imt/contracts/BinaryIMT.sol";
import { UltraVerifier as ClaimUltraVerifier } from "./claim_plonk_vk.sol";
import { UltraVerifier as VoteUltraVerifier } from "./vote_plonk_vk.sol";
import { IWorldcoinVerifier } from "./interfaces/IWorldcoinVerifier.sol";
import { SignatureChecker } from "../lib/openzeppelin-contracts/contracts/utils/cryptography/SignatureChecker.sol";

contract WorldcoinSocialGraphVoting is WorldcoinSocialGraphStorage {
    IWorldcoinVerifier public immutable worldIDVerificationContract;
    ClaimUltraVerifier immutable claimVerifier;
    VoteUltraVerifier immutable voteVerifier;

    /// @notice Event for registering a worldID
    event WorldIDRegistered();
    /// @notice Event for user registration as World ID holder or Candidate
    event UserRegistered(address indexed user, Status status);
    /// @notice Candidate verified event
    event CandidateVerified(address indexed user, Status status);
    /// @notice Event for reward claims
    event RewardClaimed(address indexed user);
    /// @notice Event for penalising a user
    event Penalised(address indexed candidate);
    /// @notice Event for recommending a candidate
    event CandidateRecommended(address indexed candidate);

    /**
     * @notice sets the state contracts used for verification of world ID and zk circuits
     * @param _worldIDVerificationContract - contract address of the world ID verification
     * @param _voteVerifier - contract address of the vote circuit solidity verifier
     * @param _claimVerifier - contract address of the claim circuit solidity verifier
     */
    constructor(
        IWorldcoinVerifier _worldIDVerificationContract,
        VoteUltraVerifier _voteVerifier,
        ClaimUltraVerifier _claimVerifier
    ) {
        // setup worldID verification
        worldIDVerificationContract = _worldIDVerificationContract;
        // setup tree and initialise with default zeros and push init root to history
        BinaryIMT.initWithDefaultZeroes(VotingTree, depth);
        BinaryIMT.initWithDefaultZeroes(RewardsTree, depth);
        voteMerkleRoot.push(VotingTree.root);
        voteVerifier = _voteVerifier;
        claimVerifier = _claimVerifier;
    }

    //////////////////////
    // Public functions //
    //////////////////////

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
    )
        public
    {
        // Perform checks to verify World ID
        worldIDVerificationContract.verifyAndExecute(signal, root, nullifierHash, proof);
        require(verifyMint(tx_mint), "Mint did not verify");
        // ensure value of mint is equal to 100
        require(tx_mint.value == 100, "Coin minted with incorrect value != 100");
        // will add commitment to the on-chain tree
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_mint.commitment);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        emit WorldIDRegistered();
    }

    /**
     * @notice Function to register an account as a Candidate
     * @param _name Name of the candidate
     * @dev will initialise a new candidate by creating a new Binary IMT candidate tree and new user
     *      in the user map with status Candidate
     */
    function registerAsCandidate(string calldata _name) public {
        require(users[msg.sender].status == Status.UNREGISTERED, "WorldcoinSocialGraph: INVALID_USER");
        require(!candidateTreeNonEmpty[msg.sender], "WorldcoinSocialGraph: CANDIDATE_TREE_ALREADY_EXISTS");
        BinaryIMT.initWithDefaultZeroes(candidateTrees[msg.sender], depth);
        candidateTreeNonEmpty[msg.sender] = true;
        // add user to user map
        users[msg.sender] = User(_name, 0, 0, Status.CANDIDATE, 0);
        users[msg.sender] = User(_name, 0, 0, Status.CANDIDATE, 0);
        emit UserRegistered(msg.sender, Status.CANDIDATE);
    }

    /**
     * @notice Function to verify a Mint transaction
     * @param tx_mint - mint tx used to signup a user to the vote tree
     */
    function verifyMint(Mint calldata tx_mint) public pure returns (bool) {
        return tx_mint.commitment == PoseidonT4.hash([tx_mint.k, 0, tx_mint.value]);
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
        require(users[_user].status == Status.CANDIDATE, "WorldcoinSocialGraph: NOT_A_CANDIDATE");
        // check user has v_in + weight <= 10
        require(users[_user].v_in + weight <= 1000, "WorldcoinSocialGraph: EXCEEDED_VOTING_POWER");
        // verify pour tx
        require(verifyPour(tx_pour, true), "WorldcoinSocialGraph: POUR_VERIFICATION_FAILED");
        voteNullifiers.push(tx_pour.sn_old);
        voteNullifiersExists[tx_pour.sn_old] = true;
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_pour.cm_1);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        userIDMerkleRoot[_user].push(BinaryIMT.insert(candidateTrees[_user], tx_pour.cm_2));
        users[_user].v_in += weight;
        users[_user].numberOfVotes++;
        emit CandidateRecommended(_user);
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
        if (voteNullifiersExists[tx_pour.sn_old] || (!voteMerkleRootExists[tx_pour.rt] && called_by_vote)) {
            return false;
        }

        // compute h_sig = poseidon(pk_sig)
        uint256 h_sig = PoseidonT2.hash([uint256(tx_pour.pk_sig)]);

        // Verify signature
        require(verifySignature(tx_pour, h_sig), "WorldcoinSocialGraph: INVALID_SIGNATURE");

        // Verify pour circuit proof
        bytes32[] memory publicInputs = new bytes32[](7);
        publicInputs[0] = bytes32(tx_pour.rt);
        publicInputs[1] = bytes32(tx_pour.sn_old);
        publicInputs[2] = bytes32(tx_pour.cm_1);
        publicInputs[3] = bytes32(tx_pour.cm_2);
        publicInputs[4] = bytes32(tx_pour.v_pub);
        publicInputs[5] = bytes32(h_sig);
        publicInputs[6] = bytes32(tx_pour.h);

        // TODO: FIX VERIFICATION ERROR
        if (!called_by_vote) {
            // return true;
            // return (claimVerifier.verify(tx_pour.proof, publicInputs));
        } else {
            return (voteVerifier.verify(tx_pour.proof, publicInputs));
            // return true;
        }
    }

    /**
     * @notice will update the user to verified and allow them to vote on future world ID members
     * @param tx_mint - mint transaction of the candidate in the voting tree
     * @dev will verify the user is eligible for this and if so will insert the tx commitment to the vote tree
     *      and change the status from Candidate to verified identity
     */
    function updateStatusVerified(Mint calldata tx_mint) public {
        require(users[msg.sender].status == Status.CANDIDATE, "WorldcoinSocialGraph: NOT_A_CANDIDATE");
        require(users[msg.sender].v_in >= x, "WorldcoinSocialGraph: INSUFFICIENT_VOTING_POWER");
        require(verifyMint(tx_mint), "WorldCoinSocialGraph: MINT_VERIFICATION_FAILED");
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_mint.commitment);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        uint256 c_epoch = currentEpoch();
        users[msg.sender].status = Status.VERIFIED_IDENTITIY;
        users[msg.sender].epochV = c_epoch;
        rewardsPerEpoch[c_epoch].sum += users[msg.sender].v_in;
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
        require(users[_user].status == Status.VERIFIED_IDENTITIY, "WorldcoinSocialGraph: NOT_VERIFIED_USER");

        //compute current epoch
        uint256 c_epoch = currentEpoch();
        uint256 epoch = users[_user].epochV;
        require(c_epoch > epoch, "WorldcoinSocialGraph: EPOCH_NOT_ENDED");
        //check if public parameters are valid
        require(tx_pour.v_pub == rewardsPerEpoch[epoch].sum);
        require(verifyPour(tx_pour, false), "WorldcoinSocialGraph: POUR_VERIFICATION_FAILED");

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
        rewardsPerEpoch[i].claimed += users[_user].v_in;
        if (rewardsPerEpoch[i].sum == rewardsPerEpoch[i].claimed) {
            delete(rewardsPerEpoch[i]);
        }
        emit RewardClaimed(_user);
    }

    /**
     * @notice the penalise function that will delete the candidate tree in order to punish malicious voters
     */
    function penalise() public {
        require(users[msg.sender].status == Status.CANDIDATE, "WorldcoinSocialGraph: NOT_A_CANDIDATE");

        delete candidateTrees[msg.sender];
        delete userIDMerkleRoot[msg.sender];

        users[msg.sender].v_in = 0;
        users[msg.sender].numberOfVotes = 0;

        emit Penalised(msg.sender);
    }

    /**
     * @notice Function to calculate the current epoch
     * @return current epoch
     */
    function currentEpoch() public view returns (uint256) {
        return (block.number / 50_064) + 1;
    }

    /// @notice Function to verify signature
    function verifySignature(Pour memory txPour, uint256 h_sig) public view returns (bool) {
        bytes32 _hashedMessage = keccak256(abiEncodeTxPourParams(txPour, h_sig));
        return SignatureChecker.isValidSignatureNow(txPour.pubkey, _hashedMessage, txPour.sig);
    }

    ///////////////////////
    // Private functions //
    ///////////////////////

    /**
     * @notice verify signature
     */
    function abiEncodeTxPourParams(Pour memory _txPour, uint256 h_sig) private pure returns (bytes memory) {
        return abi.encodePacked(
            _txPour.rt,
            _txPour.sn_old,
            _txPour.cm_1,
            _txPour.cm_2,
            _txPour.v_pub,
            h_sig,
            _txPour.h,
            _txPour.proof,
            _txPour.info
        );
        // should sign chain id, contract address, nonce
    }
}
