// ============================================================
// @ottabase/ottaorm - Chainable query builder
// ============================================================
// A thin builder that compiles to the where object and options the
// BaseModel statics already execute. No new SQL path: the binding
// budget, bounded reads, soft deletes and RLS keep working unchanged.
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { getOttaORMMaxAllRows, OttaORMAllRowsLimitError } from '../runtime-config';
import type { BaseModel, CollectionQueryOptions } from './BaseModel';
import type { PaginationResult } from './AbstractBaseModel';

/** Comparison operators accepted by `where(column, operator, value)`. */
export type WhereOperator =
    | '='
    | '!='
    | '<>'
    | '>'
    | '>='
    | '<'
    | '<='
    | 'in'
    | 'notIn'
    | 'contains'
    | 'startsWith'
    | 'endsWith';

const OPERATOR_TO_KEY: Record<WhereOperator, string> = {
    '=': '$eq',
    '!=': '$ne',
    '<>': '$ne',
    '>': '$gt',
    '>=': '$gte',
    '<': '$lt',
    '<=': '$lte',
    in: '$in',
    notIn: '$nin',
    contains: '$contains',
    startsWith: '$startsWith',
    endsWith: '$endsWith',
};

/** A relation to eager-load: its dotted `path` (`name` is the first segment) and the leaf's projection. */
export interface RelationSpec {
    name: string;
    path: string[];
    fields?: string[];
}

type WhereClause = { bool: 'and' | 'or'; where: Record<string, unknown> };
type Columns<T extends typeof BaseModel> = Extract<keyof T['table']['$inferSelect'], string>;

export class RecordNotFoundError extends Error {
    constructor(entity: string) {
        super(`${entity} not found`);
        this.name = 'RecordNotFoundError';
    }
}

/**
 * Parse `'author:id{name,image}'` or `'tags.category:id{name}'` into a dotted path and the
 * projection of its last segment. The key before the braces is always kept.
 */
export function parseRelationSpec(spec: string): RelationSpec {
    const match = /^(\w+(?:\.\w+)*)(?::(\w+))?(?:\{([^}]*)\})?$/.exec(spec.trim());
    if (!match) {
        throw new TypeError(`Invalid relation spec "${spec}" (expected "name", "a.b", "name:key" or "a.b:key{x,y}")`);
    }
    const [, dotted, key, fieldList] = match;
    const path = dotted.split('.');
    const fields = fieldList
        ? [...new Set([key, ...fieldList.split(',')].map((f) => f?.trim()).filter((f): f is string => Boolean(f)))]
        : key
          ? [key]
          : undefined;
    return { name: path[0], path, fields };
}

interface RelationNode {
    name: string;
    fields?: string[];
    children: Map<string, RelationNode>;
}

/** Merge specs into one tree, so `tags` is loaded once for `tags:id{name}` and `tags.category`. */
function buildRelationTree(specs: readonly string[]): Map<string, RelationNode> {
    const roots = new Map<string, RelationNode>();
    for (const spec of specs.map(parseRelationSpec)) {
        let level = roots;
        let node: RelationNode | undefined;
        for (const name of spec.path) {
            node = level.get(name) ?? { name, children: new Map() };
            level.set(name, node);
            level = node.children;
        }
        if (node && spec.fields) node.fields = [...new Set([...(node.fields ?? []), ...spec.fields])];
    }
    return roots;
}

export interface LoadRelationsOptions {
    /** Told the entity behind each loaded path (`tags`, `tags.category`), e.g. to build links. */
    onResolved?: (path: string, entity: string) => void;
}

/**
 * Load relation specs onto model instances, nested paths included. Each level calls the model's
 * own relationship method (`author()`, `tags()`) on the related INSTANCES, then serialises
 * bottom-up: `toJson()` (hidden fields stripped), `pivot` for belongsToMany extras, and the
 * projection of that level (its child relations always kept). The result is set on each instance
 * under the relation name, exactly where `load()` puts it.
 *
 * ponytail: one relationship query per instance per level; batch by key when a page of nested
 * relations shows up in D1 timing.
 */
export async function loadRelations(
    instances: readonly BaseModel[],
    specs: readonly string[],
    options: LoadRelationsOptions = {},
): Promise<void> {
    if (instances.length === 0 || specs.length === 0) return;
    const tree = buildRelationTree(specs);
    await Promise.all(instances.map((instance) => loadNodes(instance, tree, '', options)));
}

