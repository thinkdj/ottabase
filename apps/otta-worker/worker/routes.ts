// ============================================================
// The app's own routes, then every package's
// ============================================================
// `/` is a server-rendered page: what is installed and where it listens. `/api/health` is
// public and cheap (a load balancer's probe). `/api/admin/*` is the operator's: the health
// report and the one-shot database init. Everything under a package's basePath is mounted
// from its manifest.
// ============================================================

import { mountPackages, runHealth } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../ottabase/config.loader';
import { packages } from '../ottabase/packages';
import { requireOperator } from '../ottabase/packages/caller';
import { initDatabase } from './lib/db-utils';
import { escapeHtml, html, page } from './lib/html';
import { ensurePackageSchedules } from './lib/package-schedules';

export const router = new Router<CloudflareEnv>();

function basePathsOf(pkg: (typeof packages.packages)[number]): string[] {
    const routes = Array.isArray(pkg.routes) ? pkg.routes : pkg.routes ? [pkg.routes] : [];
    return routes.map((route) => route.basePath);
}

router.get('/', (c) => {
    const config = getOttabaseConfig(c.env);
    const rows = packages.packages
        .map(
            (pkg) => `<tr>
    <td><code>${escapeHtml(pkg.key)}</code></td>
    <td>${escapeHtml(pkg.name)}<br><span class="muted">${escapeHtml(pkg.description ?? '')}</span></td>
    <td class="muted">${
        basePathsOf(pkg)
            .map((path) => `<code>${escapeHtml(path)}</code>`)
            .join('<br>') || '—'
    }</td>
    <td class="muted">${
        Object.keys(pkg.cron ?? {})
            .map((name) => `<code>${escapeHtml(name)}</code>`)
            .join('<br>') || '—'
    }</td>
</tr>`,
        )
        .join('');
    const body = `
<h1>${escapeHtml(config.appName)}</h1>
<p class="muted">An Ottabase Worker, environment <code>${escapeHtml(config.environment)}</code>. ${packages.keys().length} packages installed.</p>
<table>
    <thead><tr><th>Package</th><th>What</th><th>Routes</th><th>Cron</th></tr></thead>
    <tbody>${rows}</tbody>
</table>
<p class="muted">Health: <a href="/api/health">/api/health</a> · operator report: <code>GET /api/admin/health</code> · tables: <code>POST /api/admin/init</code> (bearer <code>ADMIN_TOKEN</code>).</p>`;
    return html(page({ title: config.appName, body }));
});

router.get('/api/health', (c) => {
    const config = getOttabaseConfig(c.env);
    return jsonResponse({ ok: true, app: config.appId, environment: config.environment, packages: packages.keys() });
});

router.get('/api/admin/health', async (c) => {
    const denied = requireOperator(c.req, c.env);
    if (denied) return denied;
    const report = await runHealth(packages, c.env);
    return jsonResponse({ ...report, packages: packages.keys(), timestamp: Date.now() }, report.ok ? 200 : 503);
});

router.post('/api/admin/init', async (c) => {
    const denied = requireOperator(c.req, c.env);
    if (denied) return denied;
    if (!c.env.OBCF_D1) return errorResponse('OBCF_D1 is not bound', 503, { code: 'NOT_CONFIGURED' });
    const result = await initDatabase(c.env);
    const seeded = await ensurePackageSchedules(packages, getOttabaseConfig(c.env).appId);
    return jsonResponse({ data: { ...result, seededSchedules: seeded } }, result.success ? 200 : 500);
});

mountPackages(router, { packages });
