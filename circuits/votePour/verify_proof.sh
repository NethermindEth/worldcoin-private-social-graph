#!/usr/bin/bash

cd circuits/votePour
echo "verifying vote proof..."
nargo verify
echo "proof verified!"