# @ottabase/models

Powerful ActiveRecord-style model abstraction layer for Ottabase with decorators, query builder, automatic CRUD generation, and comprehensive field metadata.

## Features

✨ **Class-based Models with Decorators** - Modern TypeScript decorators for defining models

🔍 **Fluent Query Builder** - Intuitive chainable API for building queries

📋 **Field Metadata** - Self-contained field definitions for automatic form/CRUD builders

🔗 **Relationships** - Full support for hasOne, hasMany, belongsTo, belongsToMany

✅ **Validation** - Built-in Zod validation with auto-generated schemas

🔒 **Hidden & Computed Fields** - Control JSON serialization and add virtual properties

⚡ **Getters/Setters** - Custom transformations for field values

📦 **Base Models Included** - Ready-to-use Post, Tag, and Category models

🎯 **Type-Safe** - Full TypeScript support with proper type inference

## Installation

The package is already included in the Ottabase monorepo. To use it:

```bash
# Install dependencies
pnpm install

# Build the package
pnpm --filter=@ottabase/models build
```

## Quick Start

### Import Models

```typescript
import { Post, Tag, Category } from '@ottabase/models';
```

### Query with Relationships

```typescript
// Fluent query builder
const posts = await Post.query()
  .with('tags', 'categories', 'author')
  .where('published', true)
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

// Simplified syntax
const posts = await Post.fetch(100).with('tags', 'categories').get();
```

### CRUD Operations

```typescript
// Create
const post = await Post.create({
  title: 'My First Post',
  content: 'This is the content...',
  published: true,
});

// Read
const post = await Post.find('post-id-123');
const posts = await Post.all();

// Update
await post.update({ title: 'Updated Title' });

// Delete
await post.delete();
```

### Field Metadata for Forms

```typescript
// Get all field metadata
const fields = Post.getAllFields();

// Use for automatic form generation
for (const [name, metadata] of fields.entries()) {
  console.log(`${name}: ${metadata.type} - ${metadata.label}`);
  // title: string - Title
  // content: text - Content
  // published: boolean - Published
}
```

### Computed Properties

```typescript
const post = await Post.find('post-id');

// Access computed properties
console.log(post.excerpt); // First 150 chars + "..."
console.log(post.wordCount); // Word count
console.log(post.readingTime); // Estimated reading time
```

## Defining Custom Models

### Basic Model

```typescript
import { BaseModel, Model, Field } from '@ottabase/models';
import { z } from 'zod';

@Model({
  tableName: 'products',
  timestamps: true,
  hidden: ['costPrice'],
})
export class Product extends BaseModel<Product> {
  @Field({
    type: 'cuid',
    primaryKey: true,
    hidden: true,
  })
  id!: string;

  @Field({
    type: 'string',
    label: 'Product Name',
    required: true,
    minLength: 3,
    maxLength: 100,
    searchable: true,
    sortable: true,
  })
  name!: string;

  @Field({
    type: 'number',
    label: 'Price',
    required: true,
    min: 0,
  })
  price!: number;

  @Field({
    type: 'number',
    label: 'Cost Price',
    hidden: true, // Won't appear in JSON
  })
  costPrice!: number;
}
```

### Model with Relationships

```typescript
@Model({ tableName: 'orders' })
export class Order extends BaseModel<Order> {
  @Field({ type: 'cuid', primaryKey: true })
  id!: string;

  @Field({ type: 'string' })
  userId!: string;

  // Belongs to User
  @BelongsTo('User', { foreignKey: 'userId', eagerLoad: true })
  user?: User;

  // Has many OrderItems
  @HasMany('OrderItem', { foreignKey: 'orderId' })
  items?: OrderItem[];
}
```

### Model with Computed Properties

```typescript
@Model({ tableName: 'invoices', appends: ['total', 'isPaid'] })
export class Invoice extends BaseModel<Invoice> {
  @Field({ type: 'number' })
  amount!: number;

  @Field({ type: 'date' })
  paidAt?: Date;

  @Computed()
  get total(): number {
    return this.amount * 1.2; // Add 20% tax
  }

  @Computed()
  get isPaid(): boolean {
    return !!this.paidAt;
  }
}
```

## Decorators

### @Model(options)

Configure model metadata.

```typescript
@Model({
  tableName: 'posts',      // Table name (default: lowercase model name)
  timestamps: true,        // Enable createdAt/updatedAt (default: true)
  softDeletes: false,      // Enable soft deletes (default: false)
  hidden: ['password'],    // Fields hidden from JSON
  appends: ['fullName'],   // Computed properties in JSON
  with: ['author'],        // Default eager loading
})
```

### @Field(metadata)

