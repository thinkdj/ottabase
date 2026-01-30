/**
 * OttaORM Users API
 *
 * Demonstrates CRUD operations using OttaORM User model
 * with Eloquent-like syntax (no need to pass driver!)
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection, User } from '@ottabase/ottaorm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/ottaorm/users - Get all users
 */
export async function GET(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
        }

        // Set driver once - then use models without passing it!
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Eloquent-like syntax!
        const users = await User.all({
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });

        return NextResponse.json({
            users: users.map((u) => u.toJson()),
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch users',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/**
 * POST /api/ottaorm/users - Create a new user
 */
export async function POST(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
        }

        const body = await request.json();
        const { name, email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Set driver once
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Eloquent-like syntax!
        const user = await User.create({
            id: crypto.randomUUID(),
            name: name || null,
            email,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({
            user: user.toJson(),
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            {
                error: 'Failed to create user',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
