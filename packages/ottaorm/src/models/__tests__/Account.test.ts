import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accountsTable } from '../Account.schema';

describe('accounts schema', () => {
    it('is an identity link only and holds no provider tokens', () => {
        // The OAuth callback uses the provider tokens once (profile fetch) and nothing reads them
        // back, so a token column here would be a plaintext credential store with no consumer.
        const columns = Object.keys(getTableColumns(accountsTable));
        expect(columns).toEqual(expect.arrayContaining(['userId', 'provider', 'providerAccountId']));
        for (const secret of ['accessToken', 'refreshToken', 'idToken', 'expiresAt', 'tokenType', 'scope']) {
            expect(columns).not.toContain(secret);
        }
    });
});
