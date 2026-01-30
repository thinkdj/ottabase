/**
 * Checks if an email is valid
 * @param email The email to check
 * @returns True if the email is valid, false otherwise
 */
export function isEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Changes the case of a string to the specified format
 * @param str The input string to transform
 * @param caseType The case format to convert to
 * @returns The transformed string
 */
export function changeCase(
    str: string,
    caseType:
        | 'camel'
        | 'snake'
        | 'kebab'
        | 'pascal'
        | 'title'
        | 'sentence'
        | 'lower'
        | 'upper'
        | 'constant'
        | 'path'
        | 'none',
): string {
    if (!str) return '';

    str = str.trim();

    switch (caseType) {
        case 'camel':
            return str
                .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
                .replace(/^(.)/, (c) => c.toLowerCase());

        case 'snake':
            return str
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/[\s-]+/g, '_')
                .toLowerCase();

        case 'kebab':
            return str
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase();

        case 'pascal':
            return str
                .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
                .replace(/^(.)/, (c) => c.toUpperCase());

        case 'title':
            return str.replace(/[-_\s]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        case 'sentence':
            return str
                .replace(/[-_\s]+/g, ' ')
                .replace(/^(.)|\.\s+(.)/g, (c) => c.toUpperCase())
                .trim();

        case 'lower':
            return str.toLowerCase();

        case 'upper':
            return str.toUpperCase();

        case 'constant':
            return str
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/[-\s]+/g, '_')
                .toUpperCase();

        case 'path':
            return str
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase();

        case 'none':
            return str;

        default:
            return str;
    }
}

/**
 * Extract initials from a name.
 */
export function getInitials(name: string | null | undefined, defaultInitials: string = ''): string {
    if (!name) return defaultInitials;

    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length === 0) return defaultInitials;

    // If there's no space in the name and the length is 2 or more, return the first two characters
    if (nameParts.length === 1 && name.length >= 2) {
        return name.substring(0, 2).toUpperCase();
    }

    // Get first character of first name and last name (if exists)
    const firstInitial = nameParts[0]?.charAt(0)?.toUpperCase() || '';
    const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.charAt(0)?.toUpperCase() || '' : '';

    return firstInitial + lastInitial;
}

/**
 * Check if a string is empty or contains only whitespace.
 */
export function isEmptyStr(str: string | null | undefined): boolean {
    if (!str) return true;
    return str.trim().length === 0;
}

/**
 * Convert a string to human-readable format, replacing dashes/underscores with spaces.
 */
export function humanizeString(
    input: string,
    capitalizeFirstLetter: boolean = true,
    capitalizeAllWords: boolean = false,
): string {
    if (!input) return '';

    // Replace all dashes and underscores with spaces (handle kebab-case and snake_case)
    let str = input.replace(/[-_]+/g, ' ');

    // Insert a space before each uppercase letter in camelCase words
    // and lowercase the first character if it's uppercase
    str = str
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase();
    str = str.charAt(0).toLowerCase() + str.slice(1);

    // Capitalize the first letter?
    if (capitalizeFirstLetter) str = str.charAt(0).toUpperCase() + str.slice(1);
    // Capitalize all words?
    if (capitalizeAllWords)
        str = str
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    return str;
}

/**
 * Uppercase the first letter of a string.
 */
export function ucFirst(str: string): string {
    if (!str) return '';
    str = str.trim();
    if (str.length === 0) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Replace tokens in a string with values from a replacement object.
 * Tokens are identified by a preceding identifier (default ':').
 * If a token has no corresponding key in the replacements object, it's left unchanged.
 *
 * @example
 * replaceStringTokens("Hello :name", { name: "world!" }) // "Hello world!"
 * replaceStringTokens("/blog/%id/%slug", { id: 1, slug: 'hello' }, "%") // "/blog/1/hello"
 */
export function replaceStringTokens(
    str: string,
    replacements: { [key: string]: any },
    identifier: string = ':',
): string {
    if (!str) return '';
    const escapedIdentifier = identifier.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`${escapedIdentifier}(\\w+)`, 'g');
    return str.replace(regex, (match, key) => {
        return replacements[key] !== undefined ? replacements[key].toString() : match;
    });
}

/**
 * Generate a unique alphanumeric UID that does not start with a digit.
 */
export function generateUUID(length: number, alphanumeric: boolean = true): string {
    if (length <= 0) return '';

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_~-';
    const alphaNumericChars = chars.length - 3;
    const uuidArr: string[] = new Array(length);

    if (alphanumeric) {
        for (let i = 0; i < length; i++) {
            uuidArr[i] = chars.charAt(Math.floor(Math.random() * alphaNumericChars));
        }
    } else {
        uuidArr[0] = chars.charAt(Math.floor(Math.random() * alphaNumericChars)); // Ensure the first character is alphanumeric
        for (let i = 1; i < length; i++) {
            uuidArr[i] = chars.charAt(Math.floor(Math.random() * chars.length));
        }
        uuidArr[length - 1] = chars.charAt(Math.floor(Math.random() * alphaNumericChars)); // Ensure the last character is alphanumeric
    }
    return uuidArr.join('');
}
