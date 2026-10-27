// The catalog's @types/node (20.x) predates node:sqlite; this is the slice the D1 shim uses.
declare module 'node:sqlite' {
    export class DatabaseSync {
        constructor(path: string);
        exec(sql: string): void;
        prepare(sql: string): {
            all(...params: unknown[]): Record<string, unknown>[];
            get(...params: unknown[]): Record<string, unknown> | undefined;
            run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
        };
    }
}
