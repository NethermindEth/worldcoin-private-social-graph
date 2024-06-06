#!/usr/bin/bash

cd circuits/votePour

# generate proof
echo "generating vote proof..."
nargo prove

echo "proof generated!"

