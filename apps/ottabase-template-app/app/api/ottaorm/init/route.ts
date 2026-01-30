/**
 * OttaORM Database Initialization API
 *
 * This endpoint AUTOMATICALLY initializes your database:
 * - Auto-detects tables from your Models
 * - Creates missing tables
 * - Adds new columns to existing tables
 * - Runs custom migrations
 *
 * NO CLI REQUIRED - Just call this endpoint!
 *
 * Security:
 * - Development: No authentication required
 * - Production: Requires MIGRATION_SECRET via query param, body, or header
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { autoInit, collectTableSchemas } from '@ottabase/ottaorm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { appMigrations } from '../../../../ottabase/migrations';
import * as schema from '../../../../ottabase/db/schema';

export const runtime = 'edge';

/**
 * Check authentication for migration endpoint
 */
async function checkAuth(request: NextRequest, env: any): Promise<boolean> {
    // Allow in development without auth
    const isDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT;
    if (isDev) {
        return true;
    }

    // Production: require secret
    if (!env.MIGRATION_SECRET) {
        console.error('[MIGRATION] MIGRATION_SECRET not configured in production');
        return false;
    }

    // Check for secret in multiple places
    let providedSecret: string | null = null;

    // 1. Query parameter: ?secret=xxx
    const url = new URL(request.url);
    providedSecret = url.searchParams.get('secret');

    // 2. Body parameter (if POST)
    if (!providedSecret && request.method === 'POST') {
        try {
            const body = await request.json();
            providedSecret = body.secret;
        } catch {
            // Not JSON or no body
        }
    }

    // 3. Authorization header: Bearer xxx
    if (!providedSecret) {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            providedSecret = authHeader.substring(7);
        }
    }

    return providedSecret === env.MIGRATION_SECRET;
}

export async function GET(request: NextRequest) {
    return handleMigration(request);
}

export async function POST(request: NextRequest) {
    return handleMigration(request);
}

async function handleMigration(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
        }

        // Check authentication
        const isAuthorized = await checkAuth(request, env);
        if (!isAuthorized) {
            return NextResponse.json(
                { error: 'Unauthorized - MIGRATION_SECRET required in production' },
                { status: 401 },
            );
        }

        // Create driver
        const driver = createD1Driver(env.OBCF_D1);

        // Collect all table schemas from Models
        const tables = collectTableSchemas(schema);

        // ============================================================
        // AUTOMATED MIGRATIONS - No CLI Required!
        // ============================================================
        // This automatically:
        // 1. Detects all tables from your Models
        // 2. Creates tables that don't exist
        // 3. Adds new columns to existing tables
        // 4. Runs custom migrations
        //
        // Just define your Models and call this endpoint!
        // ============================================================
        const result = await autoInit({
            driver,
            schema: tables,
            customMigrations: appMigrations,
            verbose: true,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Database initialization error:', error);
        return NextResponse.json(
            {
                error: 'Failed to initialize database',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
