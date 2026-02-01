/**
 * RBAC Example API Route
 *
 * Demonstrates usage of @ottabase/rbac middleware for role-based access control
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection, User } from '@ottabase/ottaorm';
import { withRBAC } from '@ottabase/rbac/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/examples/rbac - Protected endpoint requiring 'users:read' permission
 * Only users with the appropriate permission can access this endpoint
 */
export const GET = withRBAC(
    async (request: NextRequest) => {
        try {
            const { env } = await getCloudflareContext();

            if (!env.OBCF_D1) {
                return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
            }

            registerConnection('default', createD1Driver(env.OBCF_D1));

            // This code only runs if user has 'users:read' permission
            const users = await User.all({
                orderBy: 'createdAt',
                orderDirection: 'desc',
            });

            return NextResponse.json({
                message: 'Access granted!',
                users: users.map((u) => u.toJson()),
            });
        } catch (error) {
            console.error('Error in RBAC example:', error);
            return NextResponse.json(
                {
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
    },
    {
        permissions: ['users:read'],
        // Custom user getter (optional)
        getUserFromRequest: async (request) => {
            // In a real app, you'd extract this from session/JWT
            const userId = request.headers.get('x-user-id');
            if (!userId) return null;

            return User.find(userId);
        },
    }
);

/**
 * POST /api/examples/rbac - Protected endpoint requiring 'users:create' permission
 * Only users with the appropriate permission can create users
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

            const user = await User.create({
                id: crypto.randomUUID(),
                name: name || null,
                email,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return NextResponse.json({
                message: 'User created successfully',
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
 * DELETE /api/examples/rbac - Protected endpoint requiring admin role
 * Only admins can access this endpoint
 */
export const DELETE = withRBAC(
    async (request: NextRequest) => {
        try {
            return NextResponse.json({
                message: 'Admin access granted! This is a protected admin-only endpoint.',
            });
        } catch (error) {
            console.error('Error in admin endpoint:', error);
            return NextResponse.json(
                {
                    error: 'Internal server error',
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