Define a model field with metadata.

```typescript
@Field({
  type: 'string',          // Field type (required)
  label: 'Title',          // Display label
  placeholder: 'Enter..', // Form placeholder
  helpText: 'Help text',   // Field description
  required: true,          // Is required
  unique: true,            // Is unique
  default: 'value',        // Default value
  hidden: false,           // Hide from JSON
  readonly: true,          // Cannot be modified
  searchable: true,        // Can be searched
  sortable: true,          // Can be sorted
  filterable: true,        // Can be filtered
  validation: z.string(),  // Zod schema
  min: 0,                  // Min value (number)
  max: 100,                // Max value (number)
  minLength: 3,            // Min length (string)
  maxLength: 200,          // Max length (string)
  pattern: /regex/,        // Regex pattern
  enumValues: ['a', 'b'],  // Enum options
  get: (v) => transform,   // Custom getter
  set: (v) => transform,   // Custom setter
})
```

**Supported Field Types:**
- `string`, `text`, `email`, `url`
- `number`, `integer`, `float`, `decimal`
- `boolean`
- `date`, `datetime`, `timestamp`
- `json`, `array`
- `enum`
- `uuid`, `cuid`
- `file`, `image`

### Relationship Decorators

```typescript
// One-to-one
@HasOne('Profile', { foreignKey: 'userId' })
profile?: Profile;

// One-to-many
@HasMany('Post', { foreignKey: 'authorId' })
posts?: Post[];

// Inverse of one-to-many
@BelongsTo('User', { foreignKey: 'authorId' })
author?: User;

// Many-to-many
@BelongsToMany('Tag', {
  through: 'PostTag',
  pivotForeignKey: 'postId',
  pivotRelatedKey: 'tagId',
})
tags?: Tag[];

// Eager load by default
@BelongsTo('User')
@With()
author?: User;
```

### Utility Decorators

```typescript
// Primary key (shorthand)
@PrimaryKey()
id!: string;

// Computed property
@Computed()
get fullName(): string {
  return `${this.firstName} ${this.lastName}`;
}

// Hidden from JSON
@Hidden()
password!: string;
```

## Query Builder API

### Basic Queries

```typescript
// Get all
const all = await Post.all();

// Find by ID
const post = await Post.find('id-123');

// Find or fail
const post = await Post.findOrFail('id-123');

// Find one
const post = await Post.findOne({ slug: 'my-post' });

// Find many
const posts = await Post.findMany({ published: true });
```

### Query Builder

```typescript
Post.query()
  // Eager load relationships
  .with('tags', 'categories', 'author')

  // Where conditions
  .where('published', true)
  .where({ status: 'active' })
  .whereNot('featured', true)
  .whereIn('status', ['draft', 'published'])
  .whereNotIn('id', excludedIds)
  .whereNull('deletedAt')
  .whereNotNull('publishedAt')
  .whereContains('title', 'JavaScript')
  .whereStartsWith('slug', 'js-')
  .whereEndsWith('title', '2024')

  // Ordering
  .orderBy('createdAt', 'desc')
  .orderBy('title', 'asc')

  // Pagination
  .limit(10)
  .offset(20)
  .skip(20)

  // Select fields
  .select('id', 'title', 'slug')

  // Soft deletes
  .withTrashed()
  .onlyTrashed()

  // Execute
  .get()              // Get all results
  .first()            // Get first result
  .firstOrFail()      // Get first or throw
  .count()            // Get count
  .exists()           // Check if any exist
  .paginate(1, 15);   // Paginate results
```

### Pagination

```typescript
const result = await Post.query()
  .where('published', true)
  .paginate(1, 15);

console.log(result);
// {
//   data: [...],
//   total: 100,
//   page: 1,
//   perPage: 15,
//   lastPage: 7
// }
```

## Instance Methods

```typescript
// Get/Set attributes
post.get('title');
post.set('title', 'New Title');

// Update and save
await post.update({ title: 'Updated' });
await post.save();

// Delete
await post.delete();

// Reload from database
await post.reload();

// Load relationships
await post.load('tags', 'categories');

// Serialization
const json = post.toJSON();    // Respects hidden/appends
const obj = post.toObject();   // Raw data

// State checking
post.isDirty();   // Has unsaved changes
post.exists();    // Exists in database
```

## Validation

```typescript
// Auto-generated from field metadata
const schema = Post.getValidationSchema();

// Validate data
const validated = Post.validate({
  title: 'My Post',
  content: 'Content...',
});

// Custom validation in field
@Field({
  type: 'string',
  validation: z.string()
    .min(3)
    .max(200)
    .regex(/^[A-Za-z0-9\s]+$/),
})
title!: string;
```

