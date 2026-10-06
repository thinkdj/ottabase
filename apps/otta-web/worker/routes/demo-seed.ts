/**
 * POST /api/admin/demo-seed: fills a fresh install with a believable site. A team, a media library,
 * six months of posts with their taxonomy, comment threads, shortlinks, navigation and a few inbox
 * notifications for the person seeding. Create-only on every entity, keyed on something stable,
 * so it is safe to run again after someone has edited the content.
 */
import { createBrandCache, Menu, MenuItem, MenuSlotAssignment } from '@ottabase/brand-engine/persistence';
import { Comment } from '@ottabase/comments';
import { NotificationModel } from '@ottabase/notifications';
import { Post } from '@ottabase/ottablog';
import { seedDemoPosts } from '@ottabase/ottablog/router';
import { Media } from '@ottabase/ottaorm';
import { AuditLog, OrganizationMember, Role, User } from '@ottabase/ottaorm/models';
import { Shortlink } from '@ottabase/shortlinks';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { DEMO_MEDIA, DEMO_POSTS, MENUS, PEOPLE, SHORTLINKS, THREADS } from '../fixtures/demo';
import { requireAdminAccess } from '../lib/admin-guard';
import { brandEnv } from '../lib/brand-utils';
import { initDbConnection } from '../lib/db-utils';
import { notifyUser, quietly, type NotifyInput } from '../lib/notify';
import type { ApiRouteContext } from './router';

export interface SeedCount {
    created: number;
    existing: number;
}

export interface DemoSeedSummary {
    people: SeedCount;
    media: SeedCount;
    posts: SeedCount & { total: number };
    comments: SeedCount;
    shortlinks: SeedCount;
    menus: SeedCount;
    notifications: SeedCount;
}

const count = (): SeedCount => ({ created: 0, existing: 0 });

/** What the seeding admin finds in their inbox afterwards */
const INBOX: readonly NotifyInput[] = [
    {
        category: 'organizations',
        title: 'Four people joined your organization',
        message:
            'Maya, Tomás, Priya and Jonas are members now, with editor and author roles. Manage them under Access.',
        actionUrl: '/admin/access/users',
        actionText: 'Open Users',
    },
    {
        category: 'comments',
        title: 'New comments on the blog',
        message: 'The team left comment threads on four articles. Reply from the post pages.',
        actionUrl: '/blog/why-we-build-on-the-edge',
        actionText: 'Read the thread',
    },
    {
        category: 'organizations',
        title: 'Demo content is in place',
        message:
            'Six months of posts, a media library, shortlinks and menus. Edit anything; the seed never overwrites.',
        actionUrl: '/admin/content/blog',
        actionText: 'Open Posts',
    },
];

