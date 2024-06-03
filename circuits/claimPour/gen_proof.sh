#!/usr/bin/bash

cd circuits/claimPour

# generate proof
echo "generating claim proof..."
nargo prove

echo "proof generated!"

