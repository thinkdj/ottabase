/**
 * Combined RBAC + Audit Logging Example
 *
 * Demonstrates how to use both @ottabase/rbac and @ottabase/audit together
 * for secure, audited API endpoints
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection, User } from '@ottabase/ottaorm';
import { withRBAC } from '@ottabase/rbac/middleware';
import { logCreate, extractRequestContext } from '@ottabase/audit/utils';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Helper function to compose multiple middleware
 */
function compose<T extends (...args: any[]) => Promise<Response>>(
    handler: T,
    ...middlewares: Array<(h: T) => T>
): T {
    return middlewares.reduce((h, middleware) => middleware(h), handler);
}

/**
 * POST /api/examples/rbac-audit - Protected and audited endpoint
 *
 * This endpoint:
 * 1. Requires 'users:create' permission (RBAC)
 * 2. Automatically logs the action (Audit)
 */
export const POST = withRBAC(
    async (request: NextRequest) => {
        try {
            const { env } = await getCloudflareContext();

            if (!env.OBCF_D1) {
                return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
            }

            registerConnection('default', createD1Driver(env.OBCF_D1));

            const body = await request.json();
            const { name, email } = body;

            if (!email) {
                return NextResponse.json({ error: 'Email is required' }, { status: 400 });
            }

            // Create user
            const user = await User.create({
                id: crypto.randomUUID(),
                name: name || null,
                email,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Audit log the creation
            const userId = request.headers.get('x-user-id');
            const userEmail = request.headers.get('x-user-email');
            const context = extractRequestContext(request, userId || undefined, userEmail || undefined);

            await logCreate('user', user.get('id') as string, body, context);

            return NextResponse.json({
                message: 'User created successfully (protected and audited)',
                user: user.toJson(),
            });
        } catch (error) {
            console.error('Error creating user:', error);
            return NextResponse.json(
                {
                    error: 'Failed to create user',
                    details: error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
    },
    {
        permissions: ['users:create'],
        getUserFromRequest: async (request) => {
            const userId = request.headers.get('x-user-id');
            if (!userId) return null;
            return User.find(userId);
        },
    }
);

/**
 * DELETE /api/examples/rbac-audit - Admin-only audited delete
 *
 * This endpoint:
 * 1. Requires 'admin' role (RBAC)
 * 2. Logs the deletion (Audit)
 */
export const DELETE = withRBAC(
    async (request: NextRequest) => {
        try {
            const { env } = await getCloudflareContext();

            if (!env.OBCF_D1) {
                return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
            }

            registerConnection('default', createD1Driver(env.OBCF_D1));

            const url = new URL(request.url);
            const userId = url.searchParams.get('id');

            if (!userId) {
                return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
            }

            const user = await User.find(userId);
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            await user.destroy();

            // Audit log the deletion
            const requestUserId = request.headers.get('x-user-id');
            const requestUserEmail = request.headers.get('x-user-email');
            const context = extractRequestContext(request, requestUserId || undefined, requestUserEmail || undefined);

            const { logDelete } = await import('@ottabase/audit/utils');
            await logDelete('user', userId, context);

            return NextResponse.json({
                message: 'User deleted successfully (admin action audited)',
            });
        } catch (error) {
            console.error('Error deleting user:', error);
            return NextResponse.json(
                {
                    error: 'Failed to delete user',
                    details: error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
    },
    {
        roles: ['admin'],
        getUserFromRequest: async (request) => {
            const userId = request.headers.get('x-user-id');
            if (!userId) return null;
            return User.find(userId);
        },
    }
);
