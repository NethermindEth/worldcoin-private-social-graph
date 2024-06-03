#!/usr/bin/bash

cd circuits/vote

# generate proof
echo "generating vote proof..."
nargo prove

echo "proof generated!"

