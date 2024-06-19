import vote_circuit from "../../circuits/votePour/target/votePour.json";
import claim_circuit from "../../circuits/claimPour/target/claimPour.json";
// import tinyCircuit from "../../circuits/tinyCircuit/target/tinyCircuit.json"
import { BarretenbergBackend, BarretenbergVerifier as Verifier } from '@noir-lang/backend_barretenberg';
import { CompiledCircuit, InputMap, Noir, ProofData } from '@noir-lang/noir_js';

export async function proveVote(inputs: InputMap) {
    try {
        const backend = new BarretenbergBackend(vote_circuit as CompiledCircuit);
        const noir = new Noir(vote_circuit as CompiledCircuit, backend);
        const proof = await noir.generateProof(inputs);
        console.log(proof)

        const verificationKey = await backend.getVerificationKey();
        const verifier = new Verifier();
        const isValid = await verifier.verifyProof(proof, verificationKey);
        console.log("Prove vote: ",isValid)
        return proof
    } catch (error) {
        console.log(error)
        throw new Error
    }
}

export async function verifyVote(proof: ProofData) {
    const backend = new BarretenbergBackend(vote_circuit as CompiledCircuit);
    const noir = new Noir(vote_circuit as CompiledCircuit, backend);
    const verificationKey = await backend.getVerificationKey();
    const verifier = new Verifier();
    const isValid = await verifier.verifyProof(proof, verificationKey);
    console.log("Verify vote Proof: ",isValid)
    return isValid
}

export async function proveClaim(inputs: InputMap) {
    try {
        const backend = new BarretenbergBackend(claim_circuit as CompiledCircuit);
        const noir = new Noir(claim_circuit as CompiledCircuit, backend);
        const proof = await noir.generateProof(inputs);
        console.log(proof)

        const verificationKey = await backend.getVerificationKey();
        const verifier = new Verifier();
        const isValid = await verifier.verifyProof(proof, verificationKey);
        console.log(isValid)
        return proof
    } catch (error) {
        console.log(error)
        throw new Error
    }
}

export async function verifyClaim(proof: ProofData) {
    const backend = new BarretenbergBackend(claim_circuit as CompiledCircuit);
    const noir = new Noir(claim_circuit as CompiledCircuit, backend);
    const verificationKey = await backend.getVerificationKey();
    const verifier = new Verifier();
    const isValid = await verifier.verifyProof(proof, verificationKey);
    console.log("Verify claim Proof: ",isValid)
    return isValid
}
