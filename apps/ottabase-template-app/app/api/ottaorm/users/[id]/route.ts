/**
 * OttaORM User API - Single User Operations
 * Eloquent-like syntax - no driver parameter needed!
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection, User } from '@ottabase/ottaorm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/ottaorm/users/[id] - Get a single user
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { env } = await getCloudflareContext();
        const { id } = await params;

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
        }

        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Eloquent-like syntax!
        const user = await User.find(id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            user: user.toJson(),
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch user',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/ottaorm/users/[id] - Delete a user
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { env } = await getCloudflareContext();
        const { id } = await params;

        if (!env.OBCF_D1) {
            return NextResponse.json({ error: 'D1 database not configured' }, { status: 500 });
        }

        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Eloquent-like syntax!
        const deleted = await User.delete(id);

        if (!deleted) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete user',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
