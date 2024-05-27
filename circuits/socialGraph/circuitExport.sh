#!/usr/bin/bash

nargo export

pnpm noir-codegen ./circuits/socialGraph/export/*.json
