import { poseidon2, poseidon4 } from 'poseidon-lite';
import { hash2, hash4 } from '../../codegen/index';

describe('Poseidon tests', () => {
    it('TS: Should return the correct hash', () => {
        const x = 10;
        const hash2 = poseidon2([x, x]);
        expect(hash2).toBe(BigInt('2056449770998421094693270621231289260402432781619773239530425938274273592166'));

        const hash4 = poseidon4([x, x, x, x]);
        expect(hash4).toBe(BigInt('12501290995084169344073844953692250674022814101925614641583223360631835071976'));
    });

    it('Noir: Should return the correct hash', async () => {
        const x = '10';
        let hash = await hash2([x, x]);
        expect(BigInt(hash)).toBe(
            BigInt('2056449770998421094693270621231289260402432781619773239530425938274273592166')
        );

        hash = await hash4([x, x, x, x]);
        expect(BigInt(hash)).toBe(
            BigInt('12501290995084169344073844953692250674022814101925614641583223360631835071976')
        );
    });

    // TODO: test solidity poseidon hash

    // TODO: test all three hashes with a random number to ensure correctness
});
