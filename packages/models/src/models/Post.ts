import { z } from 'zod';
import { BaseModel } from '../base/BaseModel';
import { Model, Field, BelongsTo, BelongsToMany, Computed } from '../decorators';

/**
 * Post model - Blog posts and content management
 *
 * @example
 * ```typescript
 * // Query with relationships
 * const posts = await Post.query()
 *   .with('tags', 'categories', 'author')
 *   .where('published', true)
 *   .orderBy('createdAt', 'desc')
 *   .limit(10)
 *   .get();
 *
 * // Create new post
 * const post = await Post.create({
 *   title: 'My First Post',
 *   content: 'This is the content...',
 *   published: true,
 * });
 *
 * // Simplified syntax
 * const posts = await Post.fetch(100).with('tags', 'categories').get();
 * ```
 */
@Model({
  tableName: 'post',
  timestamps: true,
  hidden: ['authorId'],
  appends: ['excerpt'],
  with: ['author'],
})
export class Post extends BaseModel<Post> {
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
    label: 'Title',
    required: true,
    minLength: 3,
    maxLength: 200,
    validation: z.string().min(3).max(200),
    searchable: true,
    sortable: true,
  })
  title!: string;

  @Field({
    type: 'text',
    label: 'Content',
    placeholder: 'Write your post content here...',
    searchable: true,
  })
  content?: string;

  @Field({
    type: 'boolean',
    label: 'Published',
    default: false,
    filterable: true,
    sortable: true,
  })
  published!: boolean;

  @Field({
    type: 'string',
    label: 'Author ID',
    hidden: true,
  })
  authorId?: string;

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

  @BelongsTo('User', { foreignKey: 'authorId', eagerLoad: true })
  author?: any;

  @BelongsToMany('Tag', {
    through: 'PostTag',
    pivotForeignKey: 'postId',
    pivotRelatedKey: 'tagId',
  })
  tags?: any[];

  @BelongsToMany('Category', {
    through: 'PostCategory',
    pivotForeignKey: 'postId',
    pivotRelatedKey: 'categoryId',
  })
  categories?: any[];

  // Computed properties

  @Computed()
  get excerpt(): string {
    if (!this.content) return '';
    const maxLength = 150;
    if (this.content.length <= maxLength) return this.content;
    return this.content.substring(0, maxLength).trim() + '...';
  }

  @Computed()
  get wordCount(): number {
    if (!this.content) return 0;
    return this.content.split(/\s+/).filter(Boolean).length;
  }

  @Computed()
  get readingTime(): number {
    // Average reading speed: 200 words per minute
    return Math.ceil(this.wordCount / 200);
  }
}
