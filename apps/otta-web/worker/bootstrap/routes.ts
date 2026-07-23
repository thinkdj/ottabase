// ============================================================
// Ottabase Bootstrap - API Routes & Wizard Pages
// ============================================================
//
// Handles all /__bootstrap__/* requests:
//   GET  /__bootstrap__                  → Wizard UI (HTML)
//   GET  /__bootstrap__/seed             → Focused "reconcile roles" UI over POST /api/seed
//   GET  /__bootstrap__/promote-owner    → UI over POST /api/admin/platform-owner/promote
//   GET  /__bootstrap__/api/status       → Current platform state + binding probe
//   POST /__bootstrap__/api/init         → Clear KV, then run schema creation + migrations
//   POST /__bootstrap__/api/seed         → Seed/reconcile RBAC roles + permissions
//   POST /__bootstrap__/api/create-owner → Create first platform owner account
//   POST /__bootstrap__/api/finalize     → Mark platform READY
// ============================================================

import { bootstrapFirstUser, createSessionCookieForUser, hashPassword } from '@ottabase/auth/backend';
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
import { ottablogOrgModeSuppressedIndexes } from '@ottabase/ottablog';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAllSchemas } from '../../ottabase/db/schemas-helper';
import { buildAppMigrations } from '../../ottabase/migrations';
import { reconcileSystemRoleSessions } from '../lib/auth-utils';
import { enforceBruteForceThrottle } from '../lib/rate-limiting';
import { getClientIpAddress } from '../lib/utils';
import { ensureAppBrandDefaults, provisionDefaultOrganizationForUser } from '../lib/user-provisioning';
import {
    renderBindingsErrorPage,
    renderLockedPage,
    renderMaintenancePage,
    renderPromoteOwnerPage,
    renderReseedPage,
    renderWizardPage,
} from './pages';
import { clearKvNamespace, ensureMetaTable, probeBindings, writeDBState, writeKVState } from './state-resolver';
import { META_OWNER_CLAIMED_KEY, META_TABLE } from './types';
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

/**
 * Check if the provided bootstrap secret is valid.
 * For API requests, only X-Bootstrap-Secret header is accepted.
 * For the main wizard page (GET), the ?secret= query parameter is also allowed.
 */
