// ============================================================
// robots.txt that names the AI search crawlers
// ============================================================
// Being fetchable by the crawler behind an answer engine is the gate to appearing in its
// answers: OpenAI says a site that blocks OAI-SearchBot is not shown in ChatGPT search,
// Perplexity and Anthropic say the same of theirs. Cloudflare's crawler controls (Search,
// Agent and Training, split in 2026) apply the most restrictive rule to a bot that does more
// than one thing, so each search bot gets its own group here, allowed by name, and the
// training bots get a switch of their own.
// ============================================================

/** The crawlers that feed answer engines' search. Allowed by name, always. */
export const AI_SEARCH_BOTS = [
    'OAI-SearchBot',
    'PerplexityBot',
    'Claude-SearchBot',
    'Googlebot',
    'Bingbot',
    'Applebot',
    'DuckDuckBot',
] as const;

/**
 * The crawlers that collect training data. Blocking them does not change search inclusion
 * (OpenAI's and Google's docs say so). Allowing them is the only road into the "memory"
 * path, where a model names a product without searching; nothing measures how wide that
 * road is. A judgment call, so it is a switch, defaulting to allow.
 */
export const AI_TRAINING_BOTS = [
    'GPTBot',
    'ClaudeBot',
    'anthropic-ai',
    'Google-Extended',
    'CCBot',
    'Bytespider',
] as const;

export interface RobotsOptions {
    /** Absolute URL of the sitemap, printed as the one `Sitemap:` line. */
    sitemap?: string;
    /** Paths nobody should crawl: `/api/`, `/admin/`. Applied to every bot. */
    disallow?: string[];
    /** Paths under a disallowed one that crawlers still need, such as where the images are served: `/api/upload/file/` under `/api/`. */
    allow?: string[];
    /** Training crawlers: 'allow' (default) or 'block'. */
    training?: 'allow' | 'block';
    /** Disallow everything for everyone: a preview or staging deployment that must not compete with the real site. */
    closed?: boolean;
}

export interface RobotsRule {
    userAgent: string | string[];
    allow?: string | string[];
    disallow?: string | string[];
}

/** The shape Next.js's `app/robots.ts` returns (`MetadataRoute.Robots`), built here without importing Next. */
export interface RobotsRules {
    rules: RobotsRule[];
    sitemap?: string;
}

const cleanPaths = (paths: string[] = []): string[] => [
    ...new Set(paths.map((p) => p.trim()).filter((p) => p.startsWith('/'))),
];

/** The rules as data: one group per search bot, one for training bots, one for everyone else. */
export function robotsRules(opts: RobotsOptions = {}): RobotsRules {
    if (opts.closed) return { rules: [{ userAgent: '*', disallow: '/' }] };
    const disallow = cleanPaths(opts.disallow);
    // Longest matching path wins, so an allowed path under a disallowed prefix stays fetchable.
    const allow = cleanPaths(['/', ...(opts.allow ?? [])]);
    const open = (userAgent: string | string[]): RobotsRule => ({
        userAgent,
        allow: allow.length > 1 ? allow : '/',
        ...(disallow.length ? { disallow } : {}),
    });
    const rules: RobotsRule[] = [
        ...AI_SEARCH_BOTS.map((bot) => open(bot)),
        opts.training === 'block' ? { userAgent: [...AI_TRAINING_BOTS], disallow: '/' } : open([...AI_TRAINING_BOTS]),
        open('*'),
    ];
    return { rules, ...(opts.sitemap ? { sitemap: opts.sitemap } : {}) };
}

const lines = (key: string, v?: string | string[]): string[] =>
    v === undefined ? [] : ([] as string[]).concat(v).map((x) => `${key}: ${x}`);

/** The same rules as the text file, with a comment over each group so a human can read why. */
export function robotsTxt(opts: RobotsOptions = {}): string {
    const { rules, sitemap } = robotsRules(opts);
    if (opts.closed)
        return ['# Not the production site: nothing here is for crawlers.', 'User-agent: *', 'Disallow: /', ''].join(
            '\n',
        );
    const out: string[] = [];
    const searchCount = AI_SEARCH_BOTS.length;
    rules.forEach((rule, i) => {
        if (i === 0)
            out.push(
                '# AI search crawlers, each named so a crawler control that splits search from training keeps them allowed.',
            );
        if (i === searchCount)
            out.push(
                '',
                opts.training === 'block'
                    ? '# Training crawlers: blocked. This does not affect search answers.'
                    : '# Training crawlers: allowed. Blocking them would not change search answers; allowing them is the only road into model memory.',
            );
        if (i === rules.length - 1) out.push('', '# Everyone else.');
        out.push(
            ...lines('User-agent', rule.userAgent),
            ...lines('Allow', rule.allow),
            ...lines('Disallow', rule.disallow),
        );
        if (i < searchCount - 1) out.push('');
    });
    if (sitemap) out.push('', `Sitemap: ${sitemap}`);
    out.push('');
    return out.join('\n');
}
