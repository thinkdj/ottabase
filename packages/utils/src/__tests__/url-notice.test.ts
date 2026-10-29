import { describe, expect, it } from 'vitest';
import { isNoticeCode, readNotice, withNotice } from '../url';

describe('URL notices', () => {
    it('appends the code and keeps other params and the hash', () => {
        expect(withNotice('/login', 'email-verified')).toBe('/login?notice=email-verified');
        expect(withNotice('https://a.b/x?y=1#top', 'payport.checkout-complete')).toBe(
            'https://a.b/x?y=1&notice=payport.checkout-complete#top',
        );
        expect(() => withNotice('/x', 'Not a code')).toThrow(/Invalid notice code/);
    });

    it('reads and strips the code, leaving the rest of the query intact', () => {
        expect(readNotice('?notice=coming-soon&x=1')).toEqual({ code: 'coming-soon', search: '?x=1' });
        expect(readNotice('?notice=coming-soon')).toEqual({ code: 'coming-soon', search: '' });
        expect(readNotice('?x=1')).toEqual({ code: null, search: '?x=1' });
        // A malformed code is still stripped, so a bad link cannot keep re-firing.
        expect(readNotice('?notice=<script>&x=1')).toEqual({ code: null, search: '?x=1' });
    });

    it('accepts kebab-case codes with one optional package namespace', () => {
        expect(isNoticeCode('session-revoked')).toBe(true);
        expect(isNoticeCode('auth.oauth-account-not-linked')).toBe(true);
        expect(isNoticeCode('Bad')).toBe(false);
        expect(isNoticeCode('a.b.c')).toBe(false);
    });
});
