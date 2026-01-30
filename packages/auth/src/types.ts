// ============================================================
// @ottabase/auth - Type Definitions
// ============================================================

/**
 * Auth configuration options
 */
export interface AuthConfig {
    /** Enable debug mode */
    debug?: boolean;
    /** Session strategy: "jwt" or "database" */
    session?: {
        strategy?: 'jwt' | 'database';
        maxAge?: number;
    };
}
