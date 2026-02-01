/**
 * Audit Logging Example API Route
 *
 * Demonstrates usage of @ottabase/audit middleware for automatic audit logging
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection, User } from '@ottabase/ottaorm';
import { withAudit } from '@ottabase/audit/middleware';
import { logCreate, logUpdate, logDelete, extractRequestContext } from '@ottabase/audit/utils';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/examples/audit - Automatically logs read access
 */
export const GET = withAudit(
    async (request: NextRequest) => {
        try {
            const { env } = await getCloudflareContext();

            if (!env.OBCF_D1) {
                return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
            }

            registerConnection('default', createD1Driver(env.OBCF_D1));

            const users = await User.all({
                orderBy: 'createdAt',
                orderDirection: 'desc',
            });

            // The audit middleware automatically logs this read action
            return NextResponse.json({
                users: users.map((u) => u.toJson()),
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            // The audit middleware automatically logs failures too
            return NextResponse.json(
                {
                    error: 'Failed to fetch users',
                    details: error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
    },
    {
        resourceType: 'user',
        action: 'read',
    }
);

/**
 * POST /api/examples/audit - Automatically logs create action
 */
export const POST = withAudit(
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

            const user = await User.create({
                id: crypto.randomUUID(),
                name: name || null,
                email,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Manual audit logging with more details
            const userId = request.headers.get('x-user-id');
            const userEmail = request.headers.get('x-user-email');
            const context = extractRequestContext(request, userId || undefined, userEmail || undefined);

            await logCreate('user', user.get('id') as string, body, context);

            return NextResponse.json({
                message: 'User created and audit logged',
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
        resourceType: 'user',
        action: 'create',
        includeRequestBody: true,
        getResourceId: async (request) => {
            // Extract resource ID from response if needed
            return undefined;
        },
    }
);

/**
 * PATCH /api/examples/audit/[id] - Example with manual audit logging for updates
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
        }

        registerConnection('default', createD1Driver(env.OBCF_D1));

        const userId = params.id;
        const body = await request.json();

        const user = await User.find(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Capture old values for audit
        const oldData = {
            name: user.get('name'),
            email: user.get('email'),
        };

        // Update user
        user.set('name', body.name);
        user.set('email', body.email);
        await user.save();

        // Manual audit logging with changes
        const requestUserId = request.headers.get('x-user-id');
        const requestUserEmail = request.headers.get('x-user-email');
        const context = extractRequestContext(request, requestUserId || undefined, requestUserEmail || undefined);

        const changes: Record<string, { from: any; to: any }> = {};
        if (oldData.name !== body.name) {
            changes.name = { from: oldData.name, to: body.name };
        }
        if (oldData.email !== body.email) {
            changes.email = { from: oldData.email, to: body.email };
        }

        await logUpdate('user', userId, changes, context);

        return NextResponse.json({
            message: 'User updated and audit logged',
            user: user.toJson(),
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            {
                error: 'Failed to update user',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/examples/audit/[id] - Example with manual audit logging for deletes
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
        }

        registerConnection('default', createD1Driver(env.OBCF_D1));

        const userId = params.id;

        const user = await User.find(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await user.destroy();

        // Manual audit logging
        const requestUserId = request.headers.get('x-user-id');
        const requestUserEmail = request.headers.get('x-user-email');
        const context = extractRequestContext(request, requestUserId || undefined, requestUserEmail || undefined);

        await logDelete('user', userId, context);

        return NextResponse.json({
            message: 'User deleted and audit logged',
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
}
