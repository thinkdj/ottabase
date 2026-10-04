import { describe, expect, it } from 'vitest';
import { checkPassword, getProviderDisplayName, isStrongPassword } from '../components/helpers';

describe('password policy', () => {
    it('accepts a password that meets every rule', () => {
        expect(isStrongPassword('Abcdef1!')).toBe(true);
    });

    it.each([
        ['Abcde1!', 'length'],
        ['ABCDEF1!', 'lower'],
        ['abcdef1!', 'upper'],
        ['Abcdefg!', 'number'],
        ['Abcdefg1', 'symbol'],
    ])('rejects %s (missing %s)', (password, missing) => {
        expect(isStrongPassword(password)).toBe(false);
        const unmet = checkPassword(password)
            .filter((r) => !r.met)
            .map((r) => r.rule.id);
        expect(unmet).toEqual([missing]);
    });

    it('reports every rule unmet for an empty password', () => {
        expect(checkPassword('').every((r) => !r.met)).toBe(true);
    });
});

describe('getProviderDisplayName', () => {
    it('maps known ids and title-cases unknown ones', () => {
        expect(getProviderDisplayName('azure-ad')).toBe('Microsoft');
        expect(getProviderDisplayName('github')).toBe('GitHub');
        expect(getProviderDisplayName('gitlab')).toBe('Gitlab');
    });
});
