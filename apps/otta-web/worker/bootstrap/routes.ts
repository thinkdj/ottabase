// ============================================================
// Ottabase Bootstrap - API Routes & Wizard Pages
// ============================================================
//
// Handles all /__bootstrap__/* requests:
//   GET  /__bootstrap__                  → Wizard UI (HTML)
//   GET  /__bootstrap__/api/status       → Current platform state + binding probe
//   POST /__bootstrap__/api/init         → Clear KV, then run schema creation + migrations
//   POST /__bootstrap__/api/seed         → Seed RBAC roles + permissions
//   POST /__bootstrap__/api/create-owner → Create first admin/owner account
//   POST /__bootstrap__/api/finalize     → Mark platform READY
// ============================================================

import { encode as encodeAuthJwt } from '@auth/core/jwt';
import { hashPassword } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import {
    autoInit,
    clearConnection,
    coreMigrations,
    registerConnection,
    Role,
    runMigrations,
    User,
} from '@ottabase/ottaorm';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAllSchemas } from '../../ottabase/db/schemas-helper';
import { appMigrations } from '../../ottabase/migrations';
import { ensureAppBrandDefaults, provisionDefaultOrganizationForUser } from '../lib/user-provisioning';
import { renderBindingsErrorPage, renderLockedPage, renderMaintenancePage, renderWizardPage } from './pages';
import { clearKvNamespace, ensureMetaTable, probeBindings, writeDBState, writeKVState } from './state-resolver';
import type { PlatformStateResult } from './types';

interface BootstrapContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    platformState: PlatformStateResult;
}

