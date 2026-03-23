/**
 * One-time backup codes (hashed with same PBKDF2 scheme as passwords).
 */

import { hashPassword, verifyPassword } from '../password-hash';

export async function generateBackupCodeHashes(count: number): Promise<{ codes: string[]; hashes: string[] }> {
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < count; i++) {
        const bytes = crypto.getRandomValues(new Uint8Array(5));
        let hex = '';
        for (const b of bytes) {
            hex += b.toString(16).padStart(2, '0');
        }
        const code = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8)}`;
        codes.push(code);
        hashes.push(await hashPassword(`backup:${code}`));
    }
    return { codes, hashes };
}

/**
 * Returns updated hash list with one matching code removed, or null if no match.
 */
export async function verifyAndConsumeBackupCode(plain: string, hashes: string[]): Promise<string[] | null> {
    const trimmed = plain.trim();
    if (!trimmed) return null;
    for (let i = 0; i < hashes.length; i++) {
        if (await verifyPassword(`backup:${trimmed}`, hashes[i])) {
            return hashes.filter((_, j) => j !== i);
        }
    }
    return null;
}
