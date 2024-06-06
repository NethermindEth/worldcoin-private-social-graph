// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { Contract } from "./Contract.sol";
import {BinaryIMT, BinaryIMTData} from "https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/main/packages/imt/contracts/BinaryIMT.sol";

contract SocialGraph {

    uint depth = 64;
    uint internal id = 1;
    uint internal x = 600;
    struct User{
        uint uid;
        string name;
        uint v_in;
        uint epochV;
        //1 - Verified identity, 2 - Candidate, 3 - Rejected
        uint status;
        uint numberOfVotes;
        bool isRegistered;
    }

    struct Rewards {
        // total number of voting power allocated to the candidates
        uint sum;
        // total number of voting power claimed by the voters
        uint claimed;
    }

    mapping (uint => Rewards) rewards_per_epoch;
    
    mapping(address => BinaryIMTData) candidateTrees;
    mapping(address => bool) candidateTreeNonEmpty;
    BinaryIMTData VotingTree;
    BinaryIMTData RewardsTree;

    mapping(address => uint256[]) userIDNullifiers;
    mapping(address => uint) sizeOfUserIDNullifiers;
    uint256[] voteNullifiers;
    mapping(uint256 => bool) public voteNullifiersExists;
    uint256[] rewardsNullifiers;

    mapping(address => User) internal users;
    mapping(uint => address) internal userAddress;

    
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
        uint256[] v_pub;
        string info;
        bytes32 pk_sig;
        uint256 h;
        bytes proof;
        bytes32 sig;
    }
}