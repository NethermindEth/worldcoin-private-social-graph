// based on Semaphore: https://github.com/semaphore-protocol/semaphore/blob/main/packages/group/src/index.ts

import { IMT, IMTMerkleProof, IMTNode } from "@zk-kit/imt"
import { poseidon2 } from "poseidon-lite/poseidon2"

export class Tree {
    public IMT: IMT

    public d = 32
    public zeroValue = 0
    public arity = 2
    public roots: bigint[]

    /**
     * Creates a new instance of the Group. Optionally, a list of identity commitments can
     * be passed as a parameter. Adding members in chunks is more efficient than adding
     * them one by one with the `addMember` function.
     * @param members A list of identity commitments.
     */
    constructor(members: IMTNode[] = []) {
        this.IMT = new IMT(poseidon2, this.d, this.zeroValue, this.arity, members)
        this.roots = []
        this.roots.push(this.IMT.root)
    }

    /**
     * Returns the root hash of the tree.
     * @returns The root hash as a string.
     */
    public get root(): bigint {
        return this.IMT.root ? this.IMT.root : 0n
    }

    /**
     * Returns the depth of the tree.
     * @returns The tree depth as a number.
     */
    public get depth(): number {
        return this.IMT.depth
    }

    /**
     * Returns the members (i.e. identity commitments) of the group.
     * @returns The list of members of the group.
     */
    public get members(): bigint[] {
        return this.IMT.leaves
    }

    /**
     * Returns the index of a member. If the member does not exist it returns -1.
     * @param member A member of the group.
     * @returns The index of the member, or -1 if it does not exist.
     */
    public indexOf(member: IMTNode): number {
        return this.IMT.indexOf(BigInt(member))
    }

    /**
     * Adds a new member to the group.
     * @param member The new member to be added.
     */
    public addMember(member: IMTNode): number {
        if (member === 0n || member === "0") {
            throw new Error("Failed to add member: value cannot be 0")
        }

        this.IMT.insert(BigInt(member))
        this.roots.push(this.IMT.root)
        return this.IMT.indexOf(BigInt(member))
    }

    /**
     * Updates a member in the group.
     * @param index Index of the member to be updated.
     * @param member New member value.
     */
    public updateMember(index: number, member: IMTNode) {
        if (this.members[index] === 0n) {
            throw new Error("Failed to update member: it has been removed")
        }

        this.IMT.update(index, BigInt(member))
        this.roots.push(this.IMT.root)
    }

    /**
     * Removes a member from the group.
     * @param index The index of the member to be removed.
     */
    public removeMember(index: number) {
        if (this.members[index] === 0n) {
            throw new Error("Failed to remove member: it has already been removed")
        }

        this.IMT.update(index, 0n)
        this.roots.push(this.IMT.root)
    }

    /**
     * Creates a proof of membership for a member of the group.
     * @param index The index of the member.
     * @returns The {@link MerkleProof} object.
     */
    public generateMerkleProof(index: number): IMTMerkleProof {
        return this.IMT.createProof(index)
    }

    /**
     * Creates a proof of membership for a member of the group.
     * @param proof The {@link MerkleProof} object.
     * @returns true if the the proof is valid
     */
    public verifyMerkleProof(proof: IMTMerkleProof) {
        return this.IMT.verifyProof(proof)
    }
}
