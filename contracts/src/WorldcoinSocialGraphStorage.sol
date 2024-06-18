// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { BinaryIMT, BinaryIMTData } from "../lib/zk-kit.solidity/packages/imt/contracts/BinaryIMT.sol";

contract WorldcoinSocialGraphStorage {
    uint256 internal constant depth = 32; // MAX DEPTH OF IMT is 32
    uint256 internal constant x = 600;
    BinaryIMTData VotingTree;
    BinaryIMTData RewardsTree;
    uint256[] voteNullifiers;
    uint256[] rewardsNullifiers;
    uint256[] voteMerkleRoot;
    uint256[] rewardsMerkleRoot;

    enum Status {
        UNREGISTERED,
        WORLD_ID_HOLDER,
        CANDIDATE,
        VERIFIED_IDENTITIY
    }

    struct User {
        string name;
        uint256 v_in;
        uint256 epochV;
        Status status;
        uint256 numberOfVotes;
    }

    struct Rewards {
        // total number of voting power allocated to the candidates
        uint256 sum;
        // total number of voting power claimed by the voters
        uint256 claimed;
    }

    // Mint transaction
    struct Mint {
        uint256 commitment;
        uint256 value;
        uint256 k;
        uint256 s;
    }

    // Pour transaction
    struct Pour {
        uint256 rt;
        uint256 sn_old;
        uint256 cm_1;
        uint256 cm_2;
        uint256 v_pub;
        string info;
        bytes32 pk_sig;
        address pubkey;
        uint256 h;
        bytes proof;
        bytes sig;
    }

    mapping(uint256 => Rewards) rewardsPerEpoch;
    mapping(address => BinaryIMTData) public candidateTrees;
    mapping(address => bool) candidateTreeNonEmpty;
    mapping(address => uint256[]) userIDNullifiers;
    mapping(address => uint256) sizeOfUserIDNullifiers;
    mapping(uint256 => bool) public voteNullifiersExists;
    mapping(address => User) internal users;
    mapping(address => uint256[]) userIDMerkleRoot;
    mapping(uint256 => bool) voteMerkleRootExists;
}
