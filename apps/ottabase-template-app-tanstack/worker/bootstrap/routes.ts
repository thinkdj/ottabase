// ============================================================
// Ottabase Bootstrap - API Routes & Wizard Pages
// ============================================================
//
// Handles all /__bootstrap__/* requests:
//   GET  /__bootstrap__              → Wizard UI (HTML)
//   GET  /__bootstrap__/api/status   → Current platform state + binding probe
//   POST /__bootstrap__/api/init     → Run schema creation + migrations
//   POST /__bootstrap__/api/finalize → Mark platform READY
// ============================================================

import { autoInit, runMigrations, coreMigrations } from '@ottabase/ottaorm';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAllSchemas } from '../../ottabase/db/schemas-helper';
import { appMigrations } from '../../ottabase/migrations';
import { probeBindings, writeDBState, writeKVState, ensureMetaTable } from './state-resolver';
import type { PlatformStateResult } from './types';
import { renderWizardPage, renderMaintenancePage, renderLockedPage, renderBindingsErrorPage } from './pages';

interface BootstrapContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    platformState: PlatformStateResult;
}

/**
 * Handle all /__bootstrap__/* requests.
 * Always returns a Response (wizard page, API response, or 404).
 */
export async function handleBootstrapRoute(context: BootstrapContext): Promise<Response> {
    const { url, platformState } = context;
    const path = url.pathname;

    // API routes
    if (path === '/__bootstrap__/api/status') {
        return handleStatus(context);
    }
    if (path === '/__bootstrap__/api/init') {
        return handleInit(context);
    }
    if (path === '/__bootstrap__/api/finalize') {
        return handleFinalize(context);
    }

    // Wizard HTML page — serve for any /__bootstrap__* GET
    if (context.request.method === 'GET') {
        return serveWizardPage(context);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Intercept all non-bootstrap requests when platform is not READY.
 * Returns a redirect/error Response, or null if the platform is ready.
 */
export function interceptIfNotReady(
    request: Request,
    url: URL,
    platformState: PlatformStateResult,
): Response | null {
    const path = url.pathname;

    // Always allow bootstrap routes through
    if (path.startsWith('/__bootstrap__')) {
        return null;
    }

    // Allow health check through always
    if (path === '/api/health') {
        return null;
    }

    // Platform is READY and not in panic → let request through
    if (platformState.state === 'READY' && !platformState.panic) {
        return null;
    }

    // Panic mode (KV=READY but DB dead)
    if (platformState.panic) {
        return new Response(renderMaintenancePage(platformState), {
            status: 503,
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Retry-After': '30',
            },
        });
    }

    // ENV locked
    if (platformState.source === 'env') {
        return new Response(renderLockedPage(platformState), {
            status: 503,
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Retry-After': '60',
            },
        });
    }

    // Missing critical bindings (no D1)
    if (!platformState.bindings.d1) {
        return new Response(renderBindingsErrorPage(platformState), {
            status: 503,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
    }

    // UNINITIALIZED or BOOTSTRAPPING → redirect to wizard
    const isApiRequest =
        path.startsWith('/api/') ||
        request.headers.get('Accept')?.includes('application/json');

    if (isApiRequest) {
        return new Response(
            JSON.stringify({
                error: 'Platform not initialized',
                code: 'PLATFORM_NOT_READY',
                state: platformState.state,
                setup_url: '/__bootstrap__',
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }

    // HTML request → redirect to bootstrap wizard
    return Response.redirect(new URL('/__bootstrap__', url.origin).toString(), 302);
}

// ============================================================
// Route handlers
// ============================================================

function handleStatus(context: BootstrapContext): Response {
    const { platformState, env } = context;
    const bindings = probeBindings(env);

    return new Response(
        JSON.stringify({
            state: platformState.state,
            source: platformState.source,
            panic: platformState.panic,
            reason: platformState.reason,
            bindings,
            timestamp: new Date().toISOString(),
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        },
    );
}

async function handleInit(context: BootstrapContext): Promise<Response> {
    const { env, request } = context;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!env.OBCF_D1) {
        return new Response(
            JSON.stringify({
                error: 'D1 database binding not available',
                code: 'MISSING_BINDING',
                hint: 'Configure OBCF_D1 in your wrangler.toml/jsonc',
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
    }

    try {
        // 1. Create the meta table and mark BOOTSTRAPPING
        await ensureMetaTable(env);
        await writeDBState(env, 'BOOTSTRAPPING');
        await writeKVState(env, 'BOOTSTRAPPING');

        // 2. Run ottaorm autoInit (creates all tables + runs migrations)
        const driver = createD1Driver(env.OBCF_D1);
        const allSchemas = getAllSchemas();
        const initResult = await autoInit({
            driver,
            schema: allSchemas,
            customMigrations: appMigrations,
            verbose: true,
        });

        // 3. Run the .sql file migrations (RBAC, multi-tenant)
        //    These are handled by the customMigrations in appMigrations already,
        //    but we also run the core SQL migrations from ottaorm
        const sqlMigrationResults = await runCoreSQLMigrations(env);

        return new Response(
            JSON.stringify({
                success: initResult.success,
                message: initResult.message,
                autoInit: initResult.details,
                sqlMigrations: sqlMigrationResults,
                timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error: any) {
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                code: 'INIT_FAILED',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}

async function handleFinalize(context: BootstrapContext): Promise<Response> {
    const { env, request } = context;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!env.OBCF_D1) {
        return new Response(
            JSON.stringify({ error: 'D1 database binding not available' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
    }

    try {
        // Verify tables actually exist before marking READY
        const tableCheck = await verifyCoreTables(env);
        if (!tableCheck.ok) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Core tables missing — run initialization first',
                    missing: tableCheck.missing,
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        // Mark platform as READY in both DB and KV
        await writeDBState(env, 'READY');
        await writeKVState(env, 'READY');

        return new Response(
            JSON.stringify({
                success: true,
                state: 'READY',
                message: 'Platform is now ready. Redirecting to application.',
                timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error: any) {
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                code: 'FINALIZE_FAILED',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}

function serveWizardPage(context: BootstrapContext): Response {
    const { platformState } = context;

    return new Response(renderWizardPage(platformState), {
        status: 200,
        headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-store',
        },
    });
}

// ============================================================
// Helpers
// ============================================================

/**
 * Run the core SQL migrations from ottaorm (RBAC, multi-tenant system)
 */
async function runCoreSQLMigrations(env: CloudflareEnv): Promise<{ executed: string[]; skipped: string[]; errors: string[] }> {
    const executed: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    // The SQL migration files are loaded as part of the coreMigrations
    // in the ottaorm package. The autoInit call above handles the schema-based
    // migrations. Here we specifically run the migration-tracked SQL files.
    try {
        const driver = createD1Driver(env.OBCF_D1!);
        const result = await runMigrations(driver, coreMigrations);
        executed.push(...result.executed);
        skipped.push(...result.skipped);
    } catch (error: any) {
        errors.push(`Core SQL migrations: ${error.message}`);
    }

    return { executed, skipped, errors };
}

/**
 * Verify that critical tables exist in D1
 */
async function verifyCoreTables(env: CloudflareEnv): Promise<{ ok: boolean; missing: string[]; found: string[] }> {
    const requiredTables = ['users', 'sessions', 'accounts', 'roles', '_ottabase_meta'];
    const found: string[] = [];
    const missing: string[] = [];

    try {
        const result = await env.OBCF_D1!.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        ).all();

        const existingTables = new Set(
            (result.results || []).map((row: any) => row.name as string),
        );

        for (const table of requiredTables) {
            if (existingTables.has(table)) {
                found.push(table);
            } else {
                missing.push(table);
            }
        }
    } catch {
        return { ok: false, missing: requiredTables, found: [] };
    }

    return { ok: missing.length === 0, missing, found };
}
