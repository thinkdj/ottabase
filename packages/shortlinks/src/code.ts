// Lowercase letters and digits without the lookalikes (0/o, 1/l/i): a code people can read back.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** A random short code. 31 symbols over 6 places is a billion-plus codes, so collisions stay rare. */
export function generateShortCode(length = 6): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let code = '';
    for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
    return code;
}
