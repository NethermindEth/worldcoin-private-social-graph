// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { BinaryIMT, BinaryIMTData } from "../lib/zk-kit.solidity/packages/imt/contracts/BinaryIMT.sol";

/**
 * @notice This contract manages the storage for the Worldcoin Social Graph
 */
contract WorldcoinSocialGraphStorage {
    /// @dev Maximum depth of the Incremental Merkle Tree (IMT)
    uint256 internal constant depth = 32;

    /// @dev A constant value used within the contract, currently set to 600
    uint256 internal constant x = 600;

    /// @dev Data structure for the voting tree
    BinaryIMTData VotingTree;

    /// @dev Data structure for the rewards tree
    BinaryIMTData RewardsTree;

    /// @dev Array to store vote nullifiers
    uint256[] voteNullifiers;

    /// @dev Array to store rewards nullifiers
    uint256[] rewardsNullifiers;

    /// @dev Array to store vote Merkle roots
    uint256[] voteMerkleRoot;

    /// @dev Array to store rewards Merkle roots
    uint256[] rewardsMerkleRoot;

    /**
     * @notice Different user status
     * - UNREGISTERED: The user has not registered
     * - WORLD_ID_HOLDER: The user holds a World ID
     * - CANDIDATE: The user is a candidate in the voting system
     * - VERIFIED_IDENTITY: The user is a verified identity
     */
    enum Status {
        UNREGISTERED,
        WORLD_ID_HOLDER,
        CANDIDATE,
        VERIFIED_IDENTITY
    }

    /**
     * @dev Structure to store user data for candidates or verified identities
     * @param name The name of the candidate
     * @param v_in The user's voting power
     * @param epochV The epoch when user became verified
     * @param status The status of the candidate
     * @param numberOfVotes The number of times a candidate has been voted
     */
    struct User {
        string name;
        uint256 v_in;
        uint256 epochV;
        Status status;
        uint256 numberOfVotes;
    }

    /**
     * @dev Structure to store rewards data
     * @param sum The total voting power allocated to candidates
     * @param claimed The total voting power claimed by voters
     */
    struct Rewards {
        uint256 sum;
        uint256 claimed;
    }

    ///@dev Structure to store mint transaction data
    struct Mint {
        uint256 commitment;
        uint256 value;
        uint256 k;
        uint256 s;
    }

    /**
     * @dev Structure to store pour transaction data
     * @param rt The root of the tree
     * @param sn_old The old serial number
     * @param cm_1 The first commitment value
     * @param cm_2 The second commitment value
     * @param v_pub The public parameter (weight or sum of rewards at a particular epoch)
     * @param info Additional information about the pour transaction
     * @param pubkey The public key associated
     * @param h Hash of h_sig
     * @param proof The proof data
     * @param sig The signature data
     * @param publicInputs The public inputs for the transaction
     */
    struct Pour {
        uint256 rt;
        uint256 sn_old;
        uint256 cm_1;
        uint256 cm_2;
        uint256 v_pub;
        string info;
        address pubkey;
        uint256 h;
        bytes proof;
        bytes sig;
        bytes32[] publicInputs;
    }

    /// @dev Maps epoch to rewards data
    mapping(uint256 => Rewards) rewardsPerEpoch;

    /// @dev Maps candidate address to their corresponding tree data
    mapping(address => BinaryIMTData) public candidateTrees;

    /// @dev Check if a candidate's tree is non-empty
    mapping(address => bool) candidateTreeNonEmpty;

    /// @dev Maps user address to their corresponding nullifiers
    mapping(address => uint256[]) userIDNullifiers;

    /// @dev Maps user address to the size of their nullifiers
    mapping(address => uint256) sizeOfUserIDNullifiers;

    /// @dev Checks if a vote nullifier exists
    mapping(uint256 => bool) public voteNullifiersExists;

    /// @dev Maps user address to their corresponding user data
    mapping(address => User) public users;

    /// @dev Mapping from user address to their corresponding Merkle roots
    mapping(address => uint256[]) userIDMerkleRoot;

    /// @dev Checks if a vote Merkle root exists
    mapping(uint256 => bool) public voteMerkleRootExists;
}
