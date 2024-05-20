// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { Tree } from "./tree.sol";
import { Contract } from "./Contract.sol";
import { SocialGraph } from "./social_graph.sol";
import "poseidon-solidity/PoseidonT3.sol";

contract Voting is SocialGraph{
    Contract worldIDVerificationContract;
    
    constructor(
        Contract _worldIDVerificationContract,
        Tree _votingTree, Tree _RewardsTree
    ) {
        // setup worldID verification
        worldIDVerificationContract = _worldIDVerificationContract;
        // setup tree and initialise with default zeros and push init root to history
        VotingTree = _votingTree;
        RewardsTree = _RewardsTree;
        voteMerkleRoot.push(VotingTree.initWithDefaultZeroes(depth));   
    }

    // Function to register an account as a World ID holder
    function registerAsWorldIDHolder(
        address signal, 
        uint256 root, 
        uint256 nullifierHash, 
        uint256[8] calldata proof,
        Mint tx_mint
        ) public {
        // Perform checks to verify World ID
        worldIDContract.verifyAndExecute(signal, root, nullifierHash, proof);
        // compute current epoch
        uint c_epoch = (block.number/50064) + 1;
        require(verifyMint(tx_mint));
        // ensure value of mint is equal to 1
        require(tx_mint.value == 1);
        // will add commitment to the on-chain tree
        voteMerkleRoot.push(VotingTree.insert(tx_mint.commitment));
    }

    function registerAsCandidate(string calldata _name, Tree _candidateTree) public {
        require(!users[msg.sender].isRegistered, "User is already registered");
        candidateTrees[msg.sender] = _candidateTree;
        // add user to user map
        users[msg.sender] = User(id, _name, 0,0,2,0,1);
        userAddress[id++] = msg.sender;
    }

    function verifyMint(Mint tx_mint) returns(bool){
        if(tx_mint.commitment == PoseidonT3.hash([tx_mint.value,tx_mint.k]))
            return true;
        else return false;
    }

    function vote(
        Pour tx_pour,
        Mint tx_mint,
        uint256 weight,
        uint uid
        ) public {
            require(users[userAddress[uid]].isRegistered, "Candidate not yet registered");
            require(users[userAddress[uid]].status == 2, "User is not a Candidate");
            //not necessary to check since uint256
            require(weight >= 0, "Can only give positive weight");
            // check user has v_in + weight <= 10
            require(users[userAddress[uid]].vin + weight <= 1000, "Candidate exceeded maximum voting power, try with a lesser weight");
            // verify pour tx
            require(verifyPour(tx_pour));
            voteNullifiers.push(tx_pour.sn_old);
            voteNullifiersExists[tx_pour.sn_old] = true;
            voteMerkleRoot.push(VotingTree.insert(tx_pour.cm_new));
            require(verifyMint(tx_mint));
            userIDMerkleRoot[userAddress[uid]].push(candidateTrees[userAddress[uid]].insert(tx_mint.commitment));
            users[userAddress[uid]].vin += weight;
    }

    function verify_pour(Pour tx_pour) returns(bool){
        if(voteNullifiersExists[tx_pour.sn_old]) {
            return false;
        } else if(!voteMerkleRootExists[tx_pour.rt]) {
            return false;
        }
        // compute h_sig = poseidon(pk_sig)
        uint256 h_sig = PoseidonT3.hash([tx_pour.pk_sig]);

        // Verify pour proof
        // Verify message and signature against pk_sig
        //TODO
    }

    function inversePower(uint256 input) public pure returns (uint) {
        // Represent the percentage as a fixed-point number.
        int128 percentage = ABDKMath64x64.divu(input, 100);

        // Calculate e^(percentage)
        int128 result = ABDKMath64x64.exp(percentage);

        // Multiply by 10^5 to keep 5 decimal places
        result = ABDKMath64x64.mul(result, ABDKMath64x64.fromUInt(10**5));

        // Invert the exponential as required
        result = ABDKMath64x64.div(ABDKMath64x64.fromUInt(10**5), result); 

        // Multiply by 10^5 to keep 5 decimal places
        result = ABDKMath64x64.mul(result, ABDKMath64x64.fromUInt(10**5));

        // Convert the fixed-point result to a uint and return it.
        return ABDKMath64x64.toUInt(result);
    }

    function updateStatusVerified(Mint tx_mint) public {
        require(users[msg.sender].isRegistered, "You are not yet registered");
        require(users[msg.sender].status == 2, "You need to be a candidate in order to call this function");
        require(users[msg.sender].vin >= x);
        uint y = 1 - inversePower(users[msg.sender].vin/2);
        require(verifyMint(tx_mint));
        uint256 root = VotingTree.insert(tx_mint.commitment);
        voteMerkleRoot.push(root);
        voteMerkleRootExists[root] = true;
        users[msg.sender].status = 1;
        uint c_epoch = (block.number/50064) + 1;
        users[msg.sender].epochV = c_epoch;
        users[msg.sender].numberOfLeaves = ;//////
        rewards_per_epoch[c_epoch].sum += users[msg.sender].vin;
    }

    function penalise(){
        require(users[msg.sender].isRegistered, "You are not yet registered");
        require(users[msg.sender].status == 2, "You need to be a candidate in order to call this function");
        candidateTrees[msg.sender].remove();
        users[msg.sender].vin =0;
    }

}