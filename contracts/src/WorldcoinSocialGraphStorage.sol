// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {BinaryIMT, BinaryIMTData} from "../lib/zk-kit.solidity/packages/imt/contracts/BinaryIMT.sol";

contract WorldcoinSocialGraphStorage {
    uint256 depth = 64;
    uint256 internal x = 600;

    enum Status {
        UNREGISTERED,
        WORLD_ID_HOLDER,
        CANDIDATE,
        VERIFIED_IDENTITIY,
        REJECTED
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

    mapping(uint256 => Rewards) rewards_per_epoch;

    mapping(address => BinaryIMTData) candidateTrees;
    mapping(address => bool) candidateTreeNonEmpty;
    BinaryIMTData VotingTree;
    BinaryIMTData RewardsTree;

    mapping(address => uint256[]) userIDNullifiers;
    mapping(address => uint256) sizeOfUserIDNullifiers;
    uint256[] voteNullifiers;
    mapping(uint256 => bool) public voteNullifiersExists;
    uint256[] rewardsNullifiers;

    mapping(address => User) internal users;

    mapping(address => uint256[]) userIDMerkleRoot;
    uint256[] voteMerkleRoot;
    mapping(uint256 => bool) voteMerkleRootExists;
    uint256[] rewardsMerkleRoot;

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
        uint256 h;
        bytes proof;
        bytes32 sig;
    }
}
