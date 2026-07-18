# @ottabase/comments

Threaded comment system for Ottabase apps with polymorphic targeting, reactions, and moderation.

## Features

- **Polymorphic targeting** — attach comments to any entity type (post, page, todo, etc.)
- **Threaded replies** — self-referencing parent/child with depth tracking, server-validated against the parent's
  target and organization
- **Emoji reactions** — per-user reactions in a dedicated `comment_reactions` table; toggling is an atomic
  single-row insert/delete rather than a read-modify-write, so concurrent reactors never race
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

### `comments`

| Column           | Type      | Description                                                                     |
| ---------------- | --------- | -------------------------------------------------------------------------------- |
| `id`             | text (PK) | Auto-generated UUID                                                             |
| `body`           | text      | Comment content (max 10,000 characters)                                        |
| `targetType`     | text      | Entity type being commented on (e.g. `'post'`)                                  |
| `targetId`       | text      | ID of the entity being commented on                                             |
| `parentId`       | text      | Parent comment ID (null = top-level)                                            |
| `userId`         | text      | Author's user ID (nullable for anonymous)                                       |
| `status`         | text      | `active` \| `deleted` \| `flagged` \| `hidden`                                  |
| `depth`          | integer   | Nesting depth (0 = top-level, 1 = reply, etc.); always server-computed          |
| `appId`          | text      | Multi-app support                                                               |
| `organizationId` | text      | Multi-tenant support                                                            |
| `createdAt`      | integer   | Unix epoch ms                                                                   |
| `updatedAt`      | integer   | Unix epoch ms, auto-updated on save                                             |

### `comment_reactions`

| Column      | Type      | Description                           |
| ----------- | --------- | -------------------------------------- |
| `id`        | text (PK) | Auto-generated UUID                   |
| `commentId` | text      | The comment this reaction belongs to  |
| `emoji`     | text      | The emoji reacted with                |
| `userId`    | text      | The reacting user's ID                |
| `createdAt` | integer   | Unix epoch ms                         |

One row per `(commentId, emoji, userId)` (unique constraint). This replaces the old `reactions` JSON column on
`comments` — mutating a shared blob on every toggle could race under concurrent reactors, whereas a dedicated
row per reaction makes each toggle an atomic single-row insert/delete.

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

`toggleReaction` is the only reaction-mutating method on `Comment` — adds the reaction if the user hasn't used
that emoji on this comment yet, removes it if they have. Under the hood it delegates to the `CommentReaction`
model, which does a single atomic row delete-or-insert against `comment_reactions` (no read-modify-write on the
comment itself).

```typescript
const { added } = await comment.toggleReaction('👍', 'user-xyz');
```

For batch reads (e.g. rendering a list of comments), use `CommentReaction.reactionsFor`, which returns a
`Map<commentId, ReactionsMap>` in the same `{ "👍": ["userId1", "userId2"] }` shape the old JSON column used:

```typescript
import { CommentReaction } from '@ottabase/comments';

const reactionsByComment = await CommentReaction.reactionsFor(['comment-1', 'comment-2']);
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

> **Note:** The route handler in `worker/routes/ottaorm-crud.ts` enforces several security rules:
>
> 1. **`userId` / `organizationId` / `depth`** are always overwritten from the session and server-side computation
>    on POST — clients cannot impersonate other users, cross tenants, or forge a nesting depth.
> 2. **Replies validate their parent.** A `parentId` is only accepted when the parent comment exists and belongs
>    to the exact same `targetType`/`targetId`/`organizationId` as the new comment; otherwise the request is
>    rejected with 400. This stops a reply from being attached to an unrelated or cross-tenant comment.
> 3. **Reactions** are not directly writable via PATCH, and the `comment_reactions` model is not exposed via the
>    generic CRUD endpoint at all (403). Send `_reaction: "<emoji>"` in a comment PATCH instead; the server calls
>    `comment.toggleReaction(emoji, userId)`, scoping the change to the authenticated user only.
>
> RLS uses `TenantScoped` policy to automatically scope reads to the current organization.

### Client hooks

```typescript
// src/hooks/commentHooks.ts
import { type CommentRecord, type ReactionsMap } from '@ottabase/comments';
import { createModelHooks } from '@ottabase/ottaorm/client';

/** User data attached by the server-side enrichment in ottaorm-crud.ts */
export interface CommentUser {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: number;
}

/** Comment row enriched with optional user data and aggregated reactions */
export type CommentType = CommentRecord & { _user?: CommentUser | null; reactions?: ReactionsMap };

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

### User & reaction enrichment

When fetching comments via `GET /api/ottaorm/comments`, the CRUD route handler automatically enriches each comment
with:

- the author's `name`, `image`, and `createdAt` from the User model, under the `_user` property
- a `reactions` map (`{ "👍": ["userId1", "userId2"] }`) aggregated from the `comment_reactions` table, under the
  `reactions` property — note that `CommentRecord` itself no longer has a `reactions` field, since reactions live
  in their own table now; this enrichment is what puts it back on the API response

Both enrichments are batch lookups (`User.whereIn`, `CommentReaction.reactionsFor`) — one query each regardless of
how many unique authors or reacted comments appear in the result set, so listing N comments doesn't cost N extra
queries.

If the User lookup fails, comments are returned normally with `_user: null`.

## App Integration

When integrating into an app, modify these files:

1. **`ottabase/config.migrations.ts`** — add `commentsTable` and `commentReactionsTable` (both from
   `@ottabase/comments`) to `PACKAGE_REGISTRY`
2. **`ottabase/ottabase.config.ts`** — add `'comments'` to `customPackages`
3. **`ottabase/db/schema.ts`** — `export { commentsTable } from '@ottabase/comments/schema'`, plus
   `export { commentReactionsTable } from '@ottabase/comments'` (the reactions table isn't re-exported from the
   `/schema` subpath yet, so pull it from the package root instead)
4. **`worker/lib/db-utils.ts`** — add `Comment` and `CommentReaction` to the `registerModels` array in
   `initDbConnection`

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

| Type                       | Description                                                 |
| -------------------------- | ------------------------------------------------------------- |
| `CommentRecord`            | Full row type inferred from `commentsTable` (no `reactions` field — see enrichment above) |
| `NewCommentRecord`         | Insert type for creating new comments                       |
| `CommentReactionRecord`    | Full row type inferred from `commentReactionsTable`          |
| `NewCommentReactionRecord` | Insert type for creating new comment reactions               |
| `CommentStatus`            | `'active' \| 'deleted' \| 'flagged' \| 'hidden'`             |
| `ReactionsMap`             | `Record<string, string[]>` — emoji → user IDs                |
| `DefaultReaction`          | Union of the 6 built-in emoji strings                        |
| `CreateCommentParams`      | Parameters for creating a comment                             |
| `ListCommentsParams`       | Parameters for listing comments on a target                   |
| `DEFAULT_REACTIONS`        | `['👍', '👎', '❤️', '😂', '😮', '😢']`                       |
