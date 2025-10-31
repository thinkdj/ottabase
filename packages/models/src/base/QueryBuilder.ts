import type { OrderDirection, QueryOptions, WhereCondition } from './types';

/**
 * Fluent query builder for models
 *
 * @example
 * ```typescript
 * const posts = await Post.query()
 *   .with('tags', 'categories')
 *   .where('published', true)
 *   .orderBy('createdAt', 'desc')
 *   .limit(10)
 *   .get();
 * ```
 */
export class QueryBuilder<T = any> {
  private options: QueryOptions = {};
  private whereConditions: WhereCondition = {};
  private orderByConditions: Array<{ field: string; direction: OrderDirection }> = [];

  constructor(
    private modelClass: any,
    private executeFn: (options: QueryOptions) => Promise<T[]>
  ) {}

  /**
   * Eager load relationships
   */
  with(...relations: string[]): this {
    if (!this.options.with) {
      this.options.with = [];
    }
    this.options.with.push(...relations);
    return this;
  }

  /**
   * Add where condition
   */
  where(field: string, value: any): this;
  where(conditions: WhereCondition): this;
  where(fieldOrConditions: string | WhereCondition, value?: any): this {
    if (typeof fieldOrConditions === 'string') {
      this.whereConditions[fieldOrConditions] = value;
    } else {
      Object.assign(this.whereConditions, fieldOrConditions);
    }
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where not condition
   */
  whereNot(field: string, value: any): this {
    this.whereConditions[field] = { not: value };
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where in condition
   */
  whereIn(field: string, values: any[]): this {
    this.whereConditions[field] = { in: values };
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where not in condition
   */
  whereNotIn(field: string, values: any[]): this {
    this.whereConditions[field] = { notIn: values };
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where null condition
   */
  whereNull(field: string): this {
    this.whereConditions[field] = null;
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where not null condition
   */
  whereNotNull(field: string): this {
    this.whereConditions[field] = { not: null };
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where contains condition (for strings)
   */
  whereContains(field: string, value: string): this {
    this.whereConditions[field] = { contains: value };
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where starts with condition
   */
  whereStartsWith(field: string, value: string): this {
    this.whereConditions[field] = { startsWith: value };
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add where ends with condition
   */
  whereEndsWith(field: string, value: string): this {
    this.whereConditions[field] = { endsWith: value };
    this.options.where = this.whereConditions;
    return this;
  }

  /**
   * Add order by clause
   */
  orderBy(field: string, direction: OrderDirection = 'asc'): this {
    this.orderByConditions.push({ field, direction });
    this.options.orderBy = this.orderByConditions;
    return this;
  }

  /**
   * Set limit
   */
  limit(limit: number): this {
    this.options.limit = limit;
    return this;
  }

  /**
   * Set offset/skip
   */
  offset(offset: number): this {
    this.options.offset = offset;
    return this;
  }

  /**
   * Set skip (alias for offset)
   */
  skip(skip: number): this {
    return this.offset(skip);
  }

  /**
   * Select specific fields
   */
  select(...fields: string[]): this {
    this.options.select = fields;
    return this;
  }

  /**
   * Include soft deleted records
   */
  withTrashed(): this {
    this.options.withTrashed = true;
    return this;
  }

  /**
   * Only soft deleted records
   */
  onlyTrashed(): this {
    this.options.onlyTrashed = true;
    return this;
  }

  /**
   * Execute query and get results
   */
  async get(): Promise<T[]> {
    return this.executeFn(this.options);
  }

  /**
   * Get first result
   */
  async first(): Promise<T | null> {
    this.limit(1);
    const results = await this.get();
    return results[0] || null;
  }

  /**
   * Get first result or throw
   */
  async firstOrFail(): Promise<T> {
    const result = await this.first();
    if (!result) {
      throw new Error(`No results found for ${this.modelClass.name} query`);
    }
    return result;
  }

  /**
   * Get count of results
   */
  async count(): Promise<number> {
    const results = await this.get();
    return results.length;
  }

  /**
   * Check if any results exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Paginate results
   */
  async paginate(page: number = 1, perPage: number = 15): Promise<{
    data: T[];
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
  }> {
    const offset = (page - 1) * perPage;
    this.offset(offset).limit(perPage);

    const data = await this.get();
    const total = await this.count();
    const lastPage = Math.ceil(total / perPage);

    return {
      data,
      total,
      page,
      perPage,
      lastPage,
    };
  }

  /**
   * Execute a custom Prisma query
   */
  async raw(prismaQuery: any): Promise<T[]> {
    return prismaQuery;
  }

  /**
   * Get the query options (for debugging)
   */
  getOptions(): QueryOptions {
    return { ...this.options };
  }

  /**
   * Clone the query builder
   */
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>(this.modelClass, this.executeFn);
    cloned.options = { ...this.options };
    cloned.whereConditions = { ...this.whereConditions };
    cloned.orderByConditions = [...this.orderByConditions];
    return cloned;
  }
}
