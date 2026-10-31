# @ottabase/comments

Threaded comment system for Ottabase apps with polymorphic targeting, reactions, and moderation.

## Features

- **Polymorphic targeting** — attach comments to any entity type (post, page, todo, etc.)
- **Threaded replies** — self-referencing parent/child with depth tracking
- **Emoji reactions** — normalized per-user rows in `comment_reactions`, enriched back into an aggregated map
- **Moderation** — flag, hide, soft-delete, and restore actions
- **Anonymous (guest) comments**: a display name, an optional private email, held for a moderator
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

| Column           | Type      | Description                                                 |
| ---------------- | --------- | ----------------------------------------------------------- |
| `id`             | text (PK) | Auto-generated UUID                                         |
| `body`           | text      | Comment content                                             |
| `targetType`     | text      | Entity type being commented on (e.g. `'post'`)              |
| `targetId`       | text      | ID of the entity being commented on                         |
| `parentId`       | text      | Parent comment ID (null = top-level)                        |
| `userId`         | text      | Author's user ID (null for an anonymous comment)            |
| `authorName`     | text      | Guest's display name (null for a signed-in author)          |
| `authorEmail`    | text      | Guest's optional email: `hidden`, never returned            |
| `status`         | text      | `active` \| `pending` \| `deleted` \| `flagged` \| `hidden` |
| `depth`          | integer   | Nesting depth (0 = top-level, 1 = reply, etc.)              |
| `appId`          | text      | Multi-app support                                           |
| `organizationId` | text      | Multi-tenant support                                        |
| `createdAt`      | integer   | Unix epoch ms                                               |
| `updatedAt`      | integer   | Unix epoch ms, auto-updated on save                         |

Reactions are stored separately in `comment_reactions` with `commentId`, `emoji`, `userId`, and `createdAt`. Comment
list responses enrich those rows into the familiar `reactions` map (`emoji` → user IDs); `reactions` is not a column on
`comments` and is not writable through generic CRUD.

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
});
// depth is computed by Comment.create() from the parent (parent depth + 1); a supplied depth is ignored.
```

### Anonymous comments

A comment without a `userId` is a guest's. `Comment.create()` requires an `authorName` (control characters and runs of
whitespace collapsed, up to `COMMENT_AUTHOR_NAME_MAX_LENGTH` = 80), accepts an optional `authorEmail`, and starts the
comment `pending`; a moderator publishes it with `restore()` (status `active`). A missing name or a malformed email
throws a 422 `DomainValidationError` with field errors. For a signed-in author both guest fields are dropped: the name
comes from the account.

```typescript
const guest = await Comment.create({
    body: 'Lovely write-up.',
    targetType: 'post',
    targetId: 'post-abc-123',
    authorName: 'Ada',
    authorEmail: 'ada@example.com', // optional; stored for the site owner, never returned by toJson()
});
guest.get('status'); // 'pending'
await guest.restore(); // moderator approves: 'active'
```

`authorEmail` is in the model's `hidden` list, so no API read returns it.

### Toggling reactions

```typescript
// Toggle — adds if absent, removes if present
await comment.toggleReaction('👍', 'user-xyz');

