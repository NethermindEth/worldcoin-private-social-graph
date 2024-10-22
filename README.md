# Private social-graph based proof of personhood

An additional layer for Worldcoin's proof of personhood. This project aims to build a private social-graph based proof i.e. the existing World ID users will be able to vouch for the humanness of other parties(who are not World ID users). This way, we will be able to expand the user database for World ID holders. The difference between a public and a private social-graph based proof of personhood is that in the private system, majority of the data about the users(including who has voted for whom) will be private.

This project is [funded by Worldcoin](https://worldcoin.org/wave0-grant-recipients/nethermind-social-graph) (https://worldcoin.org/wave0-grant-recipients/nethermind-social-graph).

Contributors (in alphabetic order):

Research: Aikaterini-Panagiota Stouka, Michal Zajac

Implementation: Michael Belegris, Somya Gupta

Thanks to Lazaro Raul Iglesias Vera, Sameer Kumar, Antonio Manuel Larriba Flor for reviewing and providing valuable suggestions and guidelines. 

For the project scope, the overview, the specification for both the public and private social-graph based proof of personhood, more related work, Sybil and Game theoretic analysis, and the implemetation of the public social-graph based proof of personhood, please check the following links.

- Public social-graph based proof of personhood notion page: https://www.notion.so/EXT-Proof-of-Concept-for-Public-Social-Graph-Sybil-and-Incentives-analysis-af7af3271dc34094b8505410f6504b70?pvs=4.

- Private social-graph based proof of personhood notion page: [https://www.notion.so/nethermind/EXT-Proof-of-Concept-for-Private-Social-Graph-6404b66352c14aa8b52c77d4ab7733f6?pvs=4](https://www.notion.so/EXT-Proof-of-Concept-for-Private-Social-Graph-6404b66352c14aa8b52c77d4ab7733f6?pvs=21).

- Public social-graph based proof of personhood GitHub repository: https://github.com/NethermindEth/worldcoin-social-graph.

You can follow the instructions below taken from the README file of [https://github.com/worldcoin/world-id-onchain-template](https://github.com/worldcoin/world-id-onchain-template).

## Local Development

### Prerequisites

Create a staging on-chain app in the [Worldcoin Developer Portal](https://developer.worldcoin.org).

Ensure you have installed [Foundry](https://book.getfoundry.sh/getting-started/installation), [NodeJS](https://nodejs.org/en/download), and [pnpm](https://pnpm.io/installation).

### Local Testnet Setup

Start a local node forked from Optimism Sepolia, replacing `$YOUR_API_KEY` with your Alchemy API key:

```bash
# leave this running in the background
anvil -f https://opt-sepolia.g.alchemy.com/v2/L-B1Qjb5675fo6DJsblLYYjlfrvCPXY9
```

In another shell, deploy the contract, replacing `$WORLD_ID_ROUTER` with the [World ID Router address](https://docs.worldcoin.org/reference/address-book) for your selected chain, `$NEXT_PUBLIC_APP_ID` with the app ID as configured in the [Worldcoin Developer Portal](https://developer.worldcoin.org), and `$NEXT_PUBLIC_ACTION` with the action ID as configured in the Worldcoin Developer Portal:

```bash
cd contracts
forge build -C src/ --extra-output-files abi -o ../src/abi/

forge create --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 src/Contract.sol:Contract --constructor-args 0x11cA3127182f7583EfC416a8771BD4d11Fae4334 app_staging_550bc85869f87959046d7eeb3f86994d sign-up
# 0x8729c0238b265BaCF6fE397E8309897BB5c40473 - used in .env
```

Note the `Deployed to:` address from the output.

### Local Web Setup

In a new shell, install project dependencies:

```bash
pnpm i
```

Set up your environment variables in the `.env` file. You will need to set the following variables:
- `NEXT_PUBLIC_APP_ID`: The app ID as configured in the [Worldcoin Developer Portal](https://developer.worldcoin.org).
- `NEXT_PUBLIC_ACTION`: The action ID as configured in the Worldcoin Developer Portal.
- `NEXT_PUBLIC_WALLETCONNECT_ID`: Your WalletConnect ID.
- `NEXT_PUBLIC_CONTRACT_ADDRESS`: The address of the contract deployed in the previous step.

Start the development server:

```bash
pnpm dev
```

The Contract ABI will be automatically re-generated and saved to `src/abi/ContractAbi.json` on each run of `pnpm dev`.

### Iterating

After making changes to the contract, you should:
- re-run the `forge create` command from above
- replace the `NEXT_PUBLIC_CONTRACT_ADDRESS` environment variable with the new contract address
- if your contract ABI has changed, restart the local web server

### Testing
See the test folder [here](./tests). 
- To test the circuits, run `pnpm test-circuits`.
- To test the contracts, follow:
	- Add submodules: `git submodule update --init --recursive`
	- Compile the contracts: `pnpm compile-contracts`
	- Run tests for the contract: `pnpm test-contracts`

#### Note
When connecting your wallet to the local development environment, you will be prompted to add the network to your wallet.

Use the [Worldcoin Simulator](https://simulator.worldcoin.org) in place of World App to scan the IDKit QR codes and generate the zero-knowledge proofs.

#### Warning regarding root collision attacks:
Note that we use the same hash function without domain separation for both leaves and the internal nodes of the tree. This could potentially lead to root collision attacks where an attacker can build a tree with the same root but different leaves. The fact that we accept only Merkle paths of specific length could mitigate this but still needs consideration.

### References 
1. Worldcoin: https://docs.worldcoin.org/.
2. Worldcoin Developer Portal: https://developer.worldcoin.org.
3. The template provided by Worldcoin for WorldID On-chain Integration: used as is and integrated with on-chain components. Link: https://github.com/worldcoin/world-id-onchain-template.
4. Worldcoin simulator: used to register WorldID holders during testing. Link: https://simulator.worldcoin.org/id/0x18310f83.
5. Our design utilizes Zcash Merkle trees and techniques for spending and minting coins described in Zerocash: Decentralized Anonymous Payments from Bitcoin(extended version). Eli Ben-Sasson, Alessandro Chiesa, Christina Garman, Matthew Green, Ian Miers, Eran Tromer, Madars Virza.  http://zerocash-project.org/media/pdf/zerocash-extended-20140518.pdf.
6. The penalise technique of our design is inspired by
	- Orfeas Stefanos Thyfronitis Litos, Dionysis Zindros: Trust Is Risk: A Decentralized Financial Trust Platform. IACR Cryptol. ePrint Arch. 2017: 156 (2017). https://eprint.iacr.org/2017/156.
	- BrightID. Bitu verification. https://brightid.gitbook.io/brightid/verifications/bitu-verification.

### Licenses
1. zk-kit and zk-kit.solidity: used for the incremental merkle tree implementation. Authors: Privacy and Scaling Explorations (privacy-scaling-explorations). Link: https://github.com/privacy-scaling-explorations/zk-kit and https://github.com/privacy-scaling-explorations/zk-kit.solidity.

License:
```bash
MIT License

Copyright (c) 2024 Ethereum Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
2. Poseidon Lite: used for setting the zcash-equivalent addresses, merkle trees and commimtents. Authors: Chance (vimwitch). Link: https://github.com/vimwitch/poseidon-lite.

License:
```bash
Versions >=0.2.0 are MIT
Versions <0.2.0 are GPL-3.0
```

3. Elliptic: used for ECDSA. Authors: Fedor Indutny (indutny). Link: https://github.com/indutny/elliptic.

License:
```bash
This software is licensed under the MIT License.
Copyright Fedor Indutny, 2014.
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

4. Jest: used for testing. Authors: Jest (jestjs). Link: https://github.com/jestjs/jest.

License:
```bash
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.
Copyright Contributors to the Jest project.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: 
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

5. ABDKMath64x64 library: used for implementing the inverse exponential function. Authors: ABDK (abdk-consulting). Link: https://github.com/abdk-consulting/abdk-libraries-solidity. License: BSD-4-Clause license.
License:
```bash
Copyright (c) 2019, ABDK Consulting

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must display the following acknowledgement: This product includes software developed by ABDK Consulting.
4. Neither the name of ABDK Consulting nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY ABDK CONSULTING "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL ABDK CONSULTING BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

6. IDKit: used for interaction with the WorldID protocol through React. Authors: Worldcoin (worldcoin). Link: https://github.com/worldcoin/idkit-js. License: MIT License.
```bash
Copyright (c) 2022 Worldcoin Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

7. Semaphore: used for creating merkle trees. Authors: semaphore-protocol (semaphore). Link: https://github.com/semaphore-protocol/semaphore/blob/main/packages/group/src/index.ts . License: MIT License.
```bash
MIT License

Copyright (c) 2024 Ethereum Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### For more related work, overview, Sybil and Game theoretic analysis of our design please check our notion pages.
