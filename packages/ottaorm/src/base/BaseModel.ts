// ============================================================
// @ottabase/ottaorm - Base Model (Fat Model Pattern)
// ============================================================
// SQL-specific implementation using Drizzle ORM
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import {
    and,
    asc,
    desc,
    eq,
    getTableColumns,
    gt,
    gte,
    inArray,
    isNotNull,
    isNull,
    like,
    lt,
    lte,
    ne,
    or,
    sql,
} from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getConnection } from '../context';
import { ValidationError } from '../validation';
import { getOttaORMMaxAllRows, OttaORMAllRowsLimitError } from '../runtime-config';
import {
    AbstractBaseModel,
    ModelFieldDescriptor,
    ModelFieldType,
    ModelFields,
    PackageType,
    PaginationResult,
} from './AbstractBaseModel';

export interface IModelConstructorParams {
    entity: string;
    data: { [key: string]: any };
    /**
     * Columns the query did not SELECT (see `BaseModel.deferred`). Reading one throws rather than
     * returning undefined, so a collection-loaded record can never be mistaken for a complete one.
     */
    omitted?: string[];
}

// Re-export types
export type { ModelFieldDescriptor, ModelFieldType, ModelFields, PackageType, PaginationResult };

export interface CollectionQueryOptions {
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    /** Column projection — narrows the SELECT to these fields. */
    select?: string[];
    /** Load deferred columns too. */
    withDeferred?: boolean;
}

export interface KeysetPagesOptions {
    where?: Record<string, any>;
    perPage?: number;
    orderDirection?: 'asc' | 'desc';
    select?: string[];
    withDeferred?: boolean;
}

/** Trusted predicates that must still match in the statement that mutates a row. */
export interface AtomicMutationGuard {
    /** RLS/ownership predicates derived by the server, never by the request body. */
    where: Record<string, any>;
    /** Optimistic concurrency predicates captured from the authorized row. */
    expected?: Record<string, unknown>;
}

export interface UpdateMutationContext {
    id: string | number;
    currentData?: Record<string, unknown>;
    driver?: DbDriver;
}

/** The authorized snapshot changed before its guarded mutation committed. */
export class ConcurrentMutationError extends Error {
    constructor(entity: string) {
        super(`${entity} changed before the mutation could be applied`);
        this.name = 'ConcurrentMutationError';
    }
}

/** A predicate cannot be represented within D1's per-statement binding limit. */
export class QueryBindingLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QueryBindingLimitError';
    }
}

const DEFAULT_KEYSET_PAGE_SIZE = 1000;
const D1_BOUND_PARAMETER_LIMIT = 100;
/** LIMIT and OFFSET can each be emitted as a bound parameter by Drizzle. */
const D1_COLLECTION_RESERVED_BINDINGS = 2;
const D1_FILTER_BINDING_BUDGET = D1_BOUND_PARAMETER_LIMIT - D1_COLLECTION_RESERVED_BINDINGS;
/** Prevent a hostile Cartesian filter from creating unbounded D1 round trips. */
// A paginated read can execute each plan twice (count + rows). Keep enough
// headroom below D1's per-invocation query budget for auth and route work.
const MAX_FILTER_QUERY_PLANS = 16;
export const MAX_SEARCH_TERM_BYTES = 48;
const AGGREGATE_MERGE_PAGE_SIZE = 100;

interface FilterListLocation {
    path: Array<string | number>;
    values: unknown[];
}

interface FilterQueryPlan {
    where: Record<string, any>;
}

/**
 * Type guard to check if a connection is a SQL driver
 */
function isSqlDriver(driver: any): driver is DbDriver {
    return driver && typeof driver.getDb === 'function';
}

/**
 * Base Model class - Fat Model Pattern for SQL databases
 *
 * All metadata lives in the model class as static properties:
 * - entity: table name
 * - table: Drizzle table definition
 * - primaryKey: primary key field name
 * - connection: database connection name (default: 'default')
 * - casts: type casting rules
 * - connect: relationship definitions
 * - with: default eager loading
 * - fields: complete field metadata
 * - validationRules: validation rules
 * - defaults: default values
 *
 * @example
 * ```typescript
 * export class Post extends BaseModel {
 *   static entity = "posts";
 *   static table = postsTable;
 *   static primaryKey = "id";
 *   static connection = "default";  // Optional, this is the default
 *
 *   static casts = {
 *     createdAt: 'date',
 *     published: 'boolean'
 *   };
 *
 *   static connect = [
 *     'author:id{name,email}',
 *     'tags[]:id{name,slug}>join:tag,model:Tag'
 *   ];
 *
 *   static fields: ModelFields = {
 *     title: {
 *       type: 'string',
 *       searchable: true,
 *       uiConfig: { label: 'Title' }
 *     }
 *   };
 * }
 * ```
 */
export class BaseModel extends AbstractBaseModel {
    // SQL-specific static property
    static table: SQLiteTable;

    /**
     * Enable soft deletes for this model.
     * When true, `delete()` sets `deletedAt` instead of removing the row,
     * and all queries automatically exclude soft-deleted records.
     * The table must have a `deletedAt` column (integer timestamp or null).
     */
    static softDeletes: boolean = false;

    constructor(params: IModelConstructorParams) {
        super();
        this.fill(params.data);
        if (params.omitted?.length) this.omitted = [...params.omitted];
    }

    // ============================================================
    // STATIC QUERY METHODS
    // ============================================================

    /**
     * Get table definition
     */
    protected static getTable(): SQLiteTable {
        if (!this.table) {
            throw new Error(`Table not defined for ${this.entity}`);
        }
        return this.table;
    }

    /**
     * Whether a column exists on this model's table, addressed by its model
     * property name (e.g. "organizationId", not the DB column "organization_id").
     *
     * The RLS layer uses this to FAIL CLOSED: `buildWhereConditions` silently
     * drops `where` keys that aren't real columns, so an RLS filter referencing a
     * mistyped/missing column would otherwise evaporate and run an unfiltered query.
     */
    static hasColumn(field: string): boolean {
        const table = this.table as any;
        return !!table && !!table[field];
    }

    /**
     * Get database driver for this model's connection
     * Uses the connection specified in static connection property
     */
    protected static getDriver(driver?: DbDriver): DbDriver {
        if (driver) return driver;

        const connection = getConnection(this.connection);
        if (!isSqlDriver(connection)) {
            throw new Error(
                `Connection '${this.connection}' is not a SQL driver for model ${this.entity}. ` +
                    `Make sure you registered a SQL driver (e.g., D1Driver) for this connection.`,
            );
        }
        return connection;
    }

    /**
     * Return a scoped query object that includes soft-deleted records.
     * Thread-safe: no shared mutable state is used.
     *
     * @example
     * ```typescript
     * const allPosts = await Post.withTrashed().where({});
     * ```
     */
    static withTrashed<T extends typeof BaseModel>(this: T) {
        return {
            find: (id: string | number, driver?: DbDriver) => this.find(id, driver, true),
            first: (where?: Record<string, any>, driver?: DbDriver) => this.first(where, driver, true),
            where: (where: Record<string, any>, options?: CollectionQueryOptions, driver?: DbDriver) =>
                this.where(where, options, driver, true),
            whereIn: (field: string, values: any[], options?: CollectionQueryOptions, driver?: DbDriver) =>
                this.whereIn(field, values, options, driver, true),
            all: (options?: CollectionQueryOptions, driver?: DbDriver) => this.readAll(options, driver, true),
            pages: (options?: KeysetPagesOptions, driver?: DbDriver) => this.pages(options, driver, true),
            count: (where?: Record<string, any>, driver?: DbDriver) => this.count(where, driver, true),
            search: (
                search: string,
                fields: string[],
                where?: Record<string, any>,
                options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
                driver?: DbDriver,
            ) => this.search(search, fields, where, options, driver, true),
            searchPaginate: (
                search: string,
                fields: string[],
                page?: number,
                perPage?: number,
                where?: Record<string, any>,
                options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' },
                driver?: DbDriver,
            ) => this.searchPaginate(search, fields, page, perPage, where, options, driver, true),
        };
    }

