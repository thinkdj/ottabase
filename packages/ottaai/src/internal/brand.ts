// ============================================================
// @ottabase/ottaai — INTERNAL. Not exported from any entry point.
// ============================================================
// This module exists so that "an `AiContext` has no public constructor" is a
// property of the package's EXPORT MAP rather than a promise in a doc comment.
//
// `brandContext` previously lived in `types.ts`, which the root barrel re-exports
// wholesale (`export * from './types'`) — so the one function the design says must
// be unreachable was importable by every consumer. Nothing here is listed in
// `package.json#exports`, and nothing in `src/index.ts` re-exports it.
//
// If you need to widen this, do not. Add a method to the provisioning instance
// instead: `contextFrom` is the seam, and it is the only place a host's auth type
// is allowed to become a resolution context.
// ============================================================

import type { AiContext, AiTenancyTuple } from '../types';

/**
 * The single place in the package that mints the brand.
 *
 * FROZEN on the way out: the resolver passes the context through membership verification
 * and then into scoring, and a mutable tuple would let a later stage widen the tenancy it
 * was verified against.
 */
export function brandContext(tuple: AiTenancyTuple): AiContext {
    return Object.freeze({ ...tuple }) as AiContext;
}
