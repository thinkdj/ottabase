# @ottabase/comments — agent notes

Threaded, polymorphic comment system (reactions, moderation) as an OttaORM fat model. Full docs: ./README.md

## Use when

- Adding user comments/replies/reactions to any entity (posts, todos, pages) with moderation and multi-tenant scoping.
- NOT for chat/realtime messaging, and not usable standalone outside an OttaORM-wired app.

## Imports

```ts
import { Comment, commentsTable, DEFAULT_REACTIONS } from '@ottabase/comments';
import type { CommentRecord, NewCommentRecord, ReactionsMap, CommentStatus, CreateCommentParams, ListCommentsParams, DefaultReaction } from '@ottabase/comments';
import { commentsTable } from '@ottabase/comments/schema'; // schema-only entry (also re-exports record types)
```

## Canonical usage

```ts
const comment = await Comment.create({ body: 'Great post!', targetType: 'post', targetId: 'post-abc-123', userId: 'user-xyz' });
const reply = await Comment.create({ body: 'Agreed', targetType: 'post', targetId: 'post-abc-123', parentId: comment.get('id'), userId: 'user-456', depth: await Comment.computeDepthForParent(comment.get('id')) });
```

```ts
await comment.toggleReaction('👍', 'user-xyz'); // add if absent, remove if present
await comment.flag(); // also: hide(), softDelete(), restore()
const children = await comment.replies(); // relations: author(), parent(), replies()
```

## Wiring

1. `apps/*/ottabase/config.migrations.ts` — import `commentsTable` from `'@ottabase/comments'`, add `comments: { tables: { commentsTable } }` to `PACKAGE_REGISTRY`.
2. `apps/*/ottabase/ottabase.config.ts` — set `comments: true` under `packages` (built-in toggle; `customPackages` is a different mechanism).
3. `apps/*/ottabase/db/schema.ts` — re-export `commentsTable` from `'@ottabase/comments/schema'`.
4. `apps/*/worker/lib/db-utils.ts` — add `Comment` to the `registerModels` array in `initDbConnection`.
5. Run migrations: `POST /api/ottaorm/init`.

## Gotchas

- `depth` is in the create writable allowlist (client-supplied). Route handlers must compute it server-side with `Comment.computeDepthForParent(parentId)` and overwrite the body value.
- `reactions` is NOT PATCHable — the CRUD route expects `_reaction: '<emoji>'` and calls `toggleReaction(emoji, sessionUserId)`; a raw `reactions` map in a PATCH body is silently dropped by the sanitizer.
- `userId`/`organizationId` are in the create allowlist only so server-injected values survive sanitization; the CRUD route always overwrites them from the session (no impersonation).
- `softDelete()` replaces `body` with `'[deleted]'` and clears reactions — destructive to content.
- GET `/api/ottaorm/comments` enriches rows with `_user` (batch User lookup); RLS is TenantScoped, so organizationId context is mandatory.
- Sanitize comment `body` HTML via `@ottabase/utils/sanitize` before rendering; edge runtime — no Node-only APIs.
