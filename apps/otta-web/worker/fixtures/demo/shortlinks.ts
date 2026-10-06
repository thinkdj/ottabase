/** A few shortlinks, so the Shortlinks admin and the redirect route have something to show. */
export interface DemoShortlink {
    code: string;
    /** A path on this site, or an absolute URL */
    to: string;
}

export const SHORTLINKS: readonly DemoShortlink[] = [
    { code: 'edge', to: '/blog/series/building-on-the-edge' },
    { code: 'calm', to: '/blog/a-calmer-way-to-ship-content' },
    { code: 'lisbon', to: '/blog/two-days-in-lisbon' },
    { code: 'news', to: '/changelog' },
    { code: 'docs', to: '/docs' },
    { code: 'gh', to: 'https://github.com/thinkdj/ottabase' },
];
