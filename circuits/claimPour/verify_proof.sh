#!/usr/bin/bash

cd circuits/claimPour
echo "verifying claim proof..."
nargo verify
echo "proof verified!"