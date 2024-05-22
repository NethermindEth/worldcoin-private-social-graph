// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { Contract } from "./Contract.sol";
import { SocialGraph } from "./social_graph.sol";
import "poseidon-solidity/PoseidonT3.sol";
// import "https://github.com/abdk-consulting/abdk-libraries-solidity/blob/master/ABDKMath64x64.sol";
// import {BinaryIMT, BinaryIMTData} from "https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/main/packages/imt/contracts/BinaryIMT.sol";
import "../../node_modules/abdk-libraries-solidity/ABDKMath64x64.sol";
import {BinaryIMT, BinaryIMTData} from "../../node_modules/@zk-kit/imt.sol/BinaryIMT.sol";

contract Voting is SocialGraph{
    Contract worldIDVerificationContract;
    
    constructor(Contract _worldIDVerificationContract) {
        // setup worldID verification
        worldIDVerificationContract = _worldIDVerificationContract;
        // setup tree and initialise with default zeros and push init root to history
        BinaryIMT.initWithDefaultZeroes(VotingTree, depth);
        BinaryIMT.initWithDefaultZeroes(RewardsTree, depth);
        voteMerkleRoot.push(VotingTree.root);   
    }

    // Function to register an account as a World ID holder
    function registerAsWorldIDHolder(
        address signal, 
        uint256 root, 
        uint256 nullifierHash, 
        uint256[8] calldata proof,
        Mint calldata tx_mint
        ) public {
        // Perform checks to verify World ID
        worldIDVerificationContract.verifyAndExecute(signal, root, nullifierHash, proof);
        require(verifyMint(tx_mint));
        // ensure value of mint is equal to 100
        require(tx_mint.value == 100);
        // will add commitment to the on-chain tree
        voteMerkleRoot.push(BinaryIMT.insert(VotingTree, tx_mint.commitment));
    }

    function registerAsCandidate(string calldata _name) public {
        require(!users[msg.sender].isRegistered, "User is already registered");
        require(candidateTreeNonEmpty[msg.sender] == false,"Candidate already exists");
        BinaryIMT.initWithDefaultZeroes(candidateTrees[msg.sender], depth);
        candidateTreeNonEmpty[msg.sender] = true;
        // add user to user map
        users[msg.sender] = User(id, _name, 0, 0, 2, 0, true);
        userAddress[id++] = msg.sender;
    }

    function verifyMint(Mint calldata tx_mint) public returns(bool){
        if(tx_mint.commitment == PoseidonT3.hash([tx_mint.value,tx_mint.k]))
            return true;
        else return false;
    }

    function vote(
        Pour calldata tx_pour,
        uint256 weight,
        uint uid
        ) public {
            require(users[userAddress[uid]].isRegistered, "Candidate not yet registered");
            require(users[userAddress[uid]].status == 2, "User you are voting for is not a Candidate");
            //not necessary to check since uint256
            require(weight >= 0, "Can only give positive weight");
            // check user has v_in + weight <= 10
            require(users[userAddress[uid]].v_in + weight <= 1000, "Candidate exceeded maximum voting power, try with a lesser weight");
            // verify pour tx
            require(verify_pour(tx_pour));
            voteNullifiers.push(tx_pour.sn_old);
            voteNullifiersExists[tx_pour.sn_old] = true;
            uint256 new_root = BinaryIMT.insert(VotingTree, tx_pour.cm_1);
            voteMerkleRoot.push(new_root);
            voteMerkleRootExists[new_root] = true;
            userIDMerkleRoot[userAddress[uid]].push(BinaryIMT.insert(candidateTrees[userAddress[uid]], tx_pour.cm_2));
            users[userAddress[uid]].v_in += weight;
            users[userAddress[uid]].numberOfVotes += 1;
    }

    function verify_pour(Pour calldata tx_pour) public returns(bool){
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

    function updateStatusVerified(Mint calldata tx_mint) public {
        require(users[msg.sender].isRegistered, "You are not yet registered");
        require(users[msg.sender].status == 2, "You need to be a candidate in order to call this function");
        require(users[msg.sender].v_in >= x);
        uint y = 100*(1 - inversePower(users[msg.sender].v_in/2));
        require(verifyMint(tx_mint));
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_mint.commitment);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        users[msg.sender].status = 1;
        uint c_epoch = (block.number/50064) + 1;
        users[msg.sender].epochV = c_epoch;
        rewards_per_epoch[c_epoch].sum += users[msg.sender].v_in;
    }

    function claimRewards(uint uid, Pour calldata tx_pour) public {
        //compute current epoch
        uint c_epoch = (block.number/50064) + 1;
        //check userID is verified
        require(users[userAddress[uid]].status == 1, "You need to be verified in order to call this function");
        require(c_epoch > users[userAddress[uid]].epochV);
        require(verify_pour(tx_pour));
        userIDNullifiers[userAddress[uid]].push(tx_pour.sn_old);
        sizeOfUserIDNullifiers[userAddress[uid]] += 1;
        uint256 new_root = BinaryIMT.insert(VotingTree, tx_pour.cm_1);
        voteMerkleRoot.push(new_root);
        voteMerkleRootExists[new_root] = true;
        rewardsMerkleRoot.push(BinaryIMT.insert(RewardsTree, tx_pour.cm_2));
        uint i = users[userAddress[uid]].epochV;
        if(sizeOfUserIDNullifiers[userAddress[uid]] == users[userAddress[uid]].numberOfVotes) {
            delete(candidateTrees[userAddress[uid]]);
            candidateTreeNonEmpty[userAddress[uid]] = false;
        }
        rewards_per_epoch[i].claimed += users[userAddress[uid]].v_in;
        if(rewards_per_epoch[i].sum == rewards_per_epoch[i].claimed){
            delete(rewards_per_epoch[i]);
        }

    }

    function penalise() public{
        require(users[msg.sender].isRegistered, "You are not yet registered");
        require(users[msg.sender].status == 2, "You need to be a candidate in order to call this function");
        delete candidateTrees[msg.sender];
        delete userIDMerkleRoot[msg.sender];
        users[msg.sender].v_in = 0;
        users[msg.sender].numberOfVotes = 0;
    }

}