// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { Tree } from "./tree.sol";
import { Contract } from "./Contract.sol";
import { SocialGraph } from "./social_graph.sol";

contract Voting is SocialGraph{
    Contract worldIDVerificationContract;
    
    Tree VotingTree;

    constructor(
        Contract _worldIDVerificationContract,
        Tree _votingTree
    ) {
        // setup worldID verification
        worldIDVerificationContract = _worldIDVerificationContract;
        // setup tree and initialise with default zeros and push init root to history
        VotingTree = _votingTree;
        rootHistory.push(VotingTree.initWithDefaultZeroes(depth));   
    }

    // Function to register an account as a World ID holder
    function registerAsWorldIDHolder(
        address signal, 
        uint256 root, 
        uint256 nullifierHash, 
        uint256[8] calldata proof,
        Mint tx_mint
        ) public {
        require(!users[msg.sender].isRegistered, "User is already registered");
        // Perform checks to verify World ID
        worldIDContract.verifyAndExecute(signal, root, nullifierHash, proof);
        require(verifyMint(tx_mint));
        // ensure value of mint is equal to 1
        require(tx_mint.value == 1);
        // will add commitment to the on-chain tree
        rootHistory.push(VotingTree.insert(tx_mint.commitment));
    }

    function verifyMint(Mint tx_mint){
        // check cm == poseidon(s||v||k)
    }

    function vote(
        Pour tx_pour,
        Mint tx_mint,
        uint256 weight,
        address user
        ) public {
            // check user is in candidates
            
            // check user has v_in + weight <= 10

            // verify pour tx
            
    }

    function verify_pour(Pour tx_pour) {
        // check merkle root is stored
        require(rootHistory[rootHistory.length] == tx_pour.rt);
        // compute h_sig = poseidon(pk_sig)
        
        // Verify pour proof

        // Verify message and signature against pk_sig
    }


}