/**
 * Safely parse a JSON string with a default fallback value.
 */
function safeJSONParse<T = any>(str: string, defaultValue: T = {} as T): T {
    if (!str) return defaultValue;

    try {
        return JSON.parse(str);
    } catch (error) {
        return defaultValue;
    }
}

/**
 * Parse JSON from a string with optional sanitization.
 * Useful for extracting JSON from AI responses or mixed content.
 *
 * @param str - The string containing JSON
 * @param sanitize - Whether to extract JSON between first { and last }
 * @returns Parsed JSON object or null if parsing fails
 *
 * @example
 * parseJsonFromString('Some text {"key": "value"} more text', true) // { key: "value" }
 */
export function parseJsonFromString(str: string, sanitize: boolean = true): unknown | null {
    if (!str) return null;

    try {
        let sanitizedStr = str;

        if (sanitize) {
            const firstOpeningBraceIndex = str.indexOf('{');
            const lastClosingBraceIndex = str.lastIndexOf('}');

            if (firstOpeningBraceIndex === -1 || lastClosingBraceIndex === -1) {
                return null;
            }

            sanitizedStr = str.slice(firstOpeningBraceIndex, lastClosingBraceIndex + 1);
        }

        return safeJSONParse(sanitizedStr, null);
    } catch (error) {
        console.error('[parseJsonFromString] Error parsing JSON:', error);
        return null;
    }
}

/**
 * Safely stringify an object to JSON with error handling.
 */
export function safeStringify(obj: any, space?: number): string {
    if (obj === null || obj === undefined) return '';

    try {
        return JSON.stringify(obj, null, space);
    } catch (error) {
        console.error('[safeStringify] Error stringifying object:', error);
        return '';
    }
}

/**
 * Deep clone an object using JSON parse/stringify.
 * Note: This method has limitations with functions, dates, etc.
 */
export function deepClone<T>(obj: T): T | null {
    if (obj === null || obj === undefined) return null;

    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (error) {
        console.error('[deepClone] Error cloning object:', error);
        return null;
    }
}

/**
 * Check if a string is valid JSON.
 */
export function isValidJson(str: string): boolean {
    if (!str) return false;

    try {
        JSON.parse(str);
        return true;
    } catch (error) {
        return false;
    }
}
