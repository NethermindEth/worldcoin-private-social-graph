// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract FakeWorldcoinVerifier {
    function verifyAndExecute(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    )
        public
        returns (bool)
    {
        return true;
    }
}
