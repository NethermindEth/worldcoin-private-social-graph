#!/usr/bin/bash

nargo export

pnpm noir-codegen ./circuits/socialGraph/export/hash2.json