async function loadNodes(
    instance: BaseModel,
    nodes: Map<string, RelationNode>,
    prefix: string,
    options: LoadRelationsOptions,
): Promise<void> {
    await Promise.all(
        [...nodes.values()].map(async (node) => {
            const method = (instance as unknown as Record<string, unknown>)[node.name];
            if (typeof method !== 'function') {
                const entity = (instance.constructor as typeof BaseModel).entity;
                throw new Error(`Relationship "${node.name}" is not defined on model "${entity}".`);
            }
            const result = await (method as () => Promise<unknown>).call(instance);
            const path = prefix ? `${prefix}.${node.name}` : node.name;
            instance.set(node.name, await serializeRelation(result, node, path, options));
        }),
    );
}

async function serializeRelation(
    result: unknown,
    node: RelationNode,
    path: string,
    options: LoadRelationsOptions,
): Promise<unknown> {
    if (result === null || result === undefined) return null;
    const many = Array.isArray(result);
    const items = many ? (result as unknown[]) : [result];
    const out = await Promise.all(
        items.map(async (item) => {
            if (!item || typeof (item as BaseModel).toJson !== 'function') return item;
            const related = item as BaseModel & { _pivot?: Record<string, unknown> };
            options.onResolved?.(path, (related.constructor as typeof BaseModel).entity);
            if (node.children.size > 0) await loadNodes(related, node.children, path, options);
            const json: Record<string, unknown> = related._pivot
                ? { ...related.toJson(), pivot: related._pivot }
                : related.toJson();
            return node.fields ? pick(json, [...node.fields, ...node.children.keys()]) : json;
        }),
    );
    return many ? out : out[0];
}

/** Keep only `fields` (plus `pivot` when present). */
function pick(source: Record<string, unknown>, fields: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) if (field in source) out[field] = source[field];
    if ('pivot' in source) out.pivot = source.pivot;
    return out;
}

/**
 * Chainable query over a model. Build it with `Model.query()`.
 *
 * Several `where`s on the same column AND together (unlike CDC, which replaced the earlier one).
 * `orWhere` starts a new OR branch, Laravel-style: `a AND b OR c` reads `(a AND b) OR (c)`.
 * Grouping is explicit through a callback: `where((q) => q.where(..).orWhere(..))`.
 */
export class QueryBuilder<T extends typeof BaseModel> {
    private clauses: WhereClause[] = [];
    private order: { column: string; direction: 'asc' | 'desc' } | null = null;
    private projection: string[] | undefined;
    private deferred = false;
    private trashed: 'exclude' | 'include' | 'only' = 'exclude';
    private windowLimit: number | undefined;
    private windowOffset = 0;
    private relations: string[] = [];
    private visible: string[] = [];
    private searchTerm: string | undefined;
    private searchFields: string[] = [];
    private dbDriver: DbDriver | undefined;

    constructor(private readonly model: T) {}

    // ── Where ────────────────────────────────────────────────

    /**
     * `where(column, value)` is equality. `where(column, operator, value)` takes a symbol or
     * name from `WhereOperator`. `where({ a: 1, b: [1, 2] })` merges a raw where object.
     * `where((q) => ...)` adds a parenthesised group.
     */
    where(column: Columns<T> | string, value: unknown): this;
    where(column: Columns<T> | string, operator: WhereOperator, value: unknown): this;
    where(raw: Record<string, unknown>): this;
    where(group: (q: QueryBuilder<T>) => void): this;
    where(...args: unknown[]): this {
        return this.push('and', this.clauseFrom(args));
    }

    orWhere(column: Columns<T> | string, value: unknown): this;
    orWhere(column: Columns<T> | string, operator: WhereOperator, value: unknown): this;
    orWhere(raw: Record<string, unknown>): this;
    orWhere(group: (q: QueryBuilder<T>) => void): this;
    orWhere(...args: unknown[]): this {
        return this.push('or', this.clauseFrom(args));
    }

    whereIn(column: Columns<T> | string, values: unknown[]): this {
        return this.where(column, 'in', values);
    }

    whereNotIn(column: Columns<T> | string, values: unknown[]): this {
        return this.where(column, 'notIn', values);
    }

    whereNull(column: Columns<T> | string): this {
        return this.push('and', { [column]: { $null: true } });
    }

    whereNotNull(column: Columns<T> | string): this {
        return this.push('and', { [column]: { $null: false } });
    }

    whereBetween(column: Columns<T> | string, [low, high]: [unknown, unknown]): this {
        return this.push('and', { [column]: { $gte: low, $lte: high } });
    }

    /** Escaped `LIKE %term%` (ASCII case-insensitive, D1 50-byte pattern limit applies). */
    whereContains(column: Columns<T> | string, term: string): this {
        return this.where(column, 'contains', term);
    }

    whereStartsWith(column: Columns<T> | string, term: string): this {
        return this.where(column, 'startsWith', term);
    }

    whereEndsWith(column: Columns<T> | string, term: string): this {
        return this.where(column, 'endsWith', term);
    }

