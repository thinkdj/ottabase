import type { StackFrame, ParsedError } from './types.js';

/**
 * Regex patterns for parsing stack trace lines.
 * Handles V8 (Chrome/Node/Workers), SpiderMonkey (Firefox), and JavaScriptCore (Safari).
 */
const V8_FRAME_RE = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/;
const V8_NATIVE_RE = /^\s*at\s+(.+?)\s+\(<anonymous>\)$/;
const V8_EVAL_RE = /^\s*at\s+(?:(.+?)\s+\()?eval\s+at\s+.+?,\s*(.+?):(\d+):(\d+)\)?$/;

/**
 * Parse a single stack trace line into a StackFrame.
 */
function parseFrame(line: string): StackFrame | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'Error' || !trimmed.startsWith('at ')) {
        // Try non-V8 format (Firefox/Safari): "functionName@file:line:col"
        const atIdx = trimmed.indexOf('@');
        if (atIdx > -1) {
            const fnName = trimmed.slice(0, atIdx);
            const rest = trimmed.slice(atIdx + 1);
            const match = rest.match(/^(.+?):(\d+):(\d+)$/);
            if (match) {
                const file = match[1];
                return {
                    raw: line,
                    file,
                    line: parseInt(match[2], 10),
                    column: parseInt(match[3], 10),
                    function: fnName || undefined,
                    isApp: isAppFrame(file),
                };
            }
        }
        if (!trimmed.startsWith('at ')) return null;
    }

    // Try eval frame
    let match = trimmed.match(V8_EVAL_RE);
    if (match) {
        return {
            raw: line,
            file: match[2],
            line: parseInt(match[3], 10),
            column: parseInt(match[4], 10),
            function: match[1] || 'eval',
            isApp: isAppFrame(match[2]),
        };
    }

    // Try native/anonymous frame
    match = trimmed.match(V8_NATIVE_RE);
    if (match) {
        return {
            raw: line,
            function: match[1],
            isApp: false,
        };
    }

    // Try standard V8 frame
    match = trimmed.match(V8_FRAME_RE);
    if (match) {
        const file = match[2];
        return {
            raw: line,
            file,
            line: parseInt(match[3], 10),
            column: parseInt(match[4], 10),
            function: match[1] || undefined,
            isApp: isAppFrame(file),
        };
    }

    // Fallback: plain "at something" line
    return {
        raw: line,
        function: trimmed.replace(/^\s*at\s+/, ''),
        isApp: false,
    };
}

/**
 * Determine whether a file path is application code (not node_modules or internal).
 */
function isAppFrame(file: string): boolean {
    if (!file) return false;
    if (file.includes('node_modules')) return false;
    if (file.startsWith('node:') || file.startsWith('internal/')) return false;
    if (file === '<anonymous>' || file.includes('wrangler')) return false;
    return true;
}

/**
 * Safely extract extra properties from an error object (beyond the standard fields).
 */
function extractProperties(error: unknown): Record<string, unknown> {
    if (!(error instanceof Error)) {
        return typeof error === 'object' && error !== null ? { ...(error as object) } : {};
    }

    const props: Record<string, unknown> = {};
    const skip = new Set(['name', 'message', 'stack', 'cause']);

    for (const key of Object.getOwnPropertyNames(error)) {
        if (!skip.has(key)) {
            try {
                props[key] = (error as unknown as Record<string, unknown>)[key];
            } catch {
                // skip non-readable properties
            }
        }
    }

    return props;
}

/**
 * Parse an error (or unknown thrown value) into a structured ParsedError.
 *
 * @param error - The error to parse
 * @param offset - Number of frames to skip from the top of the stack
 */
export function parseError(error: unknown, offset: number = 0): ParsedError {
    // Handle non-Error values
    if (!(error instanceof Error)) {
        return {
            type: typeof error === 'object' && error !== null ? error.constructor?.name || 'Object' : typeof error,
            message: String(error),
            frames: [],
            properties: extractProperties(error),
        };
    }

    const type = error.constructor?.name || 'Error';
    const message = error.message || '';
    const rawStack = error.stack || '';

    // Parse stack frames
    const lines = rawStack.split('\n');
    const frames: StackFrame[] = [];
    for (const line of lines) {
        const frame = parseFrame(line);
        if (frame) {
            frames.push(frame);
        }
    }

    // Apply offset
    const offsetFrames = offset > 0 ? frames.slice(offset) : frames;

    // Parse cause recursively
    const errorCause = (error as unknown as Record<string, unknown>).cause;
    const cause = errorCause ? parseError(errorCause) : undefined;

    return {
        type,
        message,
        frames: offsetFrames,
        rawStack,
        cause,
        properties: extractProperties(error),
    };
}
