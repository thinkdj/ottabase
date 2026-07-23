import { customType } from 'drizzle-orm/sqlite-core';

/**
 * SQLite TEXT column that owns its JSON mapping and isolates malformed legacy
 * values to the affected field. The physical column remains TEXT, so adopting
 * this mapper does not require a migration.
 *
 * Database/query failures are deliberately not handled here. They must still
 * propagate so callers do not confuse an unavailable or unauthorized database
 * with an empty Studio configuration.
 */
export function tolerantJsonText<T>(columnName: string) {
    let hasLoggedInvalidValue = false;

    return customType<{ data: T | null; driverData: string | null }>({
        dataType() {
            return 'text';
        },
        toDriver(value) {
            return value === null ? null : JSON.stringify(value);
        },
        fromDriver(value) {
            if (value === null) return null;

            try {
                return JSON.parse(value) as T;
            } catch {
                // Avoid logging stored content, which may contain tenant data.
                // Log once per isolate/column to retain an operational signal
                // without flooding logs on every public blog request.
                if (!hasLoggedInvalidValue) {
                    hasLoggedInvalidValue = true;
                    console.error(
                        `Ottablog: invalid JSON in ${columnName}; treating this field as null until the row is repaired`,
                    );
                }
                return null;
            }
        },
    })(columnName);
}