    /** OR-ed LIKE across `fields`, the same path `searchPaginate` uses. Empty term is a no-op. */
    search(term: string, fields?: string[]): this {
        const trimmed = term.trim();
        if (!trimmed) return this;
        const resolved = fields ?? (this.model as any).getSearchableFields?.() ?? [];
        if (resolved.length === 0) throw new TypeError(`${this.model.entity} has no searchable fields`);
        this.searchTerm = trimmed;
        this.searchFields = resolved;
        return this;
    }

    // ── Shape ────────────────────────────────────────────────

    /**
     * One order column; the primary key is always the tie-breaker. Ordering by the primary key
     * after another column is therefore a no-op, and a second non-key column is refused rather
     * than silently ignored.
     */
    orderBy(column: Columns<T> | string, direction: 'asc' | 'desc' = 'asc'): this {
        if (this.order && column !== this.model.primaryKey) {
            throw new TypeError('orderBy accepts one column; the primary key is the implicit tie-breaker');
        }
        if (!this.order) this.order = { column, direction };
        return this;
    }

    latest(column: Columns<T> | string = 'createdAt'): this {
        return this.orderBy(column, 'desc');
    }

    oldest(column: Columns<T> | string = 'createdAt'): this {
        return this.orderBy(column, 'asc');
    }

    /** Column projection. The primary key is always included. */
    select(...columns: Array<Columns<T> | string>): this {
        this.projection = [...new Set(columns)];
        return this;
    }

    withDeferred(): this {
        this.deferred = true;
        return this;
    }

    withTrashed(): this {
        this.trashed = 'include';
        return this;
    }

    onlyTrashed(): this {
        this.trashed = 'only';
        return this;
    }

    limit(count: number): this {
        this.windowLimit = count;
        return this;
    }

    offset(count: number): this {
        this.windowOffset = count;
        return this;
    }

    /**
     * Eager-load relations after the main read: `'author'`, `'author:id{name,image}'`
     * (projection; the key is always kept), `'tags.category'` and `'tags.category:id{name}'`
     * (nested; the projection applies to the last segment). See `loadRelations`.
     */
    with(...relations: string[]): this {
        this.relations.push(...relations);
        return this;
    }

    /** Server-side only: reveal `hidden` fields on the returned instances for this query. */
    makeVisible(...fields: string[]): this {
        this.visible.push(...fields);
        return this;
    }

    using(driver: DbDriver): this {
        this.dbDriver = driver;
        return this;
    }

    clone(): QueryBuilder<T> {
        const copy = new QueryBuilder(this.model);
        copy.clauses = this.clauses.map((c) => ({ bool: c.bool, where: { ...c.where } }));
        copy.order = this.order ? { ...this.order } : null;
        copy.projection = this.projection ? [...this.projection] : undefined;
        copy.deferred = this.deferred;
        copy.trashed = this.trashed;
        copy.windowLimit = this.windowLimit;
        copy.windowOffset = this.windowOffset;
        copy.relations = [...this.relations];
        copy.visible = [...this.visible];
        copy.searchTerm = this.searchTerm;
        copy.searchFields = [...this.searchFields];
        copy.dbDriver = this.dbDriver;
        return copy;
    }

    // ── Compile ──────────────────────────────────────────────

    /** The where object this builder hands to the model statics. Exposed for tests and logging. */
    toWhere(): Record<string, unknown> {
        const groups: Record<string, unknown>[][] = [[]];
        for (const clause of this.clauses) {
            if (clause.bool === 'or' && groups[groups.length - 1].length > 0) groups.push([]);
            groups[groups.length - 1].push(clause.where);
        }
        const compiled = groups.filter((g) => g.length > 0).map((g) => (g.length === 1 ? g[0] : { $and: g }));
        const base = compiled.length === 0 ? {} : compiled.length === 1 ? compiled[0] : { $or: compiled };
        if (this.trashed === 'only') {
            return Object.keys(base).length
                ? { $and: [base, { deletedAt: { $ne: null } }] }
                : { deletedAt: { $ne: null } };
        }
        return base;
    }

    private options(extra?: Partial<CollectionQueryOptions>): CollectionQueryOptions {
        return {
            orderBy: this.order?.column,
            orderDirection: this.order?.direction,
            select: this.projection,
            withDeferred: this.deferred || undefined,
            ...extra,
        };
    }

    private get includeTrashed(): boolean {
        return this.trashed !== 'exclude';
    }

    // ── Terminals ────────────────────────────────────────────

