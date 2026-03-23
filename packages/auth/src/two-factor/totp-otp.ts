import { authenticator } from 'otplib';

authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
    return authenticator.generateSecret();
}

export function buildOtpauthUrl(params: { issuer: string; accountName: string; secret: string }): string {
    const label = `${params.issuer}:${params.accountName}`;
    const enc = encodeURIComponent;
    return `otpauth://totp/${enc(label)}?secret=${enc(params.secret)}&issuer=${enc(params.issuer)}&period=30&digits=6&algorithm=SHA1`;
}

export function verifyTotpToken(secretBase32: string, token: string): boolean {
    const cleaned = token.replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) return false;
    return authenticator.verify({ token: cleaned, secret: secretBase32 });
}
