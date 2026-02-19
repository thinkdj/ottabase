/**
 * Interface for parsed name and email
 */
export interface ParsedNameEmail {
    name: string;
    email: string;
}

/**
 * Parse a string to extract name and email in the format "Name <email>".
 * @example parseNameAndEmail("John Doe <john@example.com>") // { name: "John Doe", email: "john@example.com" }
 */
export function parseNameAndEmail(str: string): ParsedNameEmail {
    if (!str) return { name: '', email: '' };

    const regex = /(.+?)? ?<(.+?)>/;
    const match = str.match(regex);

    if (match && match.length === 3) {
        return {
            name: (match[1] || '').trim(),
            email: (match[2] || '').trim(),
        };
    } else if (str.includes('@')) {
        return { name: '', email: str.trim() };
    } else {
        return { name: '', email: '' };
    }
}

/**
 * Parse a string to extract only the email address from the format "Name <email>".
 * @example parseEmailId("John Doe <john@example.com>") // "john@example.com"
 */
export function parseEmailId(str: string): string {
    return parseNameAndEmail(str).email;
}

/**
 * Decode a URL-safe base64 encoded string.
 * Converts URL-safe base64 to regular base64 and decodes it.
 */
export function urlSafeBase64Decode(encodedString: string): string {
    if (!encodedString) return '';

    try {
        // Convert from URL-safe base64 to regular base64
        const base64String = encodedString.replace(/-/g, '+').replace(/_/g, '/');
        // Pad the base64 string if needed
        const paddedBase64String = base64String.padEnd(
            base64String.length + ((4 - (base64String.length % 4)) % 4),
            '=',
        );
        // Decode the base64 string
        return Buffer.from(paddedBase64String, 'base64').toString('utf-8');
    } catch (error) {
        console.error('Failed to decode URL-safe base64 string:', error);
        return '';
    }
}

/**
 * Encode a string to URL-safe base64.
 * Converts regular base64 to URL-safe base64 by replacing + with - and / with _.
 */
export function urlSafeBase64Encode(str: string): string {
    if (!str) return '';

    try {
        const base64String = Buffer.from(str, 'utf-8').toString('base64');
        return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (error) {
        console.error('Failed to encode to URL-safe base64:', error);
        return '';
    }
}
