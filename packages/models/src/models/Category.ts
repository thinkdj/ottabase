import { z } from 'zod';
import { BaseModel } from '../base/BaseModel';
import { Model, Field, BelongsTo, HasMany, BelongsToMany, Computed } from '../decorators';

/**
 * Category model - Categories for organizing posts (supports hierarchical structure)
 *
 * @example
 * ```typescript
 * // Create a category
 * const category = await Category.create({
 *   name: 'Technology',
 *   slug: 'technology',
 * });
 *
 * // Create subcategory
 * const subCategory = await Category.create({
 *   name: 'JavaScript',
 *   slug: 'javascript',
 *   parentId: category.id,
 * });
 *
 * // Find category with children and posts
 * const category = await Category.query()
 *   .with('children', 'posts')
 *   .where('slug', 'technology')
 *   .first();
 *
 * // Get top-level categories only
 * const topCategories = await Category.query()
 *   .whereNull('parentId')
 *   .orderBy('name', 'asc')
 *   .get();
 * ```
 */
@Model({
  tableName: 'category',
  timestamps: true,
})
export class Category extends BaseModel<Category> {
  @Field({
    type: 'cuid',
    label: 'ID',
    primaryKey: true,
    readonly: true,
    hidden: true,
  })
  id!: string;

  @Field({
    type: 'string',
    label: 'Name',
    required: true,
    unique: true,
    minLength: 1,
    maxLength: 100,
    validation: z.string().min(1).max(100),
    searchable: true,
    sortable: true,
  })
  name!: string;

  @Field({
    type: 'string',
    label: 'Slug',
    required: true,
    unique: true,
    helpText: 'URL-friendly version of the name',
    validation: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    searchable: true,
  })
  slug!: string;

  @Field({
    type: 'string',
    label: 'Parent Category',
    helpText: 'Parent category for hierarchical structure',
    hidden: true,
  })
  parentId?: string;

  @Field({
    type: 'datetime',
    label: 'Created At',
    readonly: true,
    sortable: true,
  })
  createdAt!: Date;

  @Field({
    type: 'datetime',
    label: 'Updated At',
    readonly: true,
    sortable: true,
  })
  updatedAt!: Date;

  // Relationships

  @BelongsTo('Category', { foreignKey: 'parentId' })
  parent?: Category;

  @HasMany('Category', { foreignKey: 'parentId' })
  children?: Category[];

  @BelongsToMany('Post', {
    through: 'PostCategory',
    pivotForeignKey: 'categoryId',
    pivotRelatedKey: 'postId',
  })
  posts?: any[];

  // Computed properties

  @Computed()
  get isTopLevel(): boolean {
    return !this.parentId;
  }

  @Computed()
  get depth(): number {
    // This would need to be calculated by loading parent chain
    // For now, return 0 for top-level, 1 for children
    return this.parentId ? 1 : 0;
  }

  // Helper methods

  /**
   * Generate slug from name
   */
  static slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Find or create a category by name
   */
  static async findOrCreate(
    name: string,
    parentId?: string
  ): Promise<Category> {
    const slug = this.slugify(name);

    let category = await this.findOne({ slug }) as Category | null;

    if (!category) {
      category = await this.create({ name, slug, parentId }) as Category;
    }

    return category;
  }

  /**
   * Get all top-level categories
   */
  static async getTopLevel(): Promise<Category[]> {
    return this.query<Category>().whereNull('parentId').orderBy('name', 'asc').get();
  }

  /**
   * Get category tree (hierarchical structure)
   */
  static async getTree(): Promise<Category[]> {
    const topLevel = await this.getTopLevel();

    // Load children for each top-level category
    for (const category of topLevel) {
      await category.load('children');
    }

    return topLevel;
  }

  /**
   * Get all ancestors (parent chain) for this category
   */
  async getAncestors(): Promise<Category[]> {
    const ancestors: Category[] = [];
    let current: Category | null = this;

    while (current?.parentId) {
      const parent = await (this.constructor as typeof Category).find(
        current.parentId
      );
      if (parent) {
        ancestors.unshift(parent as Category);
        current = parent as Category;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get breadcrumb path (ancestors + self)
   */
  async getBreadcrumbs(): Promise<Category[]> {
    const ancestors = await this.getAncestors();
    return [...ancestors, this];
  }
}
