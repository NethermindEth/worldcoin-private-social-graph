// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { Tree } from "./tree.sol";
import { Contract } from "./Contract.sol";

contract SocialGraph {
    uint depth = 64;

    mapping(address => Tree) candidateTrees;

    mapping(address => User) internal users;

    uint256[] rootHistory;

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
        uint256 cm_new;
        uint256 v_pub;
        string info;
        uint256 pk_sig;
        uint256 h_1;
        // pour proof as well: once noir circuits are written we will know what it looks like
        uint256 c_1;
        uint256 sig;
    }
}