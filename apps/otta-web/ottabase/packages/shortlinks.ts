// Shortlinks: table and model from the package; this app adds the admin API and the explicit
// redirect route. Mounted at '/' because the group spans /api/shortlinks/* and /shortlinks/go.
// The catch-all redirect for bare short codes stays in cloudflare-worker.ts (handleShortlinkFallback),
// because it must run AFTER every API route has declined.
import { Router } from '@ottabase/ottarouter';
import { createShortlinksPackage } from '@ottabase/shortlinks';
import { ctxOf, h } from '../../worker/lib/api-context';
import {
    handleShortlinkById,
    handleShortlinkExplicitGo,
    handleShortlinksAnalytics,
    handleShortlinksCreate,
    handleShortlinksList,
} from '../../worker/routes/shortlinks';

export const shortlinksPackage = createShortlinksPackage<CloudflareEnv>({
    routes: {
        basePath: '/',
        build: () =>
            new Router<CloudflareEnv>()
                .get('/api/shortlinks', h(handleShortlinksList))
                .get('/api/shortlinks/analytics', h(handleShortlinksAnalytics))
                .post('/api/shortlinks', h(handleShortlinksCreate))
                .patch('/api/shortlinks/*', (c) => handleShortlinkById(ctxOf(c), c.params['*'], 'PATCH'))
                .delete('/api/shortlinks/*', (c) => handleShortlinkById(ctxOf(c), c.params['*'], 'DELETE'))
                .get('/shortlinks/go', h(handleShortlinkExplicitGo)),
    },
    env: {
        optional: [
            {
                key: 'OBCF_ANALYTICS_SHORTLINKS',
                kind: 'binding',
                description: 'Analytics Engine dataset for shortlink clicks.',
            },
        ],
    },
});
