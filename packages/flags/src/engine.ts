// ============================================================
// Flag Evaluation Engine
// ============================================================

import type { FlagRules } from './schema';

/**
 * Context provided when evaluating flags.
 * Typically derived from the current auth session and organization.
 */
export interface EvalContext {
    userId?: string;
    organizationId?: string;
    plan?: string; // "free" | "pro" | "enterprise" | custom
}

/**
 * A resolved flag record ready for evaluation.
 */
export interface ResolvedFlag {
    key: string;
    enabled: boolean;
    rules: FlagRules;
}

/**
 * Evaluate whether a single flag is active for the given context.
 *
 * Evaluation logic (short-circuit):
 * 1. If flag.enabled is false → false
 * 2. If no targeting rules are set → true (flag is globally on)
 * 3. If userIds rule matches → true
 * 4. If orgIds rule matches → true
 * 5. If plans rule matches → true
 * 6. If percentage rule set → deterministic hash check
 * 7. Otherwise → false (rules exist but none matched)
 */
export function evaluateFlag(flag: ResolvedFlag, ctx: EvalContext): boolean {
    if (!flag.enabled) return false;

    const rules = flag.rules;
    if (!rules) return true;

    const hasAnyRule =
        (rules.userIds && rules.userIds.length > 0) ||
        (rules.orgIds && rules.orgIds.length > 0) ||
        (rules.plans && rules.plans.length > 0) ||
        (rules.percentage !== undefined && rules.percentage !== null);

    // No targeting rules → globally enabled
    if (!hasAnyRule) return true;

    // User allowlist
    if (rules.userIds && rules.userIds.length > 0 && ctx.userId) {
        if (rules.userIds.includes(ctx.userId)) return true;
    }

    // Org allowlist
    if (rules.orgIds && rules.orgIds.length > 0 && ctx.organizationId) {
        if (rules.orgIds.includes(ctx.organizationId)) return true;
    }

    // Plan-based gating
    if (rules.plans && rules.plans.length > 0 && ctx.plan) {
        if (rules.plans.includes(ctx.plan)) return true;
    }

    // Percentage rollout (deterministic by userId + flagKey)
    if (rules.percentage !== undefined && rules.percentage !== null && ctx.userId) {
        const hash = simpleHash(`${flag.key}:${ctx.userId}`);
        const bucket = hash % 100;
        if (bucket < rules.percentage) return true;
    }

    return false;
}

/**
 * Evaluate multiple flags at once. Returns a map of key → boolean.
 */
export function evaluateFlags(flags: ResolvedFlag[], ctx: EvalContext): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const flag of flags) {
        result[flag.key] = evaluateFlag(flag, ctx);
    }
    return result;
}

/**
 * Simple deterministic hash for percentage rollouts.
 * FNV-1a 32-bit hash — fast, well-distributed, no crypto dependency.
 */
function simpleHash(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash >>> 0;
}