// The server returns the aggregated reactions map after a toggle.
// For explicit add/remove behavior, call toggleReaction only when your UI knows the desired current state.
```

### Moderation actions

```typescript
await comment.flag(); // status → 'flagged'
await comment.hide(); // status → 'hidden'
await comment.softDelete(); // status → 'deleted', body → '[deleted]'
await comment.restore(); // status → 'active' (also publishes a pending comment)
```

### Querying via CRUD API

```bash
GET /api/ottaorm/comments?where={"targetType":"post","targetId":"post-abc-123"}
GET /api/ottaorm/comments?where={"targetType":"post","targetId":"post-abc-123","status":"active"}
GET /api/ottaorm/comments?where={"parentId":"comment-id-123"}
# A moderator's queue: no target, every pending comment in their scope
GET /api/ottaorm/comments?where={"status":"pending"}&orderBy=createdAt&orderDirection=asc
```

> **Note:** The route handler in `worker/routes/ottaorm-crud.ts` enforces these rules:
>
> 1. **`userId` / `organizationId` / `appId`** are always overwritten on POST: the user from the session, the
>    organization from the target post, the app from server config, so clients cannot impersonate other users or cross
>    tenants.
> 2. **Reactions** are not directly writable via PATCH. Send `_reaction: "<emoji>"` instead; the server calls
>    `comment.toggleReaction(emoji, userId)`, scoping the change to the authenticated user only. Sending a raw
>    `reactions` map in a PATCH body is silently ignored by the OttaORM sanitizer. The response includes the aggregated
>    map even though it is not persisted on the comment row.
> 3. **Anonymous POST** (no session, no API key) is a public form: a per-IP rate limit (`comments:create:<ip>`), then
>    Turnstile with the action `comment` (header `X-Turnstile-Token`; 403 `TURNSTILE_FAILED` without a valid one, 503
>    `TURNSTILE_UNAVAILABLE` when Cloudflare cannot be reached). Bot checks run only when the app sets both
>    `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Signed-in commenters skip both.
> 4. **The post decides**: a post with `allowComments: false` refuses every comment (403 `COMMENTS_CLOSED`). A post that
>    allows comments accepts them from guests too; there is no separate "signed-in only" switch.
> 5. **Moderation**: `pending` and `hidden` comments are listed to moderators only (a platform admin, or
>    `comments:moderate` in the comment's org), whatever `status` the caller asks for, and a single read of one answers
>    404 to anyone but its author and moderators. Only a moderator may change a status, except an author deleting their
>    own comment. `authorEmail` cannot be filtered, looked up (`field`) or sorted on (400).
> 6. **A list names its target** (`targetType` + `targetId`, else 400), except a moderator's queue: a moderator of the
>    caller's own scope may list without a target and gets every comment in that scope, in the app. The scope is the
>    ambient one, from the org switcher: the active org (where they hold `comments:moderate`), or for a platform admin
>    in Platform scope the null org, which is the platform blog's.
> 7. **A password-protected post** takes comments only from a reader who unlocked it: send the unlock route's
>    `unlockToken` (see `@ottabase/ottablog`, valid 2 hours) as `X-Post-Unlock`, on top-level comments and replies
>    alike. Without a valid token for that post the answer is 403 `POST_LOCKED`. The post's author, a comment moderator
>    and a post manager in its org (`posts:manage` or `org:admin`) read it without the password, so they need no token.
>
> RLS: the package registers `TenantScoped(true)` for `comments` (`commentsPolicies()`): comments carry their target's
> organization, which is null for a platform blog post, and the route derives the context's organization from the target
> row, never from the caller.

### Moderation queue

otta-web's admin page `/admin/content/comments` (Content > Comments, org admins) is the queue: pending comments oldest
first, a Hidden filter, and Approve (`status: 'active'`), Hide (`'hidden'`) and Delete (`'deleted'`, the soft delete)
through `PATCH /api/ottaorm/comments/:id`. It lists without a target (rule 6), so it shows whatever scope the org
switcher selects, and resolves the titles of a page's posts in one `GET /api/ottaorm/posts?where={"id":{"$in":[...]}}`.

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

/** Comment row enriched by GET responses */
export type CommentType = CommentRecord & {
    _user?: CommentUser | null;
    reactions?: ReactionsMap; // Aggregated on GET; absent on a raw create result
};

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

When integrating into an app:

1. **`ottabase/packages.ts`** — list `createCommentsPackage()`. Its manifest carries both tables and both models;
   reaction CRUD remains disabled and reactions are mutated through `Comment.toggleReaction`
2. **`ottabase/db/schema.ts`** — statically export both tables so Drizzle Kit sees them, for example:
   `export { commentsTable, commentReactionsTable } from '@ottabase/comments/schema'`

Then run migrations:

```bash
curl -X POST http://localhost:3004/api/ottaorm/init
```

## Demo Page

The template app includes a demo at `/demo/comments` with two modes:

- **In-memory** (default) — local state with mock users/comments; works offline, no database required
- **Database**: reads and writes to the actual D1 database via the CRUD API. Its `demo` target is public, like a
  platform blog post: one thread for every visitor, in the null org. A signed-out visitor posts as a guest (a name and
  the `comment` Turnstile check) and is told the comment waits for approval; it then sits in the Platform scope queue.

Both modes use the same `CommentThread` renderer which supports:

- **User avatars** — rendered from `_user.name`/`_user.image` with initials fallback and "member since" tooltip
- **Load-more for root comments** — initially shows 5 root comments, click to load more
- **Load-more for nested replies** — initially shows 3 replies per parent, click to expand
- **Reaction toggling** — per-user emoji reactions
- **Inline reply form** — reply to any comment up to depth 3
- **Moderation actions** — flag, hide, soft-delete

## Types

| Type                             | Description                                                   |
| -------------------------------- | ------------------------------------------------------------- |
| `CommentRecord`                  | Full row type inferred from `commentsTable`                   |
| `NewCommentRecord`               | Insert type for creating new comments                         |
| `CommentReactionRecord`          | Row type inferred from `commentReactionsTable`                |
| `NewCommentReactionRecord`       | Insert type for reaction rows                                 |
| `CommentStatus`                  | `'active' \| 'pending' \| 'deleted' \| 'flagged' \| 'hidden'` |
| `UNPUBLISHED_COMMENT_STATUSES`   | `['pending', 'hidden']`: listed to moderators only            |
| `COMMENT_AUTHOR_NAME_MAX_LENGTH` | `80`, the longest guest display name                          |
| `ReactionsMap`                   | `Record<string, string[]>`: emoji → user IDs                  |
| `DefaultReaction`                | Union of the 6 built-in emoji strings                         |
| `CreateCommentParams`            | Parameters for creating a comment                             |
| `ListCommentsParams`             | Parameters for listing comments on a target                   |
| `DEFAULT_REACTIONS`              | `['👍', '👎', '❤️', '😂', '😮', '😢']`                        |