## Base Models

### Post

Blog posts with tags and categories.

```typescript
const post = await Post.create({
  title: 'My Post',
  content: 'Content...',
  published: true,
});

// With relationships
const posts = await Post.fetch(10)
  .with('tags', 'categories', 'author')
  .get();

// Computed properties
console.log(post.excerpt);      // Auto-generated excerpt
console.log(post.wordCount);    // Word count
console.log(post.readingTime);  // Reading time (minutes)
```

### Tag

Tags for categorizing content.

```typescript
// Create tag
const tag = await Tag.create({
  name: 'JavaScript',
  slug: 'javascript',
});

// Slugify helper
const slug = Tag.slugify('My Tag Name'); // 'my-tag-name'

// Find or create
const tag = await Tag.findOrCreate('JavaScript');
```

### Category

Hierarchical categories.

```typescript
// Create category
const category = await Category.create({
  name: 'Technology',
  slug: 'technology',
});

// Create subcategory
const subCategory = await Category.create({
  name: 'JavaScript',
  slug: 'javascript',
  parentId: category.id,
});

// Get top-level categories
const topLevel = await Category.getTopLevel();

// Get category tree
const tree = await Category.getTree();

// Get breadcrumbs
const breadcrumbs = await category.getBreadcrumbs();
// [Technology, Programming, JavaScript]
```

## Custom Models in Apps

Apps can define custom models in `ottabase/models/`:

```typescript
// apps/your-app/ottabase/models/Product.ts
import { BaseModel, Model, Field } from '@ottabase/models';

@Model({ tableName: 'product' })
export class Product extends BaseModel<Product> {
  @Field({ type: 'cuid', primaryKey: true })
  id!: string;

  @Field({ type: 'string', required: true })
  name!: string;
}

// Use in your app
import { Product } from './ottabase/models/Product';

const products = await Product.query()
  .where('inStock', true)
  .get();
```

## Prisma Schema Setup

To use the base models, include them in your Prisma config:

```javascript
// apps/your-app/ottabase/prisma/prisma.config.js
const { definePrismaConfig } = require("@ottabase/db/prisma");

module.exports = definePrismaConfig({
  coreSchemas: ["user", "post", "tag", "category"],  // Include schemas
  datasource: "d1",
  appSchemaPath: "ottabase/prisma/app.schema.prisma",
  outputSchemaPath: "prisma/schema.prisma",
});
```

Then run:

```bash
pnpm db:generate
```

## TypeScript Configuration

The models package requires decorators. Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false
  }
}
```

## Advanced Usage

### Custom Getters/Setters

```typescript
@Field({
  type: 'string',
  get: (value) => value?.toUpperCase(),
  set: (value) => value?.toLowerCase(),
})
code!: string;
```

### Field Metadata for Forms

```typescript
// Get all fields for form generation
const fields = Post.getAllFields();

// Generate form from metadata
for (const [name, meta] of fields.entries()) {
  if (meta.hidden || meta.readonly) continue;

  const input = {
    name,
    type: meta.type,
    label: meta.label,
    placeholder: meta.placeholder,
    required: meta.required,
    min: meta.min,
    max: meta.max,
    // ... use metadata to build form
  };
}
```

### Relationship Loading

```typescript
// Eager load
const posts = await Post.query().with('tags', 'author').get();

// Lazy load
const post = await Post.find('id');
await post.load('tags', 'categories');

// Default eager loading
@Model({ with: ['author'] })  // Always load author
```

## API Reference

### BaseModel

Static methods:
- `query()` - Create query builder
- `fetch(limit)` - Quick query with limit
- `find(id)` - Find by ID
- `findOrFail(id)` - Find or throw
- `findOne(where)` - Find first
- `findMany(where)` - Find all matching
- `all()` - Get all records
- `create(data)` - Create record
- `createMany(data)` - Create multiple
- `updateMany(where, data)` - Update multiple
- `deleteMany(where)` - Delete multiple
- `validate(data)` - Validate data
- `getValidationSchema()` - Get Zod schema
- `getAllFields()` - Get field metadata
- `getAllRelations()` - Get relation metadata

Instance methods:
- `fill(data)` - Fill with data
- `get(field)` - Get attribute
- `set(field, value)` - Set attribute
- `update(data)` - Update and save
- `save()` - Save changes
- `delete()` - Delete record
- `reload()` - Reload from DB
- `load(...relations)` - Load relations
- `toJSON()` - Serialize to JSON
- `toObject()` - Get raw data
- `isDirty()` - Check for changes
- `exists()` - Check if persisted

## License

MIT

## Contributing

Contributions welcome! This package is part of the Ottabase monorepo.
