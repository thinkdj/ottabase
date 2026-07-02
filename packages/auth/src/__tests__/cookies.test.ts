import { describe, expect, it } from 'vitest';
import { clearCookie, isHttpsRequest, parseCookies, serializeCookie } from '../cookies';

// serializeCookie now validates the name/value to prevent Set-Cookie attribute injection
// and header corruption. This is safety-critical: if the validation were too strict it
// would reject legitimate auth cookie values (JWTs, HMAC pairs) and silently break ALL
// authentication, so these tests pin down exactly what is accepted vs rejected.

describe('serializeCookie validation', () => {
    it('accepts a compact JWT value (dots, base64url chars incl - and _)', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJqdGkiOiJhYmMifQ.sig-nature_value';
        expect(() => serializeCookie('ottabase.session-token', jwt)).not.toThrow();
        expect(serializeCookie('ottabase.session-token', jwt).startsWith(`ottabase.session-token=${jwt}`)).toBe(true);
    });

    it('accepts a CSRF "token.signature" pair value', () => {
        expect(() => serializeCookie('ottabase.csrf-token', 'abc-_123.def-_456')).not.toThrow();
    });

    it('accepts __Host- / __Secure- prefixed names', () => {
        expect(() => serializeCookie('__Host-ottabase.session-token', 'v')).not.toThrow();
        expect(() => serializeCookie('__Secure-ottabase.oauth-state', 'v')).not.toThrow();
    });

    it('accepts an empty value (used by clearCookie)', () => {
        expect(() => clearCookie('ottabase.session-token')).not.toThrow();
        expect(clearCookie('ottabase.session-token')).toContain('Max-Age=0');
    });

    it('rejects a value containing a semicolon (attribute injection)', () => {
        expect(() => serializeCookie('x', 'val; Domain=evil.com')).toThrow();
    });

    it('rejects a value containing CR/LF (header injection)', () => {
        expect(() => serializeCookie('x', 'val\r\nSet-Cookie: admin=1')).toThrow();
        expect(() => serializeCookie('x', 'val\nfoo')).toThrow();
    });

    it('rejects a value with spaces, commas, quotes, or backslashes', () => {
        expect(() => serializeCookie('x', 'a b')).toThrow();
        expect(() => serializeCookie('x', 'a,b')).toThrow();
        expect(() => serializeCookie('x', 'a"b')).toThrow();
        expect(() => serializeCookie('x', 'a\\b')).toThrow();
    });

    it('rejects an invalid cookie name', () => {
        expect(() => serializeCookie('bad name', 'v')).toThrow();
        expect(() => serializeCookie('bad;name', 'v')).toThrow();
    });
});

describe('serializeCookie flags', () => {
    it('sets HttpOnly, Secure, SameSite and Path by default', () => {
        const c = serializeCookie('s', 'v', { maxAgeSeconds: 60 });
        expect(c).toContain('HttpOnly');
        expect(c).toContain('Secure');
        expect(c).toContain('SameSite=Lax');
        expect(c).toContain('Path=/');
        expect(c).toContain('Max-Age=60');
    });

    it('always adds Secure when SameSite=None (spec requirement)', () => {
        expect(serializeCookie('s', 'v', { secure: false, sameSite: 'None' })).toContain('Secure');
    });

    it('round-trips through parseCookies', () => {
        const value = 'aaa.bbb.ccc';
        const header = serializeCookie('ottabase.session-token', value);
        const raw = header.split(';')[0]; // name=value
        expect(parseCookies(raw)['ottabase.session-token']).toBe(value);
    });
});

describe('isHttpsRequest', () => {
    it('is true for https URLs', () => {
        expect(isHttpsRequest(new Request('https://app.example.com/'))).toBe(true);
    });
    it('is false for plain http with no forwarded proto', () => {
        expect(isHttpsRequest(new Request('http://localhost/'))).toBe(false);
    });
    it('honors x-forwarded-proto=https', () => {
        expect(isHttpsRequest(new Request('http://localhost/', { headers: { 'x-forwarded-proto': 'https' } }))).toBe(true);
    });
});
