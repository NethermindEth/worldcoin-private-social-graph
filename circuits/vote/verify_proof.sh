#!/usr/bin/bash

cd circuits/vote
echo "verifying vote proof..."
nargo verify
echo "proof verified!"