    async get(): Promise<InstanceType<T>[]> {
        const where = this.toWhere();
        let rows: InstanceType<T>[];
        if (this.windowLimit !== undefined) {
            rows = await this.read(where, this.options({ limit: this.windowLimit, offset: this.windowOffset }));
        } else {
            // Same contract as `all()`: a complete set is proven to fit under the ceiling first.
            const max = getOttaORMMaxAllRows();
            const total = await this.count();
            if (total > max) throw new OttaORMAllRowsLimitError(total, max);
            rows = await this.read(where, this.options({ limit: max + 1, offset: this.windowOffset }));
            if (rows.length > max) throw new OttaORMAllRowsLimitError(rows.length, max);
        }
        return this.finish(rows);
    }

    async first(): Promise<InstanceType<T> | null> {
        const rows = await this.read(this.toWhere(), this.options({ limit: 1, offset: this.windowOffset }));
        return (await this.finish(rows))[0] ?? null;
    }

    async firstOrFail(): Promise<InstanceType<T>> {
        const row = await this.first();
        if (!row) throw new RecordNotFoundError(this.model.entity);
        return row;
    }

    async paginate(page = 1, perPage = 15): Promise<PaginationResult<InstanceType<T>>> {
        const where = this.toWhere();
        const options = this.options();
        const result = this.searchTerm
            ? await this.model.searchPaginate(
                  this.searchTerm,
                  this.searchFields,
                  page,
                  perPage,
                  where,
                  options,
                  this.dbDriver,
                  this.includeTrashed,
              )
            : await this.model.paginate(page, perPage, where, options, this.dbDriver, this.includeTrashed);
        return { ...result, data: await this.finish(result.data as InstanceType<T>[]) };
    }

    async count(): Promise<number> {
        const where = this.toWhere();
        return this.searchTerm
            ? this.model.countSearch(this.searchTerm, this.searchFields, where, this.dbDriver, this.includeTrashed)
            : this.model.count(where, this.dbDriver, this.includeTrashed);
    }

    async exists(): Promise<boolean> {
        const rows = await this.read(this.toWhere(), {
            orderBy: this.order?.column,
            orderDirection: this.order?.direction,
            select: [this.model.primaryKey],
            limit: 1,
        });
        return rows.length > 0;
    }

    async pluck<V = unknown>(column: Columns<T> | string): Promise<V[]> {
        const rows = await this.clone().select(column).get();
        return rows.map((row) => row.get(column) as V);
    }

    /** Primary-key keyset pages; the caller owns the scan. Search and `orderBy` do not apply. */
    pages(perPage?: number): AsyncGenerator<InstanceType<T>[], void, void> {
        return this.model.pages(
            {
                where: this.toWhere(),
                perPage,
                orderDirection: this.order?.direction,
                select: this.projection,
                withDeferred: this.deferred,
            },
            this.dbDriver,
            this.includeTrashed,
        );
    }

    async chunk(size: number, handler: (rows: InstanceType<T>[]) => Promise<void> | void): Promise<void> {
        for await (const page of this.pages(size)) {
            await handler(await this.finish(page));
        }
    }

    // ── Internals ────────────────────────────────────────────

    private clauseFrom(args: unknown[]): Record<string, unknown> {
        const [first, second, third] = args;
        if (typeof first === 'function') {
            const nested = new QueryBuilder(this.model);
            (first as (q: QueryBuilder<T>) => void)(nested);
            return nested.toWhere();
        }
        if (first && typeof first === 'object') return { ...(first as Record<string, unknown>) };
        if (typeof first !== 'string')
            throw new TypeError('where() needs a column, a where object or a group callback');
        if (args.length === 2) return { [first]: { $eq: second } };
        const key = OPERATOR_TO_KEY[second as WhereOperator];
        if (!key) throw new TypeError(`Unknown operator "${String(second)}"`);
        return { [first]: { [key]: third } };
    }

    private push(bool: 'and' | 'or', where: Record<string, unknown>): this {
        if (Object.keys(where).length > 0) this.clauses.push({ bool, where });
        return this;
    }

    private read(where: Record<string, unknown>, options: CollectionQueryOptions): Promise<InstanceType<T>[]> {
        if (this.searchTerm) {
            return this.model.search(
                this.searchTerm,
                this.searchFields,
                where,
                options,
                this.dbDriver,
                this.includeTrashed,
            ) as Promise<InstanceType<T>[]>;
        }
        return this.model.where(where, options, this.dbDriver, this.includeTrashed) as Promise<InstanceType<T>[]>;
    }

    /** Apply eager loading, projections and `makeVisible` to the loaded rows. */
    private async finish(rows: InstanceType<T>[]): Promise<InstanceType<T>[]> {
        if (rows.length === 0) return rows;
        if (this.visible.length) for (const row of rows) row.makeVisible(this.visible);
        if (this.relations.length === 0) return rows;

        await loadRelations(rows, this.relations);
        return rows;
    }
}
