# @ottabase/comments

Threaded comment system for Ottabase apps with polymorphic targeting, reactions, and moderation.

## Features

- **Polymorphic targeting** — attach comments to any entity type (post, page, todo, etc.)
- **Threaded replies** — self-referencing parent/child with depth tracking
- **Emoji reactions** — per-user reaction map stored as JSON
- **Moderation** — flag, hide, soft-delete, and restore actions
- **OttaORM fat model** — all logic lives in the `Comment` model class
- **RLS-aware** — supports `organizationId` and `appId` for multi-tenant isolation

## Installation

```bash
pnpm add @ottabase/comments
```

Use `workspace:*` for internal workspace packages:

```json
{ "@ottabase/comments": "workspace:*" }
```

## Schema

| Column           | Type      | Description                                    |
| ---------------- | --------- | ---------------------------------------------- |
| `id`             | text (PK) | Auto-generated UUID                            |
| `body`           | text      | Comment content                                |
| `targetType`     | text      | Entity type being commented on (e.g. `'post'`) |
| `targetId`       | text      | ID of the entity being commented on            |
| `parentId`       | text      | Parent comment ID (null = top-level)           |
| `userId`         | text      | Author's user ID (nullable for anonymous)      |
| `status`         | text      | `active` \| `deleted` \| `flagged` \| `hidden` |
| `reactions`      | json      | `{ "👍": ["userId1", "userId2"] }`             |
| `depth`          | integer   | Nesting depth (0 = top-level, 1 = reply, etc.) |
| `appId`          | text      | Multi-app support                              |
| `organizationId` | text      | Multi-tenant support                           |
| `createdAt`      | integer   | Unix epoch ms                                  |
| `updatedAt`      | integer   | Unix epoch ms, auto-updated on save            |

## Usage

### Creating a comment

```typescript
import { Comment } from '@ottabase/comments';

const comment = await Comment.create({
    body: 'Great post!',
    targetType: 'post',
    targetId: 'post-abc-123',
    userId: 'user-xyz',
});
```

### Creating a reply

```typescript
const reply = await Comment.create({
    body: 'Totally agree!',
    targetType: 'post',
    targetId: 'post-abc-123',
    parentId: comment.get('id'),
    userId: 'user-456',
    depth: 1,
});
```

### Toggling reactions

```typescript
// Toggle — adds if absent, removes if present
await comment.toggleReaction('👍', 'user-xyz');

// Add/remove explicitly
await comment.addReaction('❤️', 'user-xyz');
await comment.removeReaction('❤️', 'user-xyz');
```

### Moderation actions

```typescript
await comment.flag(); // status → 'flagged'
await comment.hide(); // status → 'hidden'
await comment.softDelete(); // status → 'deleted', body → '[deleted]'
await comment.restore(); // status → 'active'
```

### Querying via CRUD API

```
GET /api/ottaorm/comments?filter[targetType]=post&filter[targetId]=post-abc-123
GET /api/ottaorm/comments?filter[targetType]=post&filter[targetId]=post-abc-123&filter[status]=active
GET /api/ottaorm/comments?filter[parentId]=comment-id-123
```

### Client hooks

```typescript
// src/hooks/commentHooks.ts
import { createModelHooks } from '@ottabase/ottaorm/client';
import type { CommentRecord } from '@ottabase/comments';

export const {
    useList: useComments,
    useDetail: useComment,
    useCreate: useCreateComment,
    useUpdate: useUpdateComment,
    useDelete: useDeleteComment,
} = createModelHooks<CommentRecord>({ entityName: 'comments' });

// Usage in a component:
const { data: comments } = useComments({
    filters: { targetType: 'post', targetId: 'post-abc-123', status: 'active' },
});
```

## App Integration

When integrating into an app, modify these files:

1. **`ottabase/config.migrations.ts`** — add `commentsTable` to `PACKAGE_REGISTRY`
2. **`ottabase/ottabase.config.ts`** — add `'comments'` to `customPackages`
3. **`ottabase/db/schema.ts`** — `export { commentsTable } from '@ottabase/comments/schema'`
4. **`worker/lib/db-utils.ts`** — add `Comment` to the `registerModels` array in `initDbConnection`

Then run migrations:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Types

| Type                  | Description                                      |
| --------------------- | ------------------------------------------------ |
| `CommentRecord`       | Full row type inferred from `commentsTable`      |
| `NewCommentRecord`    | Insert type for creating new comments            |
| `CommentStatus`       | `'active' \| 'deleted' \| 'flagged' \| 'hidden'` |
| `ReactionsMap`        | `Record<string, string[]>` — emoji → user IDs    |
| `DefaultReaction`     | Union of the 6 built-in emoji strings            |
| `CreateCommentParams` | Parameters for creating a comment                |
| `ListCommentsParams`  | Parameters for listing comments on a target      |
| `DEFAULT_REACTIONS`   | `['👍', '👎', '❤️', '😂', '😮', '😢']`           |
