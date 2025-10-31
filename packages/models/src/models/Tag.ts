import { z } from 'zod';
import { BaseModel } from '../base/BaseModel';
import { Model, Field, BelongsToMany } from '../decorators';

/**
 * Tag model - Tags for categorizing posts and content
 *
 * @example
 * ```typescript
 * // Create a tag
 * const tag = await Tag.create({
 *   name: 'JavaScript',
 *   slug: 'javascript',
 * });
 *
 * // Find tag with posts
 * const tag = await Tag.query()
 *   .with('posts')
 *   .where('slug', 'javascript')
 *   .first();
 *
 * // Get all tags ordered by name
 * const tags = await Tag.query().orderBy('name', 'asc').get();
 * ```
 */
@Model({
  tableName: 'tag',
  timestamps: true,
})
export class Tag extends BaseModel<Tag> {
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
    maxLength: 50,
    validation: z.string().min(1).max(50),
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
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    searchable: true,
  })
  slug!: string;

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

  @BelongsToMany('Post', {
    through: 'PostTag',
    pivotForeignKey: 'tagId',
    pivotRelatedKey: 'postId',
  })
  posts?: any[];

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
   * Find or create a tag by name
   */
  static async findOrCreate(name: string): Promise<Tag> {
    const slug = this.slugify(name);

    let tag = await this.findOne({ slug }) as Tag | null;

    if (!tag) {
      tag = await this.create({ name, slug }) as Tag;
    }

    return tag;
  }
}
