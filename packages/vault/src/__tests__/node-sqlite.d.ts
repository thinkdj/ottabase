// The slice of Node's built-in SQLite (node >= 22.13) the tests use. `@types/node` 20 predates it.
declare module 'node:sqlite' {
    export type SQLInputValue = null | number | bigint | string | Uint8Array;
    export interface StatementSync {
        all(...params: SQLInputValue[]): Array<Record<string, unknown>>;
        run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    }
    export class DatabaseSync {
        constructor(path: string);
        exec(sql: string): void;
        prepare(sql: string): StatementSync;
        close(): void;
    }
}
