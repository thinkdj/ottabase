/**
 * Types for the @ottabase/youch error renderer.
 */

/** A single parsed stack frame */
export interface StackFrame {
    /** The raw line from the stack trace */
    raw: string;
    /** File path (if parsed) */
    file?: string;
    /** Line number (if parsed) */
    line?: number;
    /** Column number (if parsed) */
    column?: number;
    /** Function/method name (if parsed) */
    function?: string;
    /** Whether this frame is from application code (not node_modules/internal) */
    isApp: boolean;
}

/** Structured representation of a parsed error */
export interface ParsedError {
    /** Error class/constructor name (e.g., "TypeError", "ServiceError") */
    type: string;
    /** Error message */
    message: string;
    /** Parsed stack frames */
    frames: StackFrame[];
    /** Raw stack trace string */
    rawStack?: string;
    /** Error cause (chained error) */
    cause?: ParsedError;
    /** Additional properties from the error object */
    properties: Record<string, unknown>;
}

/** A metadata key-value row */
export interface MetadataRow {
    key: string;
    value: unknown;
}

/** A section within a metadata group */
export type MetadataSection = MetadataRow[];

/** A named group of metadata sections */
export interface MetadataGroup {
    name: string;
    sections: Record<string, MetadataSection>;
}

/** Options for HTML rendering */
export interface YouchHTMLOptions {
    /** Page title (default: "An error has occurred") */
    title?: string;
    /** Number of stack frames to skip from the top */
    offset?: number;
    /** Code editor for "open in editor" links (default: "vscode") */
    ide?: string;
    /** CSP nonce for inline style/script tags */
    cspNonce?: string;
}