    /**
     * Query only soft-deleted records.
     *
     * @example
     * ```typescript
     * const deleted = await Post.onlyTrashed({});
     * ```
     */
    static onlyTrashed<T extends typeof BaseModel>(
        this: T,
        where?: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        },
        driver?: DbDriver,
    ): Promise<InstanceType<T>[]> {
        const trashedWhere = { ...where, deletedAt: { $ne: null } };
        // includeTrashed = true so the auto-filter doesn't exclude the $ne: null condition
        return this.where(trashedWhere, options, driver, true);
    }

    /**
     * Columns a COLLECTION read skips.
     *
     * Lists, feeds, and sitemaps rarely touch a model's largest columns, but they pay for them on
     * every row: the bytes leave the database, get parsed in the worker, and are serialized into a
     * response that discards them. Naming those columns here removes them from the SELECT that
     * `where`/`whereIn`/`all`/`paginate` build. Single-record reads (`find`, `first`) never defer,
     * so the field is always there when a detail view asks for it.
     *
     * A DENYLIST on purpose: a new column shows up in lists by default, and only the expensive
     * ones opt out. The reverse would silently drop new columns until someone noticed.
     *
     * NOT a privacy control. Deferral applies to collection reads only, so a single-record read
     * still loads and serializes the column. Anything that must never reach a caller belongs in
     * `hidden`, or in the strip performed by that route's own serializer.
     *
     * @example
     * static deferred = ['content', 'footnotes'];
     */
    static deferred: string[] = [];

    /**
     * Plan a collection read: which columns to SELECT, and which the resulting instances will
     * therefore be missing.
     *
     * An explicit `select` wins over `deferred` — a caller asking for three columns has already
     * said what it wants. The primary key is forced into either projection: without it the
     * resulting instances cannot `save()`, `refresh()`, or `destroy()`, which fails far from here.
     *
     * `omitted` is handed to each instance so reading one of those fields throws instead of
     * returning undefined. Silence is the dangerous outcome: `if (!content) return;` becomes a
     * no-op, and `this.get(x) ?? null` written back through `set` turns a lazy read into DATA LOSS.
     */
    protected static buildCollectionRead(
        select?: string[],
        withDeferred?: boolean,
    ): { projection: Record<string, any> | null; omitted: string[] } {
        const table = this.getTable();
        const columns = getTableColumns(table as any);
        const projection: Record<string, any> = {};

        if (select?.length) {
            for (const name of [...select, this.primaryKey]) {
                const column = (table as any)[name];
                if (column) projection[name] = column;
            }
            if (Object.keys(projection).length === 0) return { projection: null, omitted: [] };
            return { projection, omitted: Object.keys(columns).filter((name) => !(name in projection)) };
        }

        const deferred = Array.isArray(this.deferred) ? this.deferred : [];
        if (withDeferred || deferred.length === 0) return { projection: null, omitted: [] };

        for (const [name, column] of Object.entries(columns)) {
            if (name === this.primaryKey || !deferred.includes(name)) projection[name] = column;
        }
        return { projection, omitted: Object.keys(columns).filter((name) => !(name in projection)) };
    }

    /**
     * Build the soft-delete exclusion condition if applicable.
     * Pure function — no shared mutable state.
     *
     * @param includeTrashed - When true, skip the soft-delete filter
     */
    protected static getSoftDeleteCondition(includeTrashed?: boolean): ReturnType<typeof isNull> | null {
        if (!this.softDeletes) return null;
        if (includeTrashed) return null;
        const table = this.getTable();
        const deletedAtCol = (table as any).deletedAt;
        if (!deletedAtCol) return null;
        return isNull(deletedAtCol);
    }

    /** Apply deterministic ordering, including the primary key as a tie-breaker. */
    private static applyStableOrder<T extends typeof BaseModel>(
        this: T,
        query: any,
        options?: Pick<CollectionQueryOptions, 'orderBy' | 'orderDirection'>,
    ): any {
        const table = this.getTable();
        const direction = options?.orderDirection === 'desc' ? 'desc' : 'asc';
        const orderColumn = (table as any)[options?.orderBy ?? this.primaryKey] ?? (table as any)[this.primaryKey];
        if (!orderColumn) return query;

        const order = direction === 'desc' ? desc(orderColumn) : asc(orderColumn);
        if (options?.orderBy && options.orderBy !== this.primaryKey) {
            const primaryKeyColumn = (table as any)[this.primaryKey];
            return query.orderBy(order, direction === 'desc' ? desc(primaryKeyColumn) : asc(primaryKeyColumn));
        }
        return query.orderBy(order);
    }

    /** Validate and normalize a collection window before it reaches Drizzle. */
    private static collectionWindow(options?: CollectionQueryOptions): {
        limit: number | undefined;
        offset: number;
        chunkLimit: number | undefined;
    } {
        const limit = options?.limit;
        const offset = options?.offset ?? 0;

        if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
            throw new TypeError('Collection limit must be a non-negative safe integer');
        }
        if (!Number.isSafeInteger(offset) || offset < 0) {
            throw new TypeError('Collection offset must be a non-negative safe integer');
        }

        const chunkLimit = limit === undefined ? undefined : offset + limit;
        if (chunkLimit !== undefined && !Number.isSafeInteger(chunkLimit)) {
            throw new TypeError('Collection offset + limit must be a safe integer');
        }
        return { limit, offset, chunkLimit };
    }

    /** Count the values Drizzle will bind for a supported where object. */
    private static countFilterBindings(value: unknown): number {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;

        let count = 0;
        for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
            if (key === '$and' || key === '$or') {
                if (!Array.isArray(rawValue)) throw new TypeError(`${key} must be an array of where objects`);
                count += rawValue.reduce<number>((total, child) => total + this.countFilterBindings(child), 0);
                continue;
            }

            if (rawValue === null || rawValue === undefined) continue;
            if (Array.isArray(rawValue)) {
                count += new Set(rawValue).size;
                continue;
            }

            if (typeof rawValue === 'object') {
                let recognized = false;
                for (const [operator, operand] of Object.entries(rawValue as Record<string, unknown>)) {
                    if (operator === '$in') {
                        if (!Array.isArray(operand)) throw new TypeError('$in must be an array');
                        count += new Set(operand).size;
                        recognized = true;
                    } else if (['$eq', '$ne', '$gt', '$gte', '$lt', '$lte'].includes(operator)) {
                        if (operand !== null && operand !== undefined) count += 1;
                        recognized = true;
                    }
                }
                if (!recognized) count += 1;
                continue;
            }

            count += 1;
        }
        return count;
    }

    /** Locate every legacy-array and `$in` list, including nested boolean groups. */
    private static collectFilterLists(
        value: unknown,
        path: Array<string | number> = [],
        locations: FilterListLocation[] = [],
    ): FilterListLocation[] {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return locations;

        for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
            if (key === '$and' || key === '$or') {
                if (!Array.isArray(rawValue)) throw new TypeError(`${key} must be an array of where objects`);
                rawValue.forEach((child, index) => this.collectFilterLists(child, [...path, key, index], locations));
                continue;
            }

            if (Array.isArray(rawValue)) {
                if (rawValue.length > 0) {
                    locations.push({ path: [...path, key], values: [...new Set(rawValue)] });
                }
                continue;
            }

            if (rawValue && typeof rawValue === 'object' && '$in' in rawValue) {
                const operand = (rawValue as Record<string, unknown>).$in;
                if (!Array.isArray(operand)) throw new TypeError('$in must be an array');
                if (operand.length > 0) {
                    locations.push({ path: [...path, key, '$in'], values: [...new Set(operand)] });
                }
            }
        }
        return locations;
    }

    private static replaceFilterPath(value: unknown, path: Array<string | number>, replacement: unknown): unknown {
        if (path.length === 0) return replacement;
        const [head, ...tail] = path;
        const clone = Array.isArray(value)
            ? [...value]
            : value && typeof value === 'object'
              ? { ...(value as Record<string, unknown>) }
              : {};
        (clone as any)[head] = this.replaceFilterPath((value as any)?.[head], tail, replacement);
        return clone;
    }

    /**
     * Split all list predicates together so every emitted statement stays within
     * its complete binding budget. The plans may overlap when a list occurs under
     * OR; callers therefore merge by primary key rather than summing blindly.
     */
    private static planFilterQueries(where: Record<string, any>, maxBindings: number): FilterQueryPlan[] {
        if (!Number.isSafeInteger(maxBindings) || maxBindings < 0) {
            throw new QueryBindingLimitError('No D1 bindings remain for this filter');
        }

        const locations = this.collectFilterLists(where);
        let normalized = where;
        for (const location of locations) {
            normalized = this.replaceFilterPath(normalized, location.path, location.values) as Record<string, any>;
        }

        const bindingCount = this.countFilterBindings(normalized);
        if (bindingCount <= maxBindings) return [{ where: normalized }];

        const listBindings = locations.reduce((total, location) => total + location.values.length, 0);
        const fixedBindings = bindingCount - listBindings;
        const splittable = locations.filter((location) => location.values.length > 0);
        const availableForLists = maxBindings - fixedBindings;

        if (fixedBindings > maxBindings || splittable.length === 0 || availableForLists < splittable.length) {
            throw new QueryBindingLimitError(
                `Filter for ${this.entity} requires ${bindingCount} bound parameters and cannot be safely split`,
            );
        }

        // Give each list one binding, then distribute the remaining budget to
        // the list with the greatest current pressure. This avoids the N*M
        // explosion caused by splitting one complete list before considering
        // the others.
        const chunkSizes = splittable.map(() => 1);
        let remaining = availableForLists - splittable.length;
        while (remaining > 0) {
            let best = -1;
            let bestPressure = -1;
            for (let index = 0; index < splittable.length; index += 1) {
                const length = splittable[index].values.length;
                if (chunkSizes[index] >= length) continue;
                const pressure = length / chunkSizes[index];
                if (pressure > bestPressure) {
                    best = index;
                    bestPressure = pressure;
                }
            }
            if (best === -1) break;
            chunkSizes[best] += 1;
            remaining -= 1;
        }

        const plannedCount = splittable.reduce(
            (total, location, index) => total * Math.ceil(location.values.length / chunkSizes[index]),
            1,
        );
        if (!Number.isSafeInteger(plannedCount) || plannedCount > MAX_FILTER_QUERY_PLANS) {
            throw new QueryBindingLimitError(
                `Filter for ${this.entity} expands to ${plannedCount} statements; maximum is ${MAX_FILTER_QUERY_PLANS}`,
            );
        }

        let plans: Record<string, any>[] = [normalized];
        splittable.forEach((location, index) => {
            const chunks: unknown[][] = [];
            for (let start = 0; start < location.values.length; start += chunkSizes[index]) {
                chunks.push(location.values.slice(start, start + chunkSizes[index]));
            }
            plans = plans.flatMap((plan) =>
                chunks.map((chunk) => this.replaceFilterPath(plan, location.path, chunk) as Record<string, any>),
            );
        });

        for (const plan of plans) {
            const plannedBindings = this.countFilterBindings(plan);
            if (plannedBindings > maxBindings) {
                throw new QueryBindingLimitError(
                    `Internal filter planner exceeded D1 binding budget (${plannedBindings} > ${maxBindings})`,
                );
            }
        }
        return plans.map((plan) => ({ where: plan }));
    }

    /** Match the deterministic database order when merging disjoint IN chunks. */
    private static compareCollectionValues(left: unknown, right: unknown): number {
        if (Object.is(left, right)) return 0;
        if (left === undefined || left === null) return -1;
        if (right === undefined || right === null) return 1;

        const leftValue = left instanceof Date ? left.getTime() : left;
        const rightValue = right instanceof Date ? right.getTime() : right;
        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            if (leftValue < rightValue) return -1;
            if (leftValue > rightValue) return 1;
            return 0;
        }
        if (typeof leftValue === 'bigint' && typeof rightValue === 'bigint') {
            if (leftValue < rightValue) return -1;
            if (leftValue > rightValue) return 1;
            return 0;
        }
        if (typeof leftValue === 'string' && typeof rightValue === 'string') {
            return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
        }
        if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
            return leftValue === rightValue ? 0 : leftValue ? 1 : -1;
        }

        const leftText = String(leftValue);
        const rightText = String(rightValue);
        return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
    }

    private static sortAndWindowChunkedRows<T extends typeof BaseModel>(
        this: T,
        rows: InstanceType<T>[],
        options?: CollectionQueryOptions,
    ): InstanceType<T>[] {
        const { limit, offset } = this.collectionWindow(options);
        const orderField = options?.orderBy ?? this.primaryKey;
        const direction = options?.orderDirection === 'desc' ? -1 : 1;

        rows.sort((left, right) => {
            const ordered = this.compareCollectionValues(left.get(orderField), right.get(orderField));
            if (ordered !== 0) return ordered * direction;
            if (orderField === this.primaryKey) return 0;
            return this.compareCollectionValues(left.get(this.primaryKey), right.get(this.primaryKey)) * direction;
        });

        return rows.slice(offset, limit === undefined ? undefined : offset + limit);
    }

    private static deduplicateCollectionRows<T extends typeof BaseModel>(
        this: T,
        rows: InstanceType<T>[],
    ): InstanceType<T>[] {
        const byPrimaryKey = new Map<unknown, InstanceType<T>>();
        for (const row of rows) {
            byPrimaryKey.set(row.get(this.primaryKey), row);
        }
        return [...byPrimaryKey.values()];
    }

    /** Add merge-only columns to chunk reads, then remove them before returning. */
    private static chunkExecutionOptions(
        options: CollectionQueryOptions | undefined,
        limit: number | undefined,
    ): CollectionQueryOptions {
        const required = [this.primaryKey, options?.orderBy ?? this.primaryKey];
        return {
            ...options,
            offset: undefined,
            limit,
            withDeferred: true,
            ...(options?.select?.length ? { select: [...new Set([...options.select, ...required])] } : {}),
        };
    }

    private static restoreRequestedProjection<T extends typeof BaseModel>(
        this: T,
        rows: InstanceType<T>[],
        options?: CollectionQueryOptions,
    ): InstanceType<T>[] {
        const { projection, omitted } = this.buildCollectionRead(options?.select, options?.withDeferred);
        if (!projection) return rows;
        const selected = Object.keys(projection);
        return rows.map((row) => {
            const data = Object.fromEntries(selected.map((field) => [field, row.attributes[field]]));
            return new this({ entity: this.entity, data, omitted }) as InstanceType<T>;
        });
    }

    /**
     * Find record by primary key
     */
    static async find<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T> | null> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found in table ${this.entity}`);
        }

        const conditions: any[] = [eq(pkColumn, id)];
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);

        const results = await db
            .select()
            .from(table)
            .where(and(...conditions))
            .limit(1);

        if (results.length === 0) return null;

        return new this({
            entity: this.entity,
            data: results[0],
        }) as InstanceType<T>;
    }

    /**
     * Get first record matching conditions
     */
    static async first<T extends typeof BaseModel>(
        this: T,
        where?: Record<string, any>,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T> | null> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select().from(table);

        const conditions = this.buildWhereConditions(where || {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);

        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }

        const results = await query.limit(1);

        if (results.length === 0) return null;

        return new this({
            entity: this.entity,
            data: results[0],
        }) as InstanceType<T>;
    }

    /**
     * Read a complete row for the server's authorized read-before-write boundary.
     * Unlike `toJson()`, this intentionally retains hidden persistence fields so
     * a fat model can normalize a mutation without issuing an unscoped reread.
     * It is not an API serializer and must never be returned directly to a client.
     */
    static async readMutationSnapshot<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        where: Record<string, any>,
        driver?: DbDriver,
    ): Promise<Record<string, unknown> | null> {
        const record = await this.first({ $and: [where, { [this.primaryKey]: id }] }, driver);
        return record ? { ...record.attributes } : null;
    }

    /**
     * Get all records matching conditions
     */
    static async where<T extends typeof BaseModel>(
        this: T,
        where: Record<string, any>,
        options?: CollectionQueryOptions,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        const window = this.collectionWindow(options);
        if (window.limit === 0) return [];

        const plans = this.planFilterQueries(where, D1_FILTER_BINDING_BUDGET);
        if (plans.length > 1) {
            const executionOptions = this.chunkExecutionOptions(options, window.chunkLimit);
            const merged: InstanceType<T>[] = [];
            for (const plan of plans) {
                merged.push(...(await this.where(plan.where, executionOptions, driver, includeTrashed)));
            }
            const unique = this.deduplicateCollectionRows(merged);
            const windowed = this.sortAndWindowChunkedRows(unique, options);
            return this.restoreRequestedProjection(windowed, options);
        }

        where = plans[0]?.where ?? where;

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        const { projection, omitted } = this.buildCollectionRead(options?.select, options?.withDeferred);
        let query = (projection ? db.select(projection) : db.select()).from(table);

        // Apply where conditions + soft delete filter
        const conditions = this.buildWhereConditions(where);
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }

        // Apply ordering. The primary key makes ties stable for offset pages and feeds.
        query = this.applyStableOrder(query, options);

        // Apply limit/offset
        if (options?.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options?.offset !== undefined && options.offset > 0) {
            query = query.offset(options.offset);
        }

        const results = await query;

        return results.map((row: any) => new this({ entity: this.entity, data: row, omitted }) as InstanceType<T>);
    }

    /**
     * Get all records where a field is in an array of values
     */
    static async whereIn<T extends typeof BaseModel>(
        this: T,
        field: string,
        values: any[],
        options?: CollectionQueryOptions,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        if (!(this.getTable() as any)[field]) {
            throw new Error(`Field "${field}" does not exist on table "${this.entity}"`);
        }
        if (values.length === 0) return [];
        return this.where({ [field]: values }, options, driver, includeTrashed);
    }

    /**
     * Get all records
     */
    private static async readAll<T extends typeof BaseModel>(
        this: T,
        options?: CollectionQueryOptions,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        const maxRows = getOttaORMMaxAllRows();
        const hasExplicitLimit = options !== undefined && Object.prototype.hasOwnProperty.call(options, 'limit');
        const requestedLimit = options?.limit;

        if (hasExplicitLimit) {
            if (!Number.isSafeInteger(requestedLimit) || requestedLimit! < 0) {
                throw new TypeError('all() limit must be a non-negative safe integer');
            }
            if (requestedLimit! > maxRows) {
                throw new OttaORMAllRowsLimitError(requestedLimit!, maxRows);
            }
            if (requestedLimit === 0) return [];
            return this.where({}, options, driver, includeTrashed);
        }

        // An implicit all() promises the complete matching set. Count first so
        // an oversized table fails before its rows are materialized.
        const total = await this.count({}, driver, includeTrashed);
        if (total > maxRows) throw new OttaORMAllRowsLimitError(total, maxRows);

        // Read one sentinel row as well. The count/read are separate D1
        // statements, so a concurrent insert must not turn a complete result
        // into a silent partial result.
        const rows = await this.where({}, { ...options, limit: maxRows + 1 }, driver, includeTrashed);
        if (rows.length > maxRows) throw new OttaORMAllRowsLimitError(rows.length, maxRows);
        return rows;
    }

    /**
     * Return all records only after proving that the complete set is within
     * the configured safety ceiling. Explicit limits are intentionally bounded
     * reads; an omitted limit is a complete-set request and is checked first.
     */
    static async all<T extends typeof BaseModel>(
        this: T,
        options?: CollectionQueryOptions,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        return this.readAll(options, driver, includeTrashed);
    }

    /**
     * Iterate a complete table/filter in deterministic primary-key pages.
     * The caller owns the scan explicitly, so rows never accumulate inside
     * OttaORM and D1 receives a bounded query per page.
     */
    static async *pages<T extends typeof BaseModel>(
        this: T,
        options: KeysetPagesOptions = {},
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): AsyncGenerator<InstanceType<T>[], void, void> {
        const requestedPerPage = options.perPage ?? DEFAULT_KEYSET_PAGE_SIZE;
        if (!Number.isSafeInteger(requestedPerPage) || requestedPerPage <= 0) {
            throw new TypeError('pages() perPage must be a positive safe integer');
        }

        const perPage = Math.min(requestedPerPage, getOttaORMMaxAllRows());
        const direction = options.orderDirection ?? 'asc';
        const primaryKey = this.primaryKey;
        const select = options.select ? [...new Set([...options.select, primaryKey])] : undefined;
        const baseWhere = options.where ?? {};
        let cursor: unknown;

        for (;;) {
            const where =
                cursor === undefined
                    ? baseWhere
                    : {
                          $and: [
                              baseWhere,
                              {
                                  [primaryKey]: {
                                      [direction === 'asc' ? '$gt' : '$lt']: cursor,
                                  },
                              },
                          ],
                      };
            const page = await this.where(
                where,
                {
                    orderBy: primaryKey,
                    orderDirection: direction,
                    limit: perPage,
                    select,
                    withDeferred: options.withDeferred,
                },
                driver,
                includeTrashed,
            );

            if (page.length === 0) return;
            yield page;

            const nextCursor = page[page.length - 1].get(primaryKey);
            if (nextCursor === undefined || nextCursor === null || nextCursor === cursor) {
                throw new Error(`pages() could not advance on ${this.entity}.${primaryKey}`);
            }
            cursor = nextCursor;
            if (page.length < perPage) return;
        }
    }

    /**
     * Check if a value is unique for a field, optionally scoped and excluding an id.
     */
    static async isUnique<T extends typeof BaseModel>(
        this: T,
        field: string,
        value: unknown,
        options?: {
            where?: Record<string, any>;
            ignoreId?: string | number;
            driver?: DbDriver;
        },
    ): Promise<boolean> {
        const db = this.getDriver(options?.driver).getDb();
        const table = this.getTable();
        const column = (table as any)[field];

        if (!column) {
            throw new Error(`Field '${field}' not found on model ${this.entity}`);
        }

        const conditions: any[] = [eq(column, value)];

        if (options?.where) {
            conditions.push(...this.buildWhereConditions(options.where));
        }

        if (options?.ignoreId !== undefined && options?.ignoreId !== null) {
            const pkColumn = (table as any)[this.primaryKey];
            if (pkColumn) {
                conditions.push(ne(pkColumn, options.ignoreId));
            }
        }

        const results = await db
            .select({ id: (table as any)[this.primaryKey] })
            .from(table)
            .where(and(...conditions))
            .limit(1);

        return results.length === 0;
    }

    /**
     * Build where conditions for Drizzle.
     *
     * In addition to the original flat equality/IN form this accepts nested
     * `$and`/`$or` groups and scalar ranges. The recursive shape is important
     * for keyset scans: `{ $and: [callerFilter, { id: { $gt: cursor } }] }`
     * must preserve a caller's own `id` predicate instead of overwriting it.
     */
    protected static buildWhereConditions(where: Record<string, any>): any[] {
        const expressions = this.buildWhereExpression(where, false);
        return Array.isArray(expressions) ? expressions : expressions ? [expressions] : [];
    }

    private static buildWhereExpression(value: unknown, wrap = true): any | any[] | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

        const table = this.getTable();
        const conditions: any[] = [];

        for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
            if (key === '$and' || key === '$or') {
                if (!Array.isArray(rawValue)) throw new TypeError(`${key} must be an array of where objects`);
                const children = rawValue
                    .map((child) => this.buildWhereExpression(child))
                    .filter((child): child is any => Boolean(child));

                if (key === '$and') {
                    if (children.length > 0) conditions.push(and(...children));
                } else if (children.length > 0) {
                    conditions.push(or(...children));
                } else {
                    // An empty OR must not silently widen a query.
                    conditions.push(sql`0 = 1`);
                }
                continue;
            }

            const column = (table as any)[key];
            if (!column) continue;

            if (rawValue === null || rawValue === undefined) {
                // Treat undefined like null → `IS NULL`. Never emit eq(col,
                // undefined), which the D1 driver cannot bind.
                conditions.push(isNull(column));
                continue;
            }

            if (Array.isArray(rawValue)) {
                // Empty membership is a real, fail-closed answer. Treating it as
                // "no filter" would turn an empty RLS scope into an unscoped query.
                conditions.push(rawValue.length > 0 ? inArray(column, rawValue) : sql`0 = 1`);
                continue;
            }

            if (rawValue && typeof rawValue === 'object') {
                const operators = rawValue as Record<string, unknown>;
                let recognizedOperator = false;
                for (const [operator, operand] of Object.entries(operators)) {
                    switch (operator) {
                        case '$eq':
                            recognizedOperator = true;
                            conditions.push(operand === null ? isNull(column) : eq(column, operand));
                            break;
                        case '$ne':
                            recognizedOperator = true;
                            conditions.push(operand === null ? isNotNull(column) : ne(column, operand));
                            break;
                        case '$gt':
                            recognizedOperator = true;
                            conditions.push(gt(column, operand));
                            break;
                        case '$gte':
                            recognizedOperator = true;
                            conditions.push(gte(column, operand));
                            break;
                        case '$lt':
                            recognizedOperator = true;
                            conditions.push(lt(column, operand));
                            break;
                        case '$lte':
                            recognizedOperator = true;
                            conditions.push(lte(column, operand));
                            break;
                        case '$in':
                            recognizedOperator = true;
                            if (!Array.isArray(operand)) throw new TypeError('$in must be an array');
                            conditions.push(operand.length > 0 ? inArray(column, operand) : sql`0 = 1`);
                            break;
                        default:
                            // Unknown object keys are not operators; retain
                            // the old equality fallback below.
                            break;
                    }
                }

                if (recognizedOperator) continue;
            }

            conditions.push(eq(column, rawValue));
        }

        if (conditions.length === 0) return null;
        return wrap ? and(...conditions) : conditions;
    }

    /**
     * Build OR search condition across fields using LIKE
     */
    protected static buildSearchCondition(search: string, fields: string[]) {
        if (!search || fields.length === 0) return null;
        if (new TextEncoder().encode(search).byteLength > MAX_SEARCH_TERM_BYTES) {
            throw new QueryBindingLimitError(`Search term exceeds ${MAX_SEARCH_TERM_BYTES} bytes`);
        }
        const table = this.getTable();
        const conditions = fields
            .map((field) => {
                const column = (table as any)[field];
                if (!column) return null;
                return like(column, `%${search}%`);
            })
            .filter(Boolean) as any[];

        if (conditions.length === 0) return null;
        return or(...conditions);
    }

    /**
     * Prepare data for database operations
     * Converts string dates to Date objects based on model casts
     */
    protected static prepareForDatabase(data: Record<string, any>): Record<string, any> {
        const prepared = { ...data };
        const table = this.table as any;

        if (this.casts) {
            for (const [key, castType] of Object.entries(this.casts)) {
                if (prepared[key] === undefined || prepared[key] === null) continue;

                const value = prepared[key];

                // For date/datetime casts, convert to Unix timestamp for SQLite
                if (castType === 'date' || castType === 'datetime') {
                    if (value instanceof Date) {
                        // Convert Date to Unix timestamp (milliseconds)
                        prepared[key] = value.getTime();
                        continue;
                    }

                    if (typeof value === 'string') {
                        // Parse string to Date and convert to timestamp
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                            prepared[key] = date.getTime();
                        }
                    } else if (typeof value === 'number') {
                        // Already a timestamp, leave as-is
                        continue;
                    }
                    continue;
                }

                // For json/array casts, serialize objects/arrays to a JSON string so the value
                // round-trips through a plain TEXT column (read side parses it back via casts).
                // Drizzle `mode: 'json'` columns (dataType === 'json') serialize themselves —
                // skip those to avoid double-encoding.
                if (castType === 'json' || castType === 'array') {
                    const column = table?.[key];
                    const isJsonModeColumn = column?.dataType === 'json';
                    if (!isJsonModeColumn && typeof value !== 'string') {
                        prepared[key] = JSON.stringify(value);
                    }
                    continue;
                }
            }
        }

        return prepared;
    }

    /**
     * Create a new record (validates against Zod schema if fields are defined)
     */
    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        // Validate before create if fields are defined
        let validatedData = data;
        if (Object.keys(this.fields).length > 0) {
            const result = this.validate(data, 'create');
            if (!result.success) {
                throw new ValidationError(result.errors);
            }
            // Use the validated/coerced data from Zod (guaranteed to exist when success=true)
            validatedData = result.data!;
        }

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        // Merge with defaults and prepare for database
        const createData = this.prepareForDatabase({ ...this.defaults, ...validatedData });

        // Cloudflare Workers (workerd) disallows random generation in module/global scope,
        // so model schemas avoid crypto.randomUUID() defaults. Generate ids at runtime.
        if (this.primaryKey === 'id' && (createData.id === undefined || createData.id === null)) {
            const uuidFn = globalThis.crypto?.randomUUID;
            if (typeof uuidFn !== 'function') {
                throw new Error(`Missing id for ${this.entity} and crypto.randomUUID is unavailable`);
            }
            createData.id = uuidFn.call(globalThis.crypto);
        }

        const result = await db.insert(table).values(createData).returning();

        if (result.length === 0) {
            throw new Error(`Failed to create ${this.entity}`);
        }

        return new this({
            entity: this.entity,
            data: result[0],
        }) as InstanceType<T>;
    }

    /** Model-owned normalization shared by direct and guarded update paths. */
    protected static async prepareUpdateMutation(
        data: Record<string, any>,
        _context: UpdateMutationContext,
    ): Promise<Record<string, any>> {
        return data;
    }

    private static assertMutationGuardFields(where: Record<string, any>): void {
        for (const [key, value] of Object.entries(where)) {
            if (key === '$and' || key === '$or') {
                if (!Array.isArray(value)) throw new TypeError(`${key} must be an array of where objects`);
                for (const child of value) {
                    if (!child || typeof child !== 'object' || Array.isArray(child)) {
                        throw new TypeError(`${key} entries must be where objects`);
                    }
                    this.assertMutationGuardFields(child as Record<string, any>);
                }
                continue;
            }
            if (key.startsWith('$') || !this.hasColumn(key)) {
                throw new Error(`Atomic mutation guard references unknown field "${key}" on ${this.entity}`);
            }
        }
    }

    /** Convert an authorized in-memory snapshot back to the table's persisted representation. */
    private static prepareMutationExpected(expected?: Record<string, unknown>): Record<string, unknown> {
        return expected ? this.prepareForDatabase({ ...expected }) : {};
    }

    /** Ensure an automatically managed version timestamp advances even within the same millisecond. */
    private static nextMutationTimestamp(currentData?: Record<string, unknown>, guard?: AtomicMutationGuard): number {
        const current = currentData?.updatedAt ?? guard?.expected?.updatedAt;
        let currentMs: number | null = null;

        if (current instanceof Date) {
            currentMs = current.getTime();
        } else if (typeof current === 'number') {
            currentMs = current;
        } else if (typeof current === 'string' && current.trim() !== '') {
            const numeric = Number(current);
            currentMs = Number.isFinite(numeric) ? numeric : new Date(current).getTime();
        }

        const now = Date.now();
        return currentMs !== null && Number.isFinite(currentMs) ? Math.max(now, currentMs + 1) : now;
    }

    private static async persistUpdate<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: DbDriver,
        currentData?: Record<string, unknown>,
        guard?: AtomicMutationGuard,
        prepared = false,
    ): Promise<InstanceType<T>> {
        const normalizedData = prepared
            ? { ...data }
            : await this.prepareUpdateMutation({ ...data }, { id, currentData, driver });
        // Validate before update if fields are defined
        let validatedData = normalizedData;
        if (Object.keys(this.fields).length > 0) {
            const result = this.validate(normalizedData, 'update');
            if (!result.success) {
                throw new ValidationError(result.errors);
            }
            // Use the validated/coerced data from Zod (guaranteed to exist when success=true)
            validatedData = result.data!;
        }

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }

        // Auto-add updatedAt if model has it in casts and value not provided
        if (this.casts && this.casts.updatedAt && validatedData.updatedAt === undefined) {
            validatedData.updatedAt = this.nextMutationTimestamp(currentData, guard);
        }

        // Prepare data for database (convert string dates, etc.)
        const updateData = this.prepareForDatabase(validatedData);

        const conditions: any[] = [eq(pkColumn, id)];
        if (guard) {
            this.assertMutationGuardFields(guard.where);
            conditions.push(...this.buildWhereConditions(guard.where));
            for (const [field, value] of Object.entries(this.prepareMutationExpected(guard.expected))) {
                const column = (table as any)[field];
                if (!column)
                    throw new Error(`Atomic mutation guard references unknown field "${field}" on ${this.entity}`);
                conditions.push(value === null || value === undefined ? isNull(column) : eq(column, value));
            }
            const softDeleteCond = this.getSoftDeleteCondition(false);
            if (softDeleteCond) conditions.push(softDeleteCond);
        }

        const result = await db
            .update(table)
            .set(updateData)
            .where(and(...conditions))
            .returning();

        if (result.length === 0) {
            if (guard) throw new ConcurrentMutationError(this.entity);
            throw new Error(`Failed to update ${this.entity} with id ${id}`);
        }

        return new this({
            entity: this.entity,
            data: result[0],
        }) as InstanceType<T>;
    }

    /**
     * Persist a model-owned, already-normalized internal mutation without re-entering
     * `prepareUpdateMutation`. This is intentionally protected: request data must use
     * `update`/`updateConstrained`; fat-model operations use this only for server-owned
     * fields that their public mutation hook deliberately strips.
     */
    protected static async persistPreparedUpdate<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        options: { driver?: DbDriver; guard?: AtomicMutationGuard } = {},
    ): Promise<InstanceType<T>> {
        return this.persistUpdate(id, data, options.driver, undefined, options.guard, true);
    }

    /**
     * Update a record by primary key (validates against Zod schema if fields are defined).
     * Fat models should override `prepareUpdateMutation`, not this persistence method,
     * when normalization must also apply to secure CRUD.
     */
    static async update<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        driver?: DbDriver,
        currentData?: Record<string, unknown>,
    ): Promise<InstanceType<T>> {
        return this.persistUpdate(id, data, driver, currentData);
    }

    /** Atomically carry RLS and snapshot predicates into the UPDATE statement. */
    static async updateConstrained<T extends typeof BaseModel>(
        this: T,
        id: string | number,
        data: Record<string, any>,
        guard: AtomicMutationGuard,
        currentData?: Record<string, unknown>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const ownsLegacyUpdate =
            Object.prototype.hasOwnProperty.call(this, 'update') && this.update !== BaseModel.update;
        const ownsSharedHook = Object.prototype.hasOwnProperty.call(this, 'prepareUpdateMutation');
        if (ownsLegacyUpdate && !ownsSharedHook) {
            throw new Error(
                `${this.entity} overrides update() but not prepareUpdateMutation(); refusing to bypass model logic in atomic CRUD`,
            );
        }
        return this.persistUpdate(id, data, driver, currentData, guard);
    }

    /**
     * Delete a record by primary key.
     * Uses soft delete (sets `deletedAt`) when `softDeletes` is enabled.
     */
    static async delete(id: string | number, driver?: DbDriver): Promise<boolean> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }

        if (this.softDeletes) {
            const deletedAtCol = (table as any).deletedAt;
            if (!deletedAtCol) {
                throw new Error(`Model "${this.entity}" has softDeletes enabled but table has no "deletedAt" column.`);
            }
            await db.update(table).set({ deletedAt: Date.now() }).where(eq(pkColumn, id));
        } else {
            await db.delete(table).where(eq(pkColumn, id));
        }

        return true;
    }

    /** Atomically carry RLS and snapshot predicates into DELETE/soft-delete. */
    static async deleteConstrained(
        id: string | number,
        guard: AtomicMutationGuard,
        driver?: DbDriver,
    ): Promise<boolean> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];
        if (!pkColumn) throw new Error(`Primary key column ${this.primaryKey} not found`);

        this.assertMutationGuardFields(guard.where);
        const conditions: any[] = [eq(pkColumn, id), ...this.buildWhereConditions(guard.where)];
        for (const [field, value] of Object.entries(this.prepareMutationExpected(guard.expected))) {
            const column = (table as any)[field];
            if (!column) throw new Error(`Atomic mutation guard references unknown field "${field}" on ${this.entity}`);
            conditions.push(value === null || value === undefined ? isNull(column) : eq(column, value));
        }
        const softDeleteCond = this.getSoftDeleteCondition(false);
        if (softDeleteCond) conditions.push(softDeleteCond);

        const result = this.softDeletes
            ? await db
                  .update(table)
                  .set({ deletedAt: Date.now() })
                  .where(and(...conditions))
                  .returning({ primaryKey: pkColumn })
            : await db
                  .delete(table)
                  .where(and(...conditions))
                  .returning({ primaryKey: pkColumn });
        if (result.length === 0) throw new ConcurrentMutationError(this.entity);
        return true;
    }

    /**
     * Permanently delete a record, bypassing soft deletes.
     */
    static async forceDelete(id: string | number, driver?: DbDriver): Promise<boolean> {
        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }

        await db.delete(table).where(eq(pkColumn, id));
        return true;
    }

    /**
     * Restore a soft-deleted record by clearing `deletedAt`.
     */
    static async restore(id: string | number, driver?: DbDriver): Promise<boolean> {
        if (!this.softDeletes) {
            throw new Error(`Model "${this.entity}" does not have soft deletes enabled.`);
        }

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();
        const pkColumn = (table as any)[this.primaryKey];
        const deletedAtCol = (table as any).deletedAt;

        if (!pkColumn) {
            throw new Error(`Primary key column ${this.primaryKey} not found`);
        }
        if (!deletedAtCol) {
            throw new Error(`Table "${this.entity}" has no "deletedAt" column.`);
        }

        await db.update(table).set({ deletedAt: null }).where(eq(pkColumn, id));
        return true;
    }

    private static async *iterateFilterPlanRows<T extends typeof BaseModel>(
        this: T,
        plan: FilterQueryPlan,
        fields: string[],
        driver?: DbDriver,
        includeTrashed?: boolean,
        searchConfig?: { search: string; fields: string[] },
    ): AsyncGenerator<InstanceType<T>> {
        const primaryKey = this.primaryKey;
        let cursor: unknown;
        for (;;) {
            const pageWhere =
                cursor === undefined ? plan.where : { $and: [plan.where, { [primaryKey]: { $gt: cursor } }] };
            const pageOptions = {
                orderBy: primaryKey,
                orderDirection: 'asc' as const,
                limit: AGGREGATE_MERGE_PAGE_SIZE,
                select: [...new Set([primaryKey, ...fields])],
            };
            const page = searchConfig
                ? await this.search(
                      searchConfig.search,
                      searchConfig.fields,
                      pageWhere,
                      pageOptions,
                      driver,
                      includeTrashed,
                  )
                : await this.where(pageWhere, pageOptions, driver, includeTrashed);
            if (page.length === 0) return;
            for (const row of page) yield row;

            const nextCursor = page[page.length - 1].get(primaryKey);
            if (nextCursor === undefined || nextCursor === null || Object.is(nextCursor, cursor)) {
                throw new Error(`Aggregate scan could not advance on ${this.entity}.${primaryKey}`);
            }
            cursor = nextCursor;
            if (page.length < AGGREGATE_MERGE_PAGE_SIZE) return;
        }
    }

    /** Merge overlapping OR plans in primary-key order with constant per-plan memory. */
    private static async mergePlannedAggregates<T extends typeof BaseModel>(
        this: T,
        plans: FilterQueryPlan[],
        fields: string[],
        driver?: DbDriver,
        includeTrashed?: boolean,
        searchConfig?: { search: string; fields: string[] },
    ): Promise<{ count: number; sums: Record<string, number> }> {
        type PlanHead = {
            iterator: AsyncGenerator<InstanceType<T>>;
            result: IteratorResult<InstanceType<T>>;
        };

        const heads: PlanHead[] = [];
        for (const plan of plans) {
            const iterator = this.iterateFilterPlanRows(plan, fields, driver, includeTrashed, searchConfig);
            const result = await iterator.next();
            if (!result.done) heads.push({ iterator, result });
        }

        let count = 0;
        const sums = Object.fromEntries(fields.map((field) => [field, 0]));
        while (heads.length > 0) {
            let minimum = heads[0].result.value.get(this.primaryKey);
            for (let index = 1; index < heads.length; index += 1) {
                const candidate = heads[index].result.value.get(this.primaryKey);
                if (this.compareCollectionValues(candidate, minimum) < 0) minimum = candidate;
            }

            const matching = heads.filter(
                (head) => this.compareCollectionValues(head.result.value.get(this.primaryKey), minimum) === 0,
            );
            const row = matching[0].result.value;
            count += 1;
            for (const field of fields) sums[field] += Number(row.get(field) ?? 0);

            for (const head of matching) {
                head.result = await head.iterator.next();
                if (head.result.done) heads.splice(heads.indexOf(head), 1);
            }
        }

        return { count, sums };
    }

    /**
     * Count records matching conditions
     */
    static async count(where?: Record<string, any>, driver?: DbDriver, includeTrashed?: boolean): Promise<number> {
        const plans = this.planFilterQueries(where ?? {}, D1_FILTER_BINDING_BUDGET - 1);
        if (plans.length > 1) {
            const aggregate = await this.mergePlannedAggregates(plans, [], driver, includeTrashed);
            return aggregate.count;
        }

        const db = this.getDriver(driver).getDb();
        const table = this.getTable();

        let query = db.select({ count: sql<number>`count(*)` }).from(table);

        const conditions = this.buildWhereConditions(plans[0]?.where ?? where ?? {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }

        const results = await query;
        return Number(results[0]?.count ?? 0);
    }

    /**
     * Return bounded numeric aggregates without materializing the matching
     * rows. Unknown fields are rejected so a typo cannot turn an intended
     * aggregate into a misleading zero.
     */
    static async sums<T extends typeof BaseModel>(
        this: T,
        fields: string[],
        where?: Record<string, any>,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<Record<string, number>> {
        const table = this.getTable();
        const selections: Record<string, any> = {};
        for (const field of fields) {
            const column = (table as any)[field];
            if (!column) throw new Error(`Field '${field}' not found on model ${this.entity}`);
            selections[field] = sql<number>`coalesce(sum(${column}), 0)`.as(field);
        }

        if (fields.length === 0) return {};

        const plans = this.planFilterQueries(where ?? {}, D1_FILTER_BINDING_BUDGET - 1);
        if (plans.length > 1) {
            const aggregate = await this.mergePlannedAggregates(plans, fields, driver, includeTrashed);
            return aggregate.sums;
        }

        const conditions = this.buildWhereConditions(plans[0]?.where ?? where ?? {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);

        let query = this.getDriver(driver).getDb().select(selections).from(table);
        if (conditions.length > 0) query = query.where(and(...conditions));
        const rows = await query;
        const row = (rows[0] ?? {}) as Record<string, unknown>;
        return Object.fromEntries(fields.map((field) => [field, Number(row[field] ?? 0)]));
    }

    /**
     * Search records with LIKE across searchable fields
     */
    static async search<T extends typeof BaseModel>(
        this: T,
        search: string,
        fields: string[],
        where?: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
            /** Column projection — narrows the SELECT to these fields (unknown fields ignored). */
            select?: string[];
            /** Load the model's `deferred` columns too. For the rare collection read that needs them. */
            withDeferred?: boolean;
        },
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<InstanceType<T>[]> {
        const window = this.collectionWindow(options);
        if (window.limit === 0) return [];

        const table = this.getTable();
        const searchableFieldCount = [...new Set(fields)].filter((field) => Boolean((table as any)[field])).length;
        const filterBudget = D1_FILTER_BINDING_BUDGET - searchableFieldCount;
        const plans = this.planFilterQueries(where ?? {}, filterBudget);
        if (plans.length > 1) {
            const executionOptions = this.chunkExecutionOptions(options, window.chunkLimit);
            const merged: InstanceType<T>[] = [];
            for (const plan of plans) {
                merged.push(
                    ...(await this.search(search, fields, plan.where, executionOptions, driver, includeTrashed)),
                );
            }
            const unique = this.deduplicateCollectionRows(merged);
            const windowed = this.sortAndWindowChunkedRows(unique, options);
            return this.restoreRequestedProjection(windowed, options);
        }

        where = plans[0]?.where ?? where;
        const db = this.getDriver(driver).getDb();

        const searchCondition = this.buildSearchCondition(search, fields);
        if (!searchCondition) {
            return this.where(where || {}, options, driver, includeTrashed);
        }

        const conditions = this.buildWhereConditions(where || {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);
        const { projection, omitted } = this.buildCollectionRead(options?.select, options?.withDeferred);
        let query = (projection ? db.select(projection) : db.select()).from(table);

        if (conditions.length > 0) {
            query = query.where(and(...conditions, searchCondition));
        } else {
            query = query.where(searchCondition);
        }

        query = this.applyStableOrder(query, options);

        if (options?.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options?.offset !== undefined && options.offset > 0) {
            query = query.offset(options.offset);
        }

        const results = await query;
        return results.map((row: any) => new this({ entity: this.entity, data: row, omitted }) as InstanceType<T>);
    }

    private static async countSearch<T extends typeof BaseModel>(
        this: T,
        search: string,
        fields: string[],
        where?: Record<string, any>,
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<number> {
        const table = this.getTable();
        const validFields = [...new Set(fields)].filter((field) => Boolean((table as any)[field]));
        const searchCondition = this.buildSearchCondition(search, validFields);
        if (!searchCondition) return this.count(where, driver, includeTrashed);

        // One slot is held for the keyset cursor used if plans overlap and must
        // be merged. Search contributes one LIKE binding per valid field.
        const plans = this.planFilterQueries(where ?? {}, D1_FILTER_BINDING_BUDGET - validFields.length - 1);
        if (plans.length > 1) {
            const aggregate = await this.mergePlannedAggregates(plans, [], driver, includeTrashed, {
                search,
                fields: validFields,
            });
            return aggregate.count;
        }

        const conditions = this.buildWhereConditions(plans[0]?.where ?? where ?? {});
        const softDeleteCond = this.getSoftDeleteCondition(includeTrashed);
        if (softDeleteCond) conditions.push(softDeleteCond);
        const combined = conditions.length > 0 ? and(...conditions, searchCondition) : searchCondition;
        const results = await this.getDriver(driver)
            .getDb()
            .select({ count: sql<number>`count(*)` })
            .from(table)
            .where(combined);
        return Number(results[0]?.count ?? 0);
    }

    /**
     * Paginate search results
     */
    static async searchPaginate<T extends typeof BaseModel>(
        this: T,
        search: string,
        fields: string[],
        page: number = 1,
        perPage: number = 15,
        where?: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            /** Column projection — narrows the SELECT to these fields (unknown fields ignored). */
            select?: string[];
            /** Load the model's `deferred` columns too. For the rare paged read that needs them. */
            withDeferred?: boolean;
        },
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<PaginationResult<InstanceType<T>>> {
        if (!Number.isSafeInteger(page) || page < 1) throw new TypeError('Page must be a positive safe integer');
        if (!Number.isSafeInteger(perPage) || perPage < 1) {
            throw new TypeError('Per-page limit must be a positive safe integer');
        }
        const offset = (page - 1) * perPage;
        if (!Number.isSafeInteger(offset)) throw new TypeError('Pagination offset must be a safe integer');
        const [data, total] = await Promise.all([
            this.search(search, fields, where, { ...options, limit: perPage, offset }, driver, includeTrashed),
            this.countSearch(search, fields, where, driver, includeTrashed),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / perPage));

        return {
            data,
            total,
            page,
            perPage,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };
    }

    /**
     * Paginate results
     */
    static async paginate<T extends typeof BaseModel>(
        this: T,
        page: number = 1,
        perPage: number = 15,
        where?: Record<string, any>,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            /** Column projection — narrows the SELECT to these fields (unknown fields ignored). */
            select?: string[];
            /** Load the model's `deferred` columns too. For the rare paged read that needs them. */
            withDeferred?: boolean;
        },
        driver?: DbDriver,
        includeTrashed?: boolean,
    ): Promise<PaginationResult<InstanceType<T>>> {
        if (!Number.isSafeInteger(page) || page < 1) throw new TypeError('Page must be a positive safe integer');
        if (!Number.isSafeInteger(perPage) || perPage < 1) {
            throw new TypeError('Per-page limit must be a positive safe integer');
        }
        const offset = (page - 1) * perPage;
        if (!Number.isSafeInteger(offset)) throw new TypeError('Pagination offset must be a safe integer');

        const [data, total] = await Promise.all([
            this.where(where || {}, { ...options, limit: perPage, offset }, driver, includeTrashed),
            this.count(where, driver, includeTrashed),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / perPage));

        return {
            data,
            total,
            page,
            perPage,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };
    }

    // ============================================================
    // BATCH / TRANSACTION
    // ============================================================

    /**
     * Execute multiple raw SQL statements as an atomic batch.
     * Uses D1's native batch API — all succeed or all fail.
     *
     * @example
     * ```typescript
     * await BaseModel.batch([
     *     "INSERT INTO todos (id, title) VALUES ('1', 'First')",
     *     "INSERT INTO todos (id, title) VALUES ('2', 'Second')",
     * ]);
     * ```
     */
    static async batch(sqls: string[], driver?: DbDriver): Promise<any> {
        const d = this.getDriver(driver);
        if (typeof d.executeBatch !== 'function') {
            throw new Error('Driver does not support executeBatch. D1Driver supports atomic batches natively.');
        }
        return d.executeBatch(sqls);
    }

    // ============================================================
    // INSTANCE METHODS
    // ============================================================

    /**
     * Save instance (create or update)
     */
    async save(driver?: DbDriver): Promise<this> {
        const ModelClass = this.constructor as typeof BaseModel;
        const pk = this.get(ModelClass.primaryKey);

        if (pk) {
            // Update existing
            // A complete instance is already the current row. A projected/deferred
            // instance is not: let specialized models reload before normalizing.
            const currentData = this.omitted.length === 0 ? this.attributes : undefined;
            const updated = await ModelClass.update(pk, this.attributes, driver, currentData);
            this.fill(updated.attributes);
        } else {
            // Create new
            const created = await ModelClass.create(this.attributes, driver);
            this.fill(created.attributes);
        }

        return this;
    }

    /**
     * Delete instance
     */
    async destroy(driver?: DbDriver): Promise<boolean> {
        const ModelClass = this.constructor as typeof BaseModel;
        const pk = this.get(ModelClass.primaryKey);

        if (!pk) {
            throw new Error('Cannot delete record without primary key');
        }

        return ModelClass.delete(pk, driver);
    }

    /**
     * Reload instance from database
     */
    async refresh(driver?: DbDriver): Promise<this> {
        const ModelClass = this.constructor as typeof BaseModel;
        const pk = this.get(ModelClass.primaryKey);

        if (!pk) {
            throw new Error('Cannot refresh record without primary key');
        }

        const fresh = await ModelClass.find(pk, driver);

        if (!fresh) {
            throw new Error(`Record not found: ${ModelClass.entity}#${pk}`);
        }

        this.fill(fresh.attributes);
        return this;
    }

    /**
     * Eager-load one or more relationships by name.
     * Relationship methods must be defined as instance methods (e.g. `async author()`).
     * Results are attached to `attributes` under the relationship name.
     *
     * @example
     * ```typescript
     * const post = await Post.find('post-id');
     * await post.load('author', 'comments');
     * console.log(post.get('author')); // User instance data
     * console.log(post.get('comments')); // Comment[] data
     * ```
     */
    async load(...relations: string[]): Promise<this> {
        const results = await Promise.all(
            relations.map(async (rel) => {
                const method = (this as any)[rel];
                if (typeof method !== 'function') {
                    throw new Error(
                        `Relationship "${rel}" is not defined on model "${(this.constructor as typeof BaseModel).entity}".`,
                    );
                }
                const result = await method.call(this);
                return { rel, result };
            }),
        );

        for (const { rel, result } of results) {
            if (result === null || result === undefined) {
                this.set(rel, null);
            } else if (Array.isArray(result)) {
                this.set(
                    rel,
                    result.map((r: any) => (typeof r.toJson === 'function' ? r.toJson() : r)),
                );
            } else if (typeof result.toJson === 'function') {
                this.set(rel, result.toJson());
            } else {
                this.set(rel, result);
            }
        }

        return this;
    }

    /**
     * Eager-load relationships for a collection of model instances.
     * Loads each instance's relationships in parallel (N+1 per relation).
     * For truly batched loading, use `whereIn` directly.
     *
     * @example
     * ```typescript
     * const posts = await Post.where({});
     * await Post.loadAll(posts, 'author');
     * ```
     */
    static async loadAll<T extends BaseModel>(instances: T[], ...relations: string[]): Promise<T[]> {
        // For each instance, call load() in parallel
        await Promise.all(instances.map((instance) => instance.load(...relations)));
        return instances;
    }

    // ============================================================
    // RELATIONSHIP HELPERS (Instance Methods)
    // ============================================================

    /**
     * BelongsTo relationship (many-to-one)
     *
     * @example
     * ```typescript
     * // Simple (auto-selects all fields)
     * async author() {
     *   return this.belongsTo(User, 'authorId');
     * }
     *
     * // With field selection (performance optimization)
     * async author() {
     *   return this.belongsTo(User, 'authorId', {
     *     select: ['id', 'name', 'email', 'image']
     *   });
     * }
     *
     * // Custom owner key (default is 'id')
     * async author() {
     *   return this.belongsTo(User, 'authorId', { ownerKey: 'uuid' });
     * }
     * ```
     */
    protected async belongsTo<T extends typeof BaseModel>(
        relatedModel: T,
        foreignKey: string,
        options?: {
            ownerKey?: string; // Primary key in related model (default: relatedModel.primaryKey)
            select?: string[]; // Fields to select from related model
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T> | null> {
        const foreignValue = this.get(foreignKey);

        if (!foreignValue) {
            return null;
        }

        const ownerKey = options?.ownerKey || relatedModel.primaryKey;
        const driver = options?.driver || relatedModel.getDriver();
        const db = driver.getDb();
        const table = relatedModel.getTable();

        let query = db.select().from(table);

        // Apply field selection if specified
        if (options?.select && options.select.length > 0) {
            const selectObj: any = {};
            for (const field of options.select) {
                const column = (table as any)[field];
                if (column) {
                    selectObj[field] = column;
                }
            }
            query = db.select(selectObj).from(table);
        }

        const pkColumn = (table as any)[ownerKey];
        if (!pkColumn) {
            throw new Error(`Owner key ${ownerKey} not found in ${relatedModel.entity}`);
        }

        const results = await query.where(eq(pkColumn, foreignValue)).limit(1);

        if (results.length === 0) return null;

        return new relatedModel({
            entity: relatedModel.entity,
            data: results[0],
        }) as InstanceType<T>;
    }

    /**
     * HasMany relationship (one-to-many)
     *
     * @example
     * ```typescript
     * // Simple
     * async comments() {
     *   return this.hasMany(Comment, 'postId');
     * }
     *
     * // With field selection
     * async comments() {
     *   return this.hasMany(Comment, 'postId', {
     *     select: ['id', 'content', 'createdAt']
     *   });
     * }
     *
     * // With ordering
     * async comments() {
     *   return this.hasMany(Comment, 'postId', {
     *     orderBy: 'createdAt',
     *     orderDirection: 'desc'
     *   });
     * }
     * ```
     */
    protected async hasMany<T extends typeof BaseModel>(
        relatedModel: T,
        foreignKey: string,
        options?: {
            localKey?: string; // Primary key in this model (default: this.constructor.primaryKey)
            select?: string[]; // Fields to select from related model
            orderBy?: string; // Field to order by
            orderDirection?: 'asc' | 'desc';
            limit?: number; // Limit results
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T>[]> {
        const ModelClass = this.constructor as typeof BaseModel;
        const localKey = options?.localKey || ModelClass.primaryKey;
        const localValue = this.get(localKey);

        if (!localValue) {
            return [];
        }

        const driver = options?.driver || relatedModel.getDriver();
        const db = driver.getDb();
        const table = relatedModel.getTable();

        let query = db.select().from(table);

        // Apply field selection if specified
        if (options?.select && options.select.length > 0) {
            const selectObj: any = {};
            for (const field of options.select) {
                const column = (table as any)[field];
                if (column) {
                    selectObj[field] = column;
                }
            }
            query = db.select(selectObj).from(table);
        }

        const fkColumn = (table as any)[foreignKey];
        if (!fkColumn) {
            throw new Error(`Foreign key ${foreignKey} not found in ${relatedModel.entity}`);
        }

        query = query.where(eq(fkColumn, localValue));

        // Apply ordering
        if (options?.orderBy) {
            const orderColumn = (table as any)[options.orderBy];
            if (orderColumn) {
                query = query.orderBy(options.orderDirection === 'desc' ? desc(orderColumn) : asc(orderColumn));
            }
        }

        // Apply limit
        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const results = await query;

        return results.map(
            (row: any) =>
                new relatedModel({
                    entity: relatedModel.entity,
                    data: row,
                }) as InstanceType<T>,
        );
    }

    /**
     * BelongsToMany relationship (many-to-many via pivot table)
     *
     * @example
     * ```typescript
     * // Simple (infers keys from table names)
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable);
     * }
     *
     * // With field selection
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable, {
     *     select: ['id', 'name', 'slug']
     *   });
     * }
     *
     * // With custom keys
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable, {
     *     foreignKey: 'postId',      // key in pivot table
     *     otherKey: 'tagId',         // key in pivot table
     *     localKey: 'id',            // key in this model
     *     relatedKey: 'id'           // key in related model
     *   });
     * }
     *
     * // With ordering
     * async tags() {
     *   return this.belongsToMany(Tag, postTagsTable, {
     *     orderBy: 'name',
     *     orderDirection: 'asc'
     *   });
     * }
     * ```
     */
    protected async belongsToMany<T extends typeof BaseModel>(
        relatedModel: T,
        pivotTable: SQLiteTable,
        options?: {
            foreignKey?: string; // Key in pivot table for this model (default: {entity}Id)
            otherKey?: string; // Key in pivot table for related model (default: {relatedEntity}Id)
            localKey?: string; // Primary key in this model (default: primaryKey)
            relatedKey?: string; // Primary key in related model (default: relatedModel.primaryKey)
            select?: string[]; // Fields to select from related model
            orderBy?: string; // Field to order by
            orderDirection?: 'asc' | 'desc';
            withPivot?: string[]; // Additional pivot fields to include
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T>[]> {
        const ModelClass = this.constructor as typeof BaseModel;
        const localKey = options?.localKey || ModelClass.primaryKey;
        const localValue = this.get(localKey);

        if (!localValue) {
            return [];
        }

        const driver = options?.driver || relatedModel.getDriver();
        const db = driver.getDb();

        // Infer keys from model names if not provided. Entities are typically plural
        // (e.g. "posts"), so singularize before appending "Id" → "postId" (not "postsId").
        const foreignKey = options?.foreignKey || `${singularizeEntity(ModelClass.entity)}Id`;
        const otherKey = options?.otherKey || `${singularizeEntity(relatedModel.entity)}Id`;
        const relatedKey = options?.relatedKey || relatedModel.primaryKey;

        // Get IDs from pivot table
        const pivotFkColumn = (pivotTable as any)[foreignKey];
        const pivotOtherColumn = (pivotTable as any)[otherKey];

        if (!pivotFkColumn || !pivotOtherColumn) {
            // List available columns for debugging
            const availableColumns = Object.keys(pivotTable).filter(
                (k) => !k.startsWith('_') && typeof (pivotTable as any)[k]?.name === 'string',
            );
            const missing = [!pivotFkColumn && foreignKey, !pivotOtherColumn && otherKey].filter(Boolean);
            throw new Error(
                `Pivot table column(s) not found: ${missing.join(', ')}. ` +
                    `Available columns: ${availableColumns.join(', ') || '(none)'}. ` +
                    `Use the foreignKey/otherKey options to specify custom column names.`,
            );
        }

        const pivotRows = await db.select().from(pivotTable).where(eq(pivotFkColumn, localValue));

        if (pivotRows.length === 0) {
            return [];
        }

        // Get related IDs from pivot
        const relatedIds = pivotRows.map((row: any) => row[otherKey]);

        if (relatedIds.length === 0) {
            return [];
        }

        // The relation read uses BaseModel.whereIn so large pivot lists are split into D1-safe
        // batches and every related model keeps its normal deferred-column behavior.
        const results = await relatedModel.whereIn(
            relatedKey,
            relatedIds,
            {
                select: options?.select,
                withDeferred: true,
                orderBy: options?.orderBy,
                orderDirection: options?.orderDirection,
            },
            driver,
        );

        // Optionally attach pivot data
        if (options?.withPivot && options.withPivot.length > 0) {
            return results.map((instance) => {
                // Find matching pivot row
                const pivotRow = pivotRows.find((pr: any) => pr[otherKey] === instance.get(relatedKey));

                if (pivotRow) {
                    const pivotData: any = {};
                    for (const field of options.withPivot!) {
                        if (field in pivotRow) {
                            pivotData[field] = pivotRow[field];
                        }
                    }
                    // Store pivot data in a special property
                    (instance as any)._pivot = pivotData;
                }

                return instance;
            });
        }

        return results;
    }

    /**
     * HasOne relationship (one-to-one)
     *
     * @example
     * ```typescript
     * async profile() {
     *   return this.hasOne(Profile, 'userId');
     * }
     * ```
     */
    protected async hasOne<T extends typeof BaseModel>(
        relatedModel: T,
        foreignKey: string,
        options?: {
            localKey?: string;
            select?: string[];
            driver?: DbDriver;
        },
    ): Promise<InstanceType<T> | null> {
        const results = await this.hasMany(relatedModel, foreignKey, {
            ...options,
            limit: 1,
        });

        return results.length > 0 ? results[0] : null;
    }
}

/**
 * Best-effort singularization of an entity name for inferring pivot/foreign keys.
 * Handles the common English plural cases; pass explicit keys for anything irregular.
 */
function singularizeEntity(entity: string): string {
    if (entity.endsWith('ies')) return entity.slice(0, -3) + 'y';
    if (entity.endsWith('ses') || entity.endsWith('xes') || entity.endsWith('zes')) return entity.slice(0, -2);
    if (entity.endsWith('s') && !entity.endsWith('ss')) return entity.slice(0, -1);
    return entity;
}
