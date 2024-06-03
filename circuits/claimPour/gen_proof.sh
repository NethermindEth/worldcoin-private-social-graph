#!/usr/bin/bash

# generate proof
echo "generating proof..."
nargo prove

echo "proof generated!"

echo "verifying proof..."
# verify proof
nargo verify
echo "proof verified!"
