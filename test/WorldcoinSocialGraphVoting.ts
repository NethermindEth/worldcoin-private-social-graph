import hre from "hardhat";
import { expect, assert} from 'chai';
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

// A deployment function to set up the initial state
const deploy = async () => {
    const voting = await hre.viem.deployContract("WorldcoinSocialGraphVoting");
  
    return { voting };
};

describe("Voting Contract Tests", function () {
    it("Should deploy voting contract", async () => {
        const { voting } = await loadFixture(deploy);
        voting.read
    })
});
  