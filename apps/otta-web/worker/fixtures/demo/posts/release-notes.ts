/** Monthly release notes. They mirror what the app actually shipped, so the changelog reads true. */
import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { doc, h2, ul } from '../blocks';
import { MAYA } from '../people';

const note = (seed: {
    title: string;
    slug: string;
    excerpt: string;
    publishedAt: string;
    blocks: Parameters<typeof doc>[1];
}): BlogDemoPostSeed => ({
    title: seed.title,
    slug: seed.slug,
    excerpt: seed.excerpt,
    publishedAt: seed.publishedAt,
    contentType: 'changelog',
    authorEmail: MAYA,
    categories: ['Releases'],
    tags: ['Release notes'],
    content: doc(seed.slug, seed.blocks),
});

export const RELEASE_NOTES: readonly BlogDemoPostSeed[] = [
    note({
        title: 'October 2026: Site design in one place',
        slug: 'october-2026-site-design-in-one-place',
        excerpt:
            'One workspace for how the site is put together, a lightbox that is a real dialog, an audit log you can read, and every email on one page.',
        publishedAt: '2026-10-05T16:00:00.000Z',
        blocks: [
            h2('Highlights'),
            ul([
                '<b>Site design</b> is one workspace: route mappings, menu slots and layout templates side by side, with a live preview of any path in light or dark. One Save button, Ctrl S included.',
                '<b>The lightbox is a real modal dialog.</b> Focus moves in and comes back out, Escape and the arrow keys work from anywhere, the page behind is inert, and screen readers hear a name and a counter.',
                '<b>The audit log reads as a timeline</b>, grouped by day, with filters in the URL and a person or organization you can follow with one click.',
                '<b>The Email page shows every email the app sends</b>, rendered as it goes out, with a test send and provider status.',
            ]),
            h2('Also'),
            ul([
                'Mantine is an optional adapter package now; the app no longer ships it.',
                'Email footers no longer print raw tags.',
                'The audit API returns facets with counts and accepts a status filter.',
            ]),
        ],
    }),
    note({
        title: 'September 2026: One feed for the blog',
        slug: 'september-2026-one-feed-for-the-blog',
        excerpt:
            'The blog list and every archive share one feed with search in the URL. Every date picker is the same picker.',
        publishedAt: '2026-09-30T15:30:00.000Z',
        blocks: [
            h2('Highlights'),
            ul([
                '<b>One blog feed</b> serves the list, tags, categories, series, authors and month archives. Search, type and page live in the URL, so a filtered view is a link.',
                '<b>Every date picker is the same picker.</b> Date, date and time, range and fuzzy dates share one shell, with type-to-parse entry like "next friday 9am" or "5 jan to 12 jan".',
                'Series archives order parts by their position in the series rather than by date.',
            ]),
            h2('Fixes'),
            ul([
                'A missing tag or category archive says so instead of showing an empty list.',
                'The range picker no longer collapses to a column inside narrow containers.',
            ]),
        ],
    }),
    note({
        title: 'August 2026: The editor reads like the page',
        slug: 'august-2026-the-editor-reads-like-the-page',
        excerpt:
            'Editor blocks look like the published page. A faster media picker, a background jobs screen and in-app notifications.',
        publishedAt: '2026-08-31T14:00:00.000Z',
        blocks: [
            h2('Highlights'),
            ul([
                '<b>Editor blocks look like the reader\u2019s view.</b> Quotes, galleries, code and callouts render in the editor exactly as they do on the page, in the active theme.',
                '<b>Media picker rework:</b> search as you type, upload in place, pick a hero image without leaving the post.',
                '<b>Background jobs</b> have a screen: the dead-letter queue first, with retry, then what failed and what ran lately.',
                '<b>Notifications</b> arrive in the app: a bell, an inbox, and per-category preferences on the account page.',
            ]),
            h2('Also'),
            ul([
                'The admin overview shows what needs attention before anything else.',
                'Every admin list runs on one data table.',
            ]),
        ],
    }),
    note({
        title: 'July 2026: A smoother editorial workspace',
        slug: 'july-2026-a-smoother-editorial-workspace',
        excerpt:
            'A writing-first editor layout, a publish panel that asks for three things, and active sessions on the account page.',
        publishedAt: '2026-07-31T15:00:00.000Z',
        blocks: [
            h2('Highlights'),
            ul([
                '<b>Writing first.</b> The editor is the page; settings slide in from the side when you need them and stay out of the way when you do not.',
                '<b>The publish panel</b> asks for a slug, an excerpt and a date. Scheduling is the same date, later.',
                '<b>Active sessions and provider linking</b> on the account page, so you can see where you are signed in and sign out from there.',
                '<b>Roles and permissions</b> have a flow: pick a person, pick a role, see what it grants, before you confirm.',
            ]),
            h2('Fixes'),
            ul([
                'Unsaved changes block navigation with a plain question.',
                'Tags, categories and series edit in a side panel beside their table.',
            ]),
        ],
    }),
];
