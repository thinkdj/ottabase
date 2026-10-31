import { BaseModel, DomainValidationError, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { COMMENT_AUTHOR_NAME_MAX_LENGTH } from '../types';
import { commentsTable } from './Comment.schema';
import { CommentReaction } from './CommentReaction';

// Re-export schema types for consumers
export { commentsTable, type CommentRecord, type NewCommentRecord, type ReactionsMap } from './Comment.schema';

export class Comment extends BaseModel {
    static entity = 'comments';
    static table = commentsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/comments';
    static packageType: PackageType = 'package';
    /**
     * Read-only in CrudHub: comment writes derive their org from the target and a delete must also
     * remove the reactions, both handled only by the public route.
     */
    static admin = {
        enabled: true,
        scope: 'org' as const,
        readOnly: true,
        relations: ['author:id{name,image}', 'parent:id{content,status}', 'replies:id{content,status}'],
        description: 'Comments and moderation state.',
    };

    static displayName = 'Comment';
    static displayNamePlural = 'Comments';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    // An anonymous commenter's email is for the site owner, never for an API reader.
    protected static hidden = ['authorEmail'];

    static casts = {
        depth: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    // User-supplied fields plus server-injected context fields (userId, organizationId, appId, depth).
    // The route handler MUST overwrite userId, organizationId and appId server-side to prevent
    // client impersonation — they are listed here only so the writable check (which rejects
    // unlisted keys) accepts them after server-side injection. `depth` is accepted but never
    // trusted: Comment.create() always recomputes it from parentId. `authorName`/`authorEmail` are
    // an anonymous commenter's own; Comment.create() checks them and drops them for a signed-in one.
    static writable = {
        create: [
            'body',
            'targetType',
            'targetId',
            'parentId',
            'depth',
            'userId',
            'organizationId',
            'appId',
            'authorName',
            'authorEmail',
        ],
        update: ['body', 'status'],
    };

    protected static defaults = {
        status: 'active',
        depth: 0,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        body: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: false,
            uiConfig: { label: 'Comment', description: 'The comment text' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: {
                rules: 'required|max:10000',
                messages: { required: 'Comment body is required', max: 'Comment must be 10,000 characters or fewer' },
            },
        },
        targetType: {
            type: 'string',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Target Type', description: 'Entity type this comment belongs to' },
            tableConfig: { visible: true, colWidth: 120 },
            validation: { rules: 'required', messages: { required: 'Target type is required' } },
        },
        targetId: {
            type: 'string',
            editable: false,
            sortable: false,
            uiConfig: { label: 'Target ID' },
            tableConfig: { visible: false },
            validation: { rules: 'required', messages: { required: 'Target ID is required' } },
        },
        parentId: {
            type: 'string',
            editable: false,
            sortable: false,
            uiConfig: { label: 'Parent Comment' },
            tableConfig: { visible: false },
        },
        userId: {
            type: 'string',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Author' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        authorName: {
            type: 'string',
            editable: false,
            sortable: false,
            uiConfig: { label: 'Guest name', description: 'Display name of an anonymous commenter' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        authorEmail: {
            type: 'string',
            editable: false,
            sortable: false,
            uiConfig: { label: 'Guest email', description: 'Optional, never shown publicly' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        status: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: { label: 'Status' },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'active', name: 'Active' },
                    { id: 'pending', name: 'Pending' },
                    { id: 'deleted', name: 'Deleted' },
                    { id: 'flagged', name: 'Flagged' },
                    { id: 'hidden', name: 'Hidden' },
                ],
            },
            tableConfig: { visible: true, colWidth: 100 },
        },
        depth: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Depth' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: false,
            uiConfig: { label: 'App ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        organizationId: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: false,
            uiConfig: { label: 'Organization ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
    };

    // ─── Relationships ─────────────────────────────────────────

    /** Get the author (User) of this comment */
    async author(select?: string[]) {
        const { User } = await import('@ottabase/ottaorm');
        return this.belongsTo(User, 'userId', { select: select || ['id', 'name', 'email'] });
    }

    /** Get the parent comment (if this is a reply) */
    async parent() {
        if (!this.get('parentId')) return null;
        return this.belongsTo(Comment, 'parentId');
    }

    /** Get direct child replies */
    async replies() {
        return this.hasMany(Comment, 'parentId');
    }

    // ─── Instance methods ──────────────────────────────────────

    /** Soft-delete this comment (sets status to 'deleted', clears body and all reactions) */
    async softDelete() {
        this.set('status', 'deleted');
        this.set('body', '[deleted]');
        const id = this.get('id') as string;
        if (id) await CommentReaction.deleteForComment(id);
        return this.save();
    }

    /** Flag this comment for moderation */
    async flag() {
        this.set('status', 'flagged');
        return this.save();
    }

    /** Hide this comment (moderator action) */
    async hide() {
        this.set('status', 'hidden');
        return this.save();
    }

    /** Publish a pending comment, or restore a hidden/flagged one, by making it active */
    async restore() {
        this.set('status', 'active');
        return this.save();
    }

    /**
     * Toggle a user's reaction on this comment — adds if absent, removes if present.
     * Delegates to CommentReaction.toggle, which is a single atomic row DELETE-or-INSERT
     * against the normalized comment_reactions table (no read-modify-write race).
     */
    async toggleReaction(emoji: string, userId: string): Promise<{ added: boolean }> {
        const id = this.get('id') as string;
        return CommentReaction.toggle(id, emoji, userId);
    }

    /** Check if this is a top-level comment (not a reply) */
    isTopLevel(): boolean {
        return !this.get('parentId');
    }

    /** Check if this comment is active */
    isActive(): boolean {
        return this.get('status') === 'active';
    }

    // ─── Static helpers ────────────────────────────────────────

    /**
     * Create a comment. `depth` is always recomputed from `parentId` (parent depth + 1, or 0),
     * ignoring any supplied value, so no write path — generic CRUD or app code — can forge nesting.
     *
     * A comment without a `userId` is anonymous: it needs an `authorName` (trimmed, up to
     * COMMENT_AUTHOR_NAME_MAX_LENGTH), may carry an `authorEmail`, and starts `pending` unless the
     * caller sets a status itself (generic CRUD cannot: status is not writable on create). A
     * signed-in author's name comes from the account, so both guest fields are dropped.
     */
    static override async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, unknown>,
        driver?: Parameters<typeof BaseModel.create>[1],
    ): Promise<InstanceType<T>> {
        const parentId = typeof data.parentId === 'string' && data.parentId ? data.parentId : null;
        const depth = await Comment.computeDepthForParent(parentId);
        const author = data.userId
            ? { authorName: null, authorEmail: null }
            : { ...Comment.guestAuthor(data), status: data.status ?? 'pending' };
        return super.create.call(this, { ...data, ...author, depth }, driver) as Promise<InstanceType<T>>;
    }

    /**
     * An anonymous commenter's name (required) and email (optional), normalized, or a 422 with
     * field errors. The name is stored as plain text with control characters and runs of
     * whitespace collapsed; it is rendered as text, like the body.
     */
    static guestAuthor(data: { authorName?: unknown; authorEmail?: unknown }): {
        authorName: string;
        authorEmail: string | null;
    } {
        const name = typeof data.authorName === 'string' ? data.authorName.replace(/[\p{Cc}\s]+/gu, ' ').trim() : '';
        const email = typeof data.authorEmail === 'string' ? data.authorEmail.trim() : '';
        const fieldErrors: Record<string, string> = {};
        if (!name) fieldErrors.authorName = 'Please enter your name';
        else if (name.length > COMMENT_AUTHOR_NAME_MAX_LENGTH) {
            fieldErrors.authorName = `Name must be ${COMMENT_AUTHOR_NAME_MAX_LENGTH} characters or fewer`;
        }
        if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            fieldErrors.authorEmail = 'Please enter a valid email address, or leave it empty';
        }
        const first = Object.values(fieldErrors)[0];
        if (first) throw new DomainValidationError(first, { fieldErrors });
        return { authorName: name, authorEmail: email || null };
    }

    /**
     * Compute the nesting depth for a new comment given its parent ID.
     * Returns 0 for top-level comments.
     *
     * `Comment.create()` calls this itself; call it directly only to preview a reply's depth.
     */
    static async computeDepthForParent(parentId: string | null): Promise<number> {
        if (!parentId) return 0;
        const parent = await Comment.find(parentId);
        if (!parent) return 0;
        return ((parent.get('depth') as number) ?? 0) + 1;
    }

    /**
     * Validate a reply's parentId against the target it is being posted to, and compute its
     * server-side depth in the same lookup. A parentId is only valid when the parent comment
     * exists AND belongs to the exact same targetType/targetId/organizationId as the new reply
     * — otherwise a caller could attach a reply to an unrelated (or cross-organization) comment,
     * producing a nonsensical or tenant-crossing thread.
     *
     * Route handlers should call this instead of computeDepthForParent whenever parentId is
     * present, and reject the request (400) when `ok` is false.
     */
    static async validateReplyParent(
        parentId: string | null,
        context: { targetType: string; targetId: string; organizationId: string | null },
    ): Promise<{ ok: true; depth: number } | { ok: false }> {
        if (!parentId) return { ok: true, depth: 0 };

        const parent = await Comment.find(parentId);
        if (!parent) return { ok: false };

        const sameTarget =
            parent.get('targetType') === context.targetType &&
            parent.get('targetId') === context.targetId &&
            (parent.get('organizationId') ?? null) === (context.organizationId ?? null);
        if (!sameTarget) return { ok: false };

        return { ok: true, depth: ((parent.get('depth') as number) ?? 0) + 1 };
    }
}
