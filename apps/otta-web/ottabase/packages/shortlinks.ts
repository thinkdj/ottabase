// Shortlinks: table and model from the package; this app adds the admin API and the redirect
// route. Mounted at '/' because the group spans /api/shortlinks/* and /s/<code>. The
// redirect-only domain (SHORTLINKS_HOST) is answered in cloudflare-worker.ts (handleShortlinkHost),
// because there nothing else may be served.
import { Router } from '@ottabase/ottarouter';
import { createShortlinksPackage } from '@ottabase/shortlinks';
import { ctxOf, h } from '../../worker/lib/api-context';
import {
    handleShortlinkById,
    handleShortlinkRedirect,
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
                .on(['GET', 'HEAD'], '/s/*', (c) => handleShortlinkRedirect(ctxOf(c), c.params['*'])),
    },
    env: {
        optional: [
            {
                key: 'SHORTLINKS_HOST',
                kind: 'var',
                secret: false,
                description: 'Redirect-only domain (e.g. go.example.com) where a bare /<code> resolves.',
            },
            {
                key: 'OBCF_ANALYTICS_SHORTLINKS',
                kind: 'binding',
                description: 'Analytics Engine dataset for shortlink clicks.',
            },
        ],
    },
});