export async function handleDemoSeed(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env, request } = context;
    initDbConnection(env);
    // The session carries the signed-in user; the guard's user object is the RBAC view of them
    const callerId = (auth.session?.user?.id ?? (auth.user as { id?: string } | null)?.id) as string;
    const config = getOttabaseConfig(env);
    const appId = config.appId;
    // The caller's own organization, so everything seeded shows up in their admin. A system-scope
    // session carries the sentinel, so fall back to the caller's first active membership.
    const sessionOrg = auth.session?.user?.organizationId as string | null | undefined;
    const membership = sessionOrg ? null : await OrganizationMember.first({ userId: callerId, status: 'active' });
    const organizationId = sessionOrg || (membership?.get('organizationId') as string | undefined) || null;
    const site = new URL((env as { AUTH_URL?: string }).AUTH_URL || request.url).origin;

    const summary: DemoSeedSummary = {
        people: count(),
        media: count(),
        posts: { ...count(), total: DEMO_POSTS.length },
        comments: count(),
        shortlinks: count(),
        menus: count(),
        notifications: count(),
    };

    // People: real users without a password, members of the organization, each with a role
    const userIdByEmail = new Map<string, string>();
    for (const person of PEOPLE) {
        let user = await User.first({ email: person.email });
        if (user) summary.people.existing++;
        else {
            user = await User.create({
                name: person.name,
                email: person.email,
                image: person.image,
                emailVerified: Date.now(),
            });
            summary.people.created++;
        }
        const userId = user.get('id') as string;
        userIdByEmail.set(person.email, userId);
        if (!organizationId) continue;
        if (!(await OrganizationMember.first({ organizationId, userId }))) {
            await OrganizationMember.create({
                userId,
                organizationId,
                role: 'member',
                status: 'active',
                joinedAt: Date.now(),
            });
        }
        const role = await Role.findByName(person.role);
        if (role) await (user as User).assignRole(String(role.get('id')), callerId, organizationId);
    }

    // Media: the photographs, as library rows the picker and the lightbox can use
    for (const item of DEMO_MEDIA) {
        if (await Media.first({ storageKey: item.storageKey, appId })) {
            summary.media.existing++;
            continue;
        }
        await Media.create({
            provider: 'r2',
            storageKey: item.storageKey,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            previewUrl: item.previewUrl,
            mimeType: 'image/jpeg',
            mediaKind: 'image',
            status: 'active',
            originalName: item.originalName,
            title: item.title,
            altText: item.altText,
            caption: item.caption,
            extension: 'jpg',
            fileSize: 0,
            width: item.width,
            height: item.height,
            isPublic: true,
            metadata: { source: 'unsplash', demo: true },
            appId,
            organizationId,
            userId: callerId,
        });
        summary.media.created++;
    }

    // Posts, with their tags, categories, series and authors
    const posts = await seedDemoPosts(DEMO_POSTS, {
        appId,
        organizationId,
        userId: callerId,
        tenantOrganizationId: config.features.ottablog.mode === 'org' ? organizationId : undefined,
        authorIdFor: (email) => userIdByEmail.get(email) ?? null,
    });
    summary.posts.created = posts.created.length;
    summary.posts.existing = posts.existing.length;

    // Comment threads, only on posts that have none yet
    for (const thread of THREADS) {
        const post = await Post.first({ slug: thread.slug, appId });
        if (!post) continue;
        const targetId = post.get('id') as string;
        if (await Comment.first({ targetType: 'post', targetId })) {
            summary.comments.existing += thread.comments.length;
            continue;
        }
        for (const entry of thread.comments) {
            const parent = await Comment.create({
                body: entry.body,
                targetType: 'post',
                targetId,
                parentId: null,
                depth: 0,
                userId: userIdByEmail.get(entry.authorEmail) ?? callerId,
                organizationId,
                appId,
            });
            summary.comments.created++;
            for (const reply of entry.replies ?? []) {
                await Comment.create({
                    body: reply.body,
                    targetType: 'post',
                    targetId,
                    parentId: parent.get('id'),
                    depth: 1,
                    userId: userIdByEmail.get(reply.authorEmail) ?? callerId,
                    organizationId,
                    appId,
                });
                summary.comments.created++;
            }
        }
    }

    // Shortlinks
    for (const link of SHORTLINKS) {
        if (await Shortlink.first({ shortCode: link.code })) {
            summary.shortlinks.existing++;
            continue;
        }
        await Shortlink.create({
            shortCode: link.code,
            fullUrl: new URL(link.to, site).toString(),
            type: 'redirect',
            appId,
        });
        summary.shortlinks.created++;
    }

    // Menus, and the slots they fill when nothing is assigned yet
    const menuIdBySlug = new Map<string, string>();
    for (const menu of MENUS) {
        let row = await Menu.first({ slug: menu.slug, appId });
        if (row) summary.menus.existing++;
        else {
            row = await Menu.create({ appId, name: menu.name, slug: menu.slug, type: menu.type, isDefault: false });
            const menuId = row.get('id') as string;
            for (const [sortOrder, item] of menu.items.entries()) {
                await MenuItem.create({
                    menuId,
                    appId,
                    parentId: null,
                    name: item.name,
                    link: item.link,
                    newTab: Boolean(item.newTab),
                    authRequired: false,
                    sortOrder,
                });
            }
            summary.menus.created++;
        }
        menuIdBySlug.set(menu.slug, row.get('id') as string);
    }
    if ((await MenuSlotAssignment.where({ appId })).length === 0) {
        for (const menu of MENUS) {
            await MenuSlotAssignment.create({
                appId,
                slotName: menu.slot,
                menuId: menuIdBySlug.get(menu.slug),
                renderType: menu.type,
                sortOrder: 0,
            });
        }
        if (env.OBCF_KV) await createBrandCache(brandEnv(env).OBCF_KV).invalidate({ appId });
    }

    // A few inbox entries for the person seeding, so the bell has something to show
    for (const input of INBOX) {
        if (await NotificationModel.first({ userId: callerId, title: input.title })) {
            summary.notifications.existing++;
            continue;
        }
        if (await notifyUser(callerId, input)) summary.notifications.created++;
    }

    // The run itself is an admin action, so it shows in the audit log like one
    await quietly(() =>
        AuditLog.log({
            userId: callerId,
            userEmail: auth.session?.user?.email ?? undefined,
            organizationId: organizationId ?? undefined,
            appId,
            action: 'seed',
            resourceType: 'demo_content',
            resourceId: appId,
            status: 'success',
            metadata: summary,
        }),
    );

    return jsonResponse(summary);
}
