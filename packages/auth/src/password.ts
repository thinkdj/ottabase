/**
 * Password policy: one source of truth for the forms (live checklist) and the
 * worker (server-side check). Dependency-free, so it is safe on the edge.
 */

export interface PasswordRule {
    id: 'length' | 'lower' | 'upper' | 'number' | 'symbol';
    /** Short, human label shown in the checklist */
    label: string;
    test: (password: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: readonly PasswordRule[] = [
    { id: 'length', label: `${PASSWORD_MIN_LENGTH}+ characters`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
    { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
    { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { id: 'number', label: 'A number', test: (p) => /\d/.test(p) },
    { id: 'symbol', label: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** One sentence describing the policy, for error messages */
export const PASSWORD_POLICY_MESSAGE = `Use at least ${PASSWORD_MIN_LENGTH} characters with an uppercase letter, a lowercase letter, a number and a symbol.`;

/** Each rule with whether the password meets it */
export function checkPassword(password: string): { rule: PasswordRule; met: boolean }[] {
    return PASSWORD_RULES.map((rule) => ({ rule, met: rule.test(password) }));
}

export function isStrongPassword(password: string): boolean {
    return PASSWORD_RULES.every((rule) => rule.test(password));
}
