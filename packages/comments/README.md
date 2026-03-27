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

```bash
GET /api/ottaorm/comments?where={"targetType":"post","targetId":"post-abc-123"}
GET /api/ottaorm/comments?where={"targetType":"post","targetId":"post-abc-123","status":"active"}
GET /api/ottaorm/comments?where={"parentId":"comment-id-123"}
```

> **Note:** The route handler in `worker/routes/ottaorm-crud.ts` enforces two security rules:
>
> 1. **`userId` / `organizationId`** are always overwritten from the session on POST — clients cannot impersonate other
>    users or cross tenants.
> 2. **Reactions** are not directly writable via PATCH. Send `_reaction: "<emoji>"` instead; the server calls
>    `comment.toggleReaction(emoji, userId)`, scoping the change to the authenticated user only. Sending a raw
>    `reactions` map in a PATCH body is silently ignored by the OttaORM sanitizer.
>
> RLS uses `TenantScoped` policy to automatically scope reads to the current organization.

### Client hooks

```typescript
// src/hooks/commentHooks.ts
import { type CommentRecord } from '@ottabase/comments';
import { createModelHooks } from '@ottabase/ottaorm/client';

/** User data attached by the server-side enrichment in ottaorm-crud.ts */
export interface CommentUser {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: number;
}

/** Comment row enriched with optional user data */
export type CommentType = CommentRecord & { _user?: CommentUser | null };

export const {
    useList: useComments,
    useDetail: useComment,
    useCreate: useCreateComment,
    useUpdate: useUpdateComment,
    useDelete: useDeleteComment,
} = createModelHooks<CommentType>({ entityName: 'comments' });

// Usage in a component:
const { data: comments } = useComments({
    where: { targetType: 'post', targetId: 'post-abc-123', status: 'active' },
});

// Each comment has `_user` with { id, name, image, createdAt } for avatar rendering
comments?.forEach((c) => console.log(c._user?.name));
```

### User enrichment

When fetching comments via `GET /api/ottaorm/comments`, the CRUD route handler automatically enriches each comment with
the author's `name`, `image`, and `createdAt` from the User model. The enriched data is available under the `_user`
property.

This enables rendering user avatars and "member since" tooltips without extra API calls. The enrichment is a batch
lookup (`User.whereIn`) — one query regardless of how many unique authors appear in the result set.

If the User lookup fails, comments are returned normally with `_user: null`.

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

## Demo Page

The template app includes a demo at `/demo/comments` with two modes:

- **In-memory** (default) — local state with mock users/comments; works offline, no database required
- **Database** — reads and writes to the actual D1 database via the CRUD API

Both modes use the same `CommentThread` renderer which supports:

- **User avatars** — rendered from `_user.name`/`_user.image` with initials fallback and "member since" tooltip
- **Load-more for root comments** — initially shows 5 root comments, click to load more
- **Load-more for nested replies** — initially shows 3 replies per parent, click to expand
- **Reaction toggling** — per-user emoji reactions
- **Inline reply form** — reply to any comment up to depth 3
- **Moderation actions** — flag, hide, soft-delete

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