/** Register a D1 connection for ORM model operations */
function ensureOrmConnection(env: CloudflareEnv): void {
    if (!env.OBCF_D1) return;
    try {
        clearConnection('default');
    } catch {
        /* ignore if no connection */
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
}

function jsonResp(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
    owner: ['*:*'],
    admin: ['*:*'],
    editor: ['*:read', '*:create', '*:update'],
    viewer: ['*:read'],
    member: ['*:read'],
};

async function enforceDefaultRolePermissions(env: CloudflareEnv): Promise<string[]> {
    if (!env.OBCF_D1) return [];

    const normalized: string[] = [];
    const now = Date.now();

    for (const [name, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        await env.OBCF_D1.prepare(`UPDATE roles SET permissions = ?, updated_at = ? WHERE name = ?`)
            .bind(JSON.stringify(permissions), now, name)
            .run();
        normalized.push(name);
    }

    return normalized;
}

/**
 * Check if the provided bootstrap secret is valid.
 * For API requests, only X-Bootstrap-Secret header is accepted.
 * For the main wizard page (GET), the ?secret= query parameter is also allowed.
 */
function isValidSecret(context: BootstrapContext, allowQuery = false): boolean {
    const { env, request, url } = context;
    const expectedSecret = (env as any).BOOTSTRAP_OWNER_SECRET;

    // If no secret is configured, allow in non-production
    if (!expectedSecret) {
        return (env as any).ENVIRONMENT !== 'production';
    }

    const headerSecret = request.headers.get('X-Bootstrap-Secret');
    if (headerSecret === expectedSecret) return true;

    if (allowQuery) {
        const querySecret = url.searchParams.get('secret');
        if (querySecret === expectedSecret) return true;
    }

    return false;
}

/**
 * Handle all /__bootstrap__/* requests.
 * Always returns a Response (wizard page, API response, or 404).
 */
export async function handleBootstrapRoute(context: BootstrapContext): Promise<Response> {
    const { url, platformState } = context;
    const path = url.pathname;
    const isApiRequest = path.startsWith('/__bootstrap__/api/');

    // 1. Check for LOCKED state
    if (platformState.source === 'env' && platformState.state !== 'READY') {
        if (context.request.method === 'GET' && !isApiRequest) {
            return new Response(renderLockedPage(platformState), {
                status: 503,
                headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Retry-After': '60' },
            });
        }
        if (isApiRequest) {
            return jsonResp(
                { error: 'Platform restricted via environment configuration', code: 'PLATFORM_LOCKED' },
                503,
            );
        }
    }

    // 2. Security Check for API and Wizard (POST/GET)
    // Only allow query param for the GET wizard page
    const allowQuery = !isApiRequest && context.request.method === 'GET';
    if (!isValidSecret(context, allowQuery)) {
        if (isApiRequest) {
            return jsonResp(
                {
                    error: 'Unauthorized: Valid bootstrap secret required in X-Bootstrap-Secret header',
                    code: 'UNAUTHORIZED',
                },
                401,
            );
        }
        // For HTML page in production without secret, show 401
        if ((context.env as any).ENVIRONMENT === 'production') {
            return new Response('Unauthorized: Valid bootstrap secret required (?secret=xxx)', { status: 401 });
        }
    }

    // API routes
    if (path === '/__bootstrap__/api/status') return handleStatus(context);
    if (path === '/__bootstrap__/api/init') return handleInit(context);
    if (path === '/__bootstrap__/api/seed') return handleSeed(context);
    if (path === '/__bootstrap__/api/create-owner') return handleCreateOwner(context);
    if (path === '/__bootstrap__/api/finalize') return handleFinalize(context);

    // Wizard HTML page — serve for any /__bootstrap__* GET
    if (context.request.method === 'GET') {
        return serveWizardPage(context);
    }

    return jsonResp({ error: 'Not found' }, 404);
}

/**
 * Intercept all non-bootstrap requests when platform is not READY.
 * Returns a redirect/error Response, or null if the platform is ready.
 */
export function interceptIfNotReady(request: Request, url: URL, platformState: PlatformStateResult): Response | null {
    const path = url.pathname;

    // Always allow bootstrap routes through
    if (path.startsWith('/__bootstrap__')) return null;

    // Allow health check through always
    if (path === '/api/health') return null;

    // Platform is READY and not in panic → let request through
    if (platformState.state === 'READY' && !platformState.panic) return null;

    // Panic mode (KV=READY but DB dead)
    if (platformState.panic) {
        return new Response(renderMaintenancePage(platformState), {
            status: 503,
            headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Retry-After': '30' },
        });
    }

    // ENV locked
    if (platformState.source === 'env' && platformState.state !== 'READY') {
        return new Response(renderLockedPage(platformState), {
            status: 503,
            headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Retry-After': '60' },
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
    const isApiRequest = path.startsWith('/api/') || request.headers.get('Accept')?.includes('application/json');

    if (isApiRequest) {
        return jsonResp(
            {
                error: 'Platform not initialized',
                code: 'PLATFORM_NOT_READY',
                state: platformState.state,
                setup_url: '/__bootstrap__',
            },
            503,
        );
    }

    // HTML request → redirect to bootstrap wizard
    return Response.redirect(new URL('/__bootstrap__', url.origin).toString(), 302);
}

// ============================================================
// Route handlers
// ============================================================

/**
 * GET /__bootstrap__/api/status
 * Returns current platform state, bindings, table inventory, and env config hints.
 */
async function handleStatus(context: BootstrapContext): Promise<Response> {
    const { platformState, env } = context;
    const bindings = probeBindings(env);

    // Check for important env vars
    const envConfig = {
        authSecret: !!(env as any).AUTH_SECRET,
        migrationSecret: !!(env as any).MIGRATION_SECRET,
        bootstrapOwnerSecret: !!(env as any).BOOTSTRAP_OWNER_SECRET,
        emailProvider:
            !!(env as any).EMAIL_RESEND_API_KEY || !!(env as any).AWS_ACCESS_KEY_ID || !!(env as any).EMAIL_SERVER,
        environment: (env as any).ENVIRONMENT || 'unknown',
    };

    // Count tables if DB available
    let tableCount = 0;
    let tables: string[] = [];
    if (env.OBCF_D1) {
        try {
            const result = await env.OBCF_D1.prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
            ).all();
            tables = (result.results || []).map((r: any) => r.name as string);
            tableCount = tables.length;
        } catch {
            /* DB not accessible */
        }
    }

    // Check user count
    let userCount = 0;
    if (env.OBCF_D1 && tables.includes('users')) {
        try {
            const row = await env.OBCF_D1.prepare('SELECT COUNT(*) as count FROM users').first<any>();
            userCount = Number(row?.count ?? 0);
        } catch {
            /* table may not exist */
        }
    }

    // Check role count
    let roleCount = 0;
    if (env.OBCF_D1 && tables.includes('roles')) {
        try {
            const row = await env.OBCF_D1.prepare('SELECT COUNT(*) as count FROM roles').first<any>();
            roleCount = Number(row?.count ?? 0);
        } catch {
            /* table may not exist */
        }
    }

    // Environment check
    const isDev = (env as any).ENVIRONMENT === 'development';
    const isReady = platformState.state === 'READY';

    // If READY and NOT dev, return minimal info to prevent leakage
    if (isReady && !isDev) {
        return jsonResp({
            state: platformState.state,
            timestamp: Date.now(),
        });
    }

    return jsonResp({
        state: platformState.state,
        source: platformState.source,
        panic: platformState.panic,
        reason: platformState.reason,
        bindings,
        envConfig,
        database: { tableCount, tables, userCount, roleCount },
        timestamp: Date.now(),
    });
}

/**
 * POST /__bootstrap__/api/init
 * Step 1: Clears OBCF_KV, then creates schema tables + runs all migrations.
 */
async function handleInit(context: BootstrapContext): Promise<Response> {
    const { env, request } = context;

    if (request.method !== 'POST') {
        return jsonResp({ error: 'Method not allowed' }, 405);
    }

    if (!env.OBCF_D1) {
        return jsonResp(
            {
                error: 'D1 database binding not available',
                code: 'MISSING_BINDING',
                hint: 'Configure OBCF_D1 in your wrangler.jsonc',
            },
            503,
        );
    }

    try {
        // 1. Wipe KV so no stale cache survives a fresh bootstrap (platform_state, rbac, queue, ratelimit, etc.)
        const kvCleared = await clearKvNamespace(env);

        // 2. Create the meta table and mark BOOTSTRAPPING
        await ensureMetaTable(env);
        await writeDBState(env, 'BOOTSTRAPPING');
        await writeKVState(env, 'BOOTSTRAPPING');

        // 3. Collect schemas and validate they're non-empty
        const allSchemas = getAllSchemas();
        if (!allSchemas || Object.keys(allSchemas).length === 0) {
            await writeDBState(env, 'UNINITIALIZED');
            await writeKVState(env, 'UNINITIALIZED');
            return jsonResp(
                {
                    success: false,
                    error: 'Schema collection returned no tables — check config.migrations.ts and schemas-helper.ts',
                    code: 'SCHEMA_EMPTY',
                },
                500,
            );
        }

        // 4. Run ottaorm autoInit (creates all tables from Drizzle schemas)
        const driver = createD1Driver(env.OBCF_D1);
        const initResult = await autoInit({
            driver,
            schema: allSchemas,
            customMigrations: appMigrations,
            verbose: true,
            // Allow destructive migrations only when explicitly enabled via env
            allowDestructive:
                env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === '1' ||
                env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === 'true',
        });

        // 5. Run core SQL migrations (users, sessions, accounts, RBAC, multi-tenant)
        const sqlResult = await runCoreSQLMigrations(env);

        return jsonResp({
            success: initResult.success,
            message: initResult.message,
            autoInit: initResult.details,
            sqlMigrations: sqlResult,
            kvCleared,
            timestamp: Date.now(),
        });
    } catch (error: any) {
        // Reset state so the platform isn't stuck in BOOTSTRAPPING on failure
        try {
            await writeDBState(env, 'UNINITIALIZED');
            await writeKVState(env, 'UNINITIALIZED');
        } catch {
            // State rollback is best-effort; let the main error propagate
        }
        return jsonResp({ success: false, error: error.message, code: 'INIT_FAILED' }, 500);
    }
}

/**
 * POST /__bootstrap__/api/seed
 * Step 2: Seed RBAC roles and permissions using ORM models.
 */
async function handleSeed(context: BootstrapContext): Promise<Response> {
    const { env, request } = context;

    if (request.method !== 'POST') {
        return jsonResp({ error: 'Method not allowed' }, 405);
    }

    if (!env.OBCF_D1) {
        return jsonResp({ error: 'D1 database binding not available' }, 503);
    }

    try {
        ensureOrmConnection(env);

        // Seed default brand kit + route mappings for current app (brand kits are always app-scoped)
        const appId = (env as { APP_ID?: string }).APP_ID ?? 'otta-web';
        await ensureAppBrandDefaults('Ottabase', appId);

        // Seed default roles (owner, admin, editor, viewer, member)
        const createdRoles = await Role.ensureDefaultRoles();
        const roleNames = createdRoles.map((r: any) => r.get('name') as string);
        const normalizedRoles = await enforceDefaultRolePermissions(env);

        // Count existing roles for reporting
        const allRolesResult = await env.OBCF_D1.prepare('SELECT name FROM roles').all();
        const existingRoles = (allRolesResult.results || []).map((r: any) => r.name as string);

        return jsonResp({
            success: true,
            roles: { created: roleNames, existing: existingRoles, normalized: normalizedRoles },
            timestamp: Date.now(),
        });
    } catch (error: any) {
        return jsonResp({ success: false, error: error.message, code: 'SEED_FAILED' }, 500);
    }
}

/**
 * POST /__bootstrap__/api/create-owner
 * Step 3: Create the first admin/owner account.
 * Body: { email: string, password: string, name?: string }
 */
async function handleCreateOwner(context: BootstrapContext): Promise<Response> {
    const { env, request } = context;

    if (request.method !== 'POST') {
        return jsonResp({ error: 'Method not allowed' }, 405);
    }

    if (!env.OBCF_D1) {
        return jsonResp({ error: 'D1 database binding not available' }, 503);
    }

    let body: { email?: string; password?: string; name?: string };
    try {
        body = await request.json();
    } catch {
        return jsonResp({ error: 'Invalid JSON body' }, 400);
    }

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const name = (body.name || '').trim();

    // Validate
    const errors: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Valid email address required';
    }
    // Let's use a standard strong password regex: Min 8, 1 Uppercase, 1 Special.
    const strongPasswordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!password || !strongPasswordRegex.test(password)) {
        errors.password =
            'Password must be at least 8 characters and contain at least one uppercase letter and one special character.';
    }
    if (Object.keys(errors).length > 0) {
        return jsonResp({ success: false, errors, code: 'VALIDATION_ERROR' }, 400);
    }

    try {
        ensureOrmConnection(env);

        await Role.ensureDefaultRoles();
        await enforceDefaultRolePermissions(env);

        // Check if users already exist
        const countRow = await env.OBCF_D1.prepare('SELECT COUNT(*) as count FROM users').first<any>();
        const userCount = Number(countRow?.count ?? 0);

        if (userCount > 0) {
            return jsonResp(
                {
                    success: false,
                    error: 'An account already exists. The owner account can only be created during first-time setup.',
                    code: 'OWNER_EXISTS',
                },
                409,
            );
        }

        // Create user with hashed password
        const passwordHash = await hashPassword(password);
        const newUser = await User.create({
            email,
            name: name || null,
            emailVerified: Date.now(), // Auto-verify owner
            passwordHash,
        });

        const userId = newUser.get('id') as string;

        // Create personal organization
        let organizationId: string | null = null;
        let assignedRole: string | null = null;
        try {
            const provisioned = await provisionDefaultOrganizationForUser({
                user: newUser as any,
                email,
                name,
                organizationRole: 'owner',
                assignedBy: 'system',
                roleFallbacks: ['owner'],
                appId: (env as { APP_ID?: string }).APP_ID ?? 'otta-web',
            });
            organizationId = provisioned.organizationId;
            assignedRole = provisioned.assignedRole;
        } catch (error) {
            return jsonResp(
                {
                    success: false,
                    error: 'Failed to provision default organization for owner account',
                    code: 'ORG_PROVISION_FAILED',
                },
                500,
            );
        }

        // Auto-login: create auth cookie so the user is immediately authenticated
        const cookieName = (env as any).AUTH_COOKIE_NAME || 'authjs.session-token';
        const maxAgeSeconds = 30 * 24 * 60 * 60;
        let sessionToken: string | null = null;

        // Primary path: JWT session strategy (default)
        // Owner role gets *:* permissions; Auth.js callbacks will enrich from DB on /session, but JWT must have them for immediate use
        const ownerPermissions = assignedRole === 'owner' ? ['*:*'] : [];
        try {
            const nowSeconds = Math.floor(Date.now() / 1000);
            const authSecret = (env as any).AUTH_SECRET || 'dev-secret-change-in-production';
            sessionToken = await encodeAuthJwt({
                token: {
                    id: userId,
                    sub: userId,
                    email,
                    name: name || null,
                    emailVerified: Date.now(),
                    organizationId: organizationId || undefined,
                    roles: assignedRole ? [assignedRole] : undefined,
                    permissions: ownerPermissions,
                    jti: crypto.randomUUID(),
                    iat: nowSeconds,
                    exp: nowSeconds + maxAgeSeconds,
                },
                secret: authSecret,
                maxAge: maxAgeSeconds,
                salt: cookieName,
            });
        } catch (error) {
            console.warn('JWT cookie generation failed during bootstrap auto-login:', error);
            sessionToken = null;
        }

        // Fallback for database-session strategy deployments
        if (!sessionToken) {
            try {
                sessionToken = crypto.randomUUID();
                const expiresMs = Date.now() + maxAgeSeconds * 1000;
                const nowMs = Date.now();
                await env.OBCF_D1.prepare(
                    `INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                )
                    .bind(crypto.randomUUID(), sessionToken, userId, expiresMs, nowMs, nowMs)
                    .run();
            } catch {
                // Session creation is non-fatal; user can log in manually
                sessionToken = null;
            }
        }

        const responseData = {
            success: true,
            user: {
                id: userId,
                email,
                name: name || null,
                role: assignedRole || 'owner',
            },
            organizationId,
            sessionToken: sessionToken ? true : false,
            sessionExpires: Date.now() + maxAgeSeconds * 1000,
            timestamp: Date.now(),
        };

        // Set session cookie so the browser is immediately authenticated
        if (sessionToken) {
            const reqUrl = new URL(request.url);
            const secure = reqUrl.protocol === 'https:';
            const cookie = `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
            return new Response(JSON.stringify(responseData), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': cookie,
                },
            });
        }

        return jsonResp(responseData);
    } catch (error: any) {
        if (error.message?.toLowerCase().includes('unique')) {
            return jsonResp({ success: false, error: 'Email already in use', code: 'EMAIL_EXISTS' }, 409);
        }
        return jsonResp({ success: false, error: error.message, code: 'CREATE_OWNER_FAILED' }, 500);
    }
}

/**
 * POST /__bootstrap__/api/finalize
 * Step 4: Verify everything, mark platform READY.
 */
async function handleFinalize(context: BootstrapContext): Promise<Response> {
    const { env, request } = context;

    if (request.method !== 'POST') {
        return jsonResp({ error: 'Method not allowed' }, 405);
    }

    if (!env.OBCF_D1) {
        return jsonResp({ error: 'D1 database binding not available' }, 503);
    }

    try {
        // Verify tables actually exist before marking READY
        const tableCheck = await verifyCoreTables(env);
        if (!tableCheck.ok) {
            return jsonResp(
                {
                    success: false,
                    error: 'Core tables missing — run initialization first',
                    missing: tableCheck.missing,
                },
                400,
            );
        }

        // Verify at least one user exists
        const userRow = await env.OBCF_D1.prepare('SELECT COUNT(*) as count FROM users').first<any>();
        const userCount = Number(userRow?.count ?? 0);
        if (userCount === 0) {
            return jsonResp(
                {
                    success: false,
                    error: 'No admin account found — create an owner account first',
                    code: 'NO_OWNER',
                },
                400,
            );
        }

        // Verify roles are seeded
        const roleRow = await env.OBCF_D1.prepare('SELECT COUNT(*) as count FROM roles').first<any>();
        const roleCount = Number(roleRow?.count ?? 0);
        if (roleCount === 0) {
            return jsonResp(
                {
                    success: false,
                    error: 'No roles found — run RBAC seed first',
                    code: 'NO_ROLES',
                },
                400,
            );
        }

        // Mark platform as READY in both DB and KV
        await writeDBState(env, 'READY');
        await writeKVState(env, 'READY');

        return jsonResp({
            success: true,
            state: 'READY',
            message: 'Platform is now ready.',
            summary: {
                tables: tableCheck.totalTables,
                users: userCount,
                roles: roleCount,
            },
            timestamp: Date.now(),
        });
    } catch (error: any) {
        return jsonResp({ success: false, error: error.message, code: 'FINALIZE_FAILED' }, 500);
    }
}

function serveWizardPage(context: BootstrapContext): Response {
    return new Response(renderWizardPage(context.platformState), {
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

async function runCoreSQLMigrations(
    env: CloudflareEnv,
): Promise<{ executed: string[]; skipped: string[]; errors: string[] }> {
    const executed: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

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

async function verifyCoreTables(
    env: CloudflareEnv,
): Promise<{ ok: boolean; missing: string[]; found: string[]; totalTables: number }> {
    const requiredTables = [
        '_ottabase_meta',
        '_ottabase_migrations',
        'users',
        'accounts',
        'sessions',
        'verification_tokens',
        'authenticators',
        'posts',
        'tags',
        'post_tags',
        'roles',
        'permissions',
        'user_roles',
        'audit_logs',
        'organizations',
        'organization_members',
    ];
    const found: string[] = [];
    const missing: string[] = [];
    let totalTables = 0;

    try {
        const result = await env
            .OBCF_D1!.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
            .all();

        const existingTables = new Set((result.results || []).map((row: any) => row.name as string));
        totalTables = existingTables.size;

        for (const table of requiredTables) {
            if (existingTables.has(table)) {
                found.push(table);
            } else {
                missing.push(table);
            }
        }
    } catch {
        return { ok: false, missing: requiredTables, found: [], totalTables: 0 };
    }

    return { ok: missing.length === 0, missing, found, totalTables };
}