function isValidSecret(context: BootstrapContext, allowQuery = false): boolean {
    const { env, request, url } = context;
    const expectedSecret = (env as any).BOOTSTRAP_OWNER_SECRET;

    // If no secret is configured, only allow in an EXPLICIT dev environment. An unset or
    // unknown ENVIRONMENT is treated as production and denied, so a real deploy cannot run
    // the owner-creation wizard unauthenticated just because ENVIRONMENT wasn't set.
    if (!expectedSecret) {
        const environment = String((env as any).ENVIRONMENT || '').toLowerCase();
        return ['development', 'dev', 'test', 'local'].includes(environment);
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
        // Throttle brute-forcing of BOOTSTRAP_OWNER_SECRET. EVERY bootstrap endpoint is a
        // 401-vs-200 oracle for the secret (esp. the read-only GET /api/status), so without this an
        // attacker could guess it unthrottled here and then make a single valid promote/create-owner
        // call — making the promote endpoint's own rate limit moot. Only FAILED attempts are counted,
        // so legit use with the correct secret is never limited. enforceBruteForceThrottle fails OPEN
        // WITH A LOGGED WARNING if the limiter binding is missing (a real 429 still blocks) — the
        // same policy the promote endpoint uses, so the two behave consistently.
        const ip = getClientIpAddress(context.request);
        const limited = await enforceBruteForceThrottle(
            context.request,
            context.env,
            `bootstrap:secret:${ip}`,
            'bootstrap secret check',
        );
        if (limited) return limited;

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

    // Focused re-seed page (reconcile default roles) — a lightweight maintenance UI over
    // /api/seed, usable after first-run setup. Matched before the generic wizard fallback below.
    if (path === '/__bootstrap__/seed' && context.request.method === 'GET') {
        return serveReseedPage(context);
    }

    // Focused promote-owner page — grants platform_owner to an existing account via the secret-gated
    // POST /api/admin/platform-owner/promote. Break-glass / ownership-transfer UI (no login needed).
    if (path === '/__bootstrap__/promote-owner' && context.request.method === 'GET') {
        return servePromoteOwnerPage(context);
    }

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

    // Panic mode — NOTE: currently unreachable. The resolver's dead-D1 panic
    // probe was removed with the READY fast path (see PlatformStateResult.panic
    // in types.ts); this branch is retained for a future explicit health probe.
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

        // Org-mode blogs: the index-swap migration runs once (tracked), but autoInit's
        // ensure step re-creates schema-declared indexes on EVERY run — suppress the
        // dropped strict slug indexes so re-running this wizard step can't silently
        // restore app-wide uniqueness and break per-org slug namespaces. Env-aware
        // (OTTABLOG_MODE), matching the sibling /api/ottaorm/init route.
        const ottabaseConfig = getOttabaseConfig(env);
        const blogOrgMode = ottabaseConfig.packages.ottablog && ottabaseConfig.features.ottablog.mode === 'org';

        const initResult = await autoInit({
            driver,
            schema: allSchemas,
            customMigrations: buildAppMigrations(env as unknown as Record<string, unknown>),
            verbose: true,
            // Allow destructive migrations only when explicitly enabled via env
            allowDestructive:
                env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === '1' ||
                env.MIGRATION_ALLOW_DESTRUCTIVE?.trim().toLowerCase() === 'true',
            suppressIndexes: blogOrgMode ? ottablogOrgModeSuppressedIndexes : [],
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

        // Seed default roles (platform_owner, owner, admin, editor, viewer, member) AND reconcile
        // existing system-role permission sets to the canonical definitions — e.g. heal a legacy
        // 'owner' = ['*:*'] row in place. This is the DELIBERATE heal path (heal:true); the signup
        // path only creates-if-missing. See ensureDefaultRoles.
        const changedRoles = await Role.ensureDefaultRoles({ heal: true });
        const roleNames = changedRoles.map((r: any) => r.get('name') as string);

        // A heal changes what the auth layer grants, so drop RBAC caches and refresh the
        // (small, system-scoped) platform-owner sessions — otherwise a healed permission set / the
        // platformAdmin flag wouldn't take effect until the JWT expires. Org-scoped sessions refresh
        // on next sign-in (see reconcileSystemRoleSessions).
        if (changedRoles.length > 0) {
            await reconcileSystemRoleSessions(env);
        }

        // Count existing roles for reporting
        const allRolesResult = await env.OBCF_D1.prepare('SELECT name FROM roles').all();
        const existingRoles = (allRolesResult.results || []).map((r: any) => r.name as string);

        return jsonResp({
            success: true,
            roles: { created: roleNames, existing: existingRoles },
            timestamp: Date.now(),
        });
    } catch (error: any) {
        return jsonResp({ success: false, error: error.message, code: 'SEED_FAILED' }, 500);
    }
}

/**
 * POST /__bootstrap__/api/create-owner
 * Step 3: Create the first platform owner account.
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

    // Tracks the platform owner row once created, so any failure after that point can roll it back.
    let createdUserId: string | null = null;
    try {
        ensureOrmConnection(env);
        await ensureMetaTable(env);

        // ensureDefaultRoles both creates missing system roles and self-heals existing ones to the
        // canonical permission sets, so no separate normalize step is needed here.
        await Role.ensureDefaultRoles();

        // Atomically claim the right to create the platform owner account.
        // Unlike a SELECT COUNT(*) check, this INSERT is guarded by the `key`
        // PRIMARY KEY on _ottabase_meta, so if two requests race, only one of
        // them can win the insert — the other fails immediately and never
        // proceeds to create a user, closing the TOCTOU window.
        try {
            await env.OBCF_D1.prepare(`INSERT INTO ${META_TABLE} (key, value, updated_at) VALUES (?, ?, ?)`)
                .bind(META_OWNER_CLAIMED_KEY, '1', Date.now())
                .run();
        } catch {
            return jsonResp(
                {
                    success: false,
                    error: 'An account already exists. The platform owner account can only be created during first-time setup.',
                    code: 'OWNER_EXISTS',
                },
                409,
            );
        }

        // Belt-and-braces: if a user somehow already exists (e.g. provisioned
        // out-of-band while the claim was held), don't silently create a
        // second account.
        const countRow = await env.OBCF_D1.prepare('SELECT COUNT(*) as count FROM users').first<any>();
        const userCount = Number(countRow?.count ?? 0);
        if (userCount > 0) {
            return jsonResp(
                {
                    success: false,
                    error: 'An account already exists. The platform owner account can only be created during first-time setup.',
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
            emailVerified: Date.now(), // Auto-verify platform owner
            passwordHash,
        });

        const userId = newUser.get('id') as string;
        createdUserId = userId;

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
            // Provisioning failed after the user row was created. Roll back the orphan user AND
            // release the claim — otherwise the userCount / OWNER_EXISTS guards above permanently
            // block a legitimate retry.
            await rollbackOwnerCreation(env, createdUserId);
            return jsonResp(
                {
                    success: false,
                    error: 'Failed to provision default organization for platform owner account',
                    code: 'ORG_PROVISION_FAILED',
                },
                500,
            );
        }

        // Claim the SYSTEM-scope platform_owner grant for this account.
        // provisionDefaultOrganizationForUser only assigns the org-scoped 'owner' role at the
        // personal-organization scope; without this the platform_owner slot stays unclaimed,
        // so the first person to sign in afterwards would seize global ownership via
        // bootstrapFirstUser. This is idempotent.
        await bootstrapFirstUser(env, { id: userId, email, name: name || null });

        // Auto-login: create the session cookie so the browser is immediately authenticated.
        // The bootstrap user now holds the SYSTEM-scoped 'platform_owner' grant (via
        // bootstrapFirstUser above) AND the org-scoped 'owner'. Let loadUserContext derive the
        // real context from those DB grants — it resolves platformAdmin=true and the '*:*'
        // permission set from the system-scoped grant, so no fake wildcard is injected here.
        const { cookie, session } = await createSessionCookieForUser(
            {
                id: userId,
                email,
                name: name || null,
                emailVerified: Date.now(),
            },
            env as any,
            request,
        );

        const responseData = {
            success: true,
            user: {
                id: userId,
                email,
                name: name || null,
                role: assignedRole || 'owner',
            },
            organizationId,
            sessionToken: true,
            sessionExpires: session.expiresAt,
            timestamp: Date.now(),
        };

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': cookie,
            },
        });
    } catch (error: any) {
        // Roll back any partially-created platform owner (orphan user row + held claim) so the
        // OWNER_EXISTS / userCount guards don't permanently block a legitimate retry.
        await rollbackOwnerCreation(env, createdUserId);

        if (error.message?.toLowerCase().includes('unique')) {
            return jsonResp({ success: false, error: 'Email already in use', code: 'EMAIL_EXISTS' }, 409);
        }
        return jsonResp({ success: false, error: error.message, code: 'CREATE_OWNER_FAILED' }, 500);
    }
}

/** Best-effort release of the platform-owner-creation claim (used when creation fails before a user row is committed). */
async function releaseOwnerClaim(env: CloudflareEnv): Promise<void> {
    if (!env.OBCF_D1) return;
    try {
        await env.OBCF_D1.prepare(`DELETE FROM ${META_TABLE} WHERE key = ?`).bind(META_OWNER_CLAIMED_KEY).run();
    } catch {
        /* best-effort; a stuck claim only requires re-running init to clear _ottabase_meta */
    }
}

/**
 * Best-effort rollback of a failed platform-owner-creation attempt: delete the just-created user
 * row (if any) and release the claim. Both must be undone together — a leftover user trips the
 * `userCount > 0` guard and a held claim trips OWNER_EXISTS, either of which would otherwise
 * permanently brick a legitimate retry of first-time setup.
 */
async function rollbackOwnerCreation(env: CloudflareEnv, userId: string | null): Promise<void> {
    if (userId) {
        try {
            await User.delete(userId);
        } catch {
            /* best-effort — a leftover row can still be cleared by re-running init */
        }
    }
    await releaseOwnerClaim(env);
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
                    error: 'No admin account found — create a platform owner account first',
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

function serveReseedPage(context: BootstrapContext): Response {
    return new Response(renderReseedPage(context.platformState), {
        status: 200,
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
}

function servePromoteOwnerPage(context: BootstrapContext): Response {
    return new Response(renderPromoteOwnerPage(context.platformState), {
        status: 200,
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
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
