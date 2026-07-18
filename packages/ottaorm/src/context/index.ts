// ============================================================
// @ottabase/ottaorm - Connection Registry
// ============================================================
//
// Multi-connection management for OttaORM
// Supports multiple named connections (e.g., 'default')
// Usage: registerConnection(name, driver), models specify connection via static property
// ============================================================

// IMPORTANT: Use globalThis to store connections to prevent module duplication issues
// This ensures all module instances share the same connection registry
declare global {
    var __OTTAORM_CONNECTIONS__: Map<string, any> | undefined;
}

// Connection registry for multi-database support
// Stored in globalThis to survive module duplication in bundlers
const connections: Map<string, any> =
    globalThis.__OTTAORM_CONNECTIONS__ || (globalThis.__OTTAORM_CONNECTIONS__ = new Map());

/**
 * Register a named database connection
 *
 * @param name - Connection name
 * @param driver - Database driver (DbDriver)
 *
 * @example
 * ```typescript
 * import { registerConnection } from "@ottabase/ottaorm";
 * import { createD1Driver } from "@ottabase/db/drizzle-d1";
 *
 * registerConnection('default', createD1Driver(env.OBCF_D1));
 * ```
 */
export function registerConnection(name: string, driver: any): void {
    connections.set(name, driver);
}

/**
 * Get a database connection by name
 * Defaults to 'default' connection if no name provided
 *
 * @param name - Connection name (defaults to 'default')
 * @throws Error if connection hasn't been registered
 *
 * @example
 * ```typescript
 * const driver = getConnection('default');
 * ```
 */
export function getConnection(name: string = 'default'): any {
    if (!connections.has(name)) {
        throw new Error(
            `Database connection '${name}' not registered. ` +
                `Call registerConnection('${name}', driver) before using models.`,
        );
    }
    return connections.get(name);
}

/**
 * Check if a connection is registered
 *
 * @param name - Connection name
 * @returns True if connection exists
 */
export function hasConnection(name: string): boolean {
    return connections.has(name);
}

/**
 * Clear a specific connection (useful for testing)
 *
 * @param name - Connection name
 */
export function clearConnection(name: string): void {
    connections.delete(name);
}

/**
 * Clear all connections (useful for testing)
 */
export function clearAllConnections(): void {
    connections.clear();
}
