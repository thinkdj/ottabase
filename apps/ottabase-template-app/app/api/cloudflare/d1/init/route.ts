import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Todo } from '../../../../../ottabase/models/Todo';

export const runtime = 'edge';

export async function POST(_request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_D1) {
            return NextResponse.json(
                { error: 'D1 database binding not configured. Check wrangler.jsonc' },
                { status: 500 },
            );
        }

        // ✅ Use Drizzle with OttaORM
        registerConnection('default', createD1Driver(env.OBCF_D1));

        // Test the connection by counting todos
        // In production, use migrations: pnpm db:migrate --name=init
        const todos = await Todo.all();
        const count = todos.length;

        return NextResponse.json({
            success: true,
            message: 'Database connection verified successfully',
            info: `Found ${count} existing todos. Use 'pnpm api:ottaorm:init' to run migrations.`,
        });
    } catch (error) {
        console.error('D1 initialization error:', error);

        // If the table doesn't exist, provide helpful migration instructions
        if (error instanceof Error && error.message.includes('no such table')) {
            return NextResponse.json(
                {
                    error: 'Database not initialized',
                    message: 'Run migrations first: Visit /api/ottaorm/init or use the OttaORM migration system',
                    hint: 'GET /api/ottaorm/init to initialize the database',
                },
                { status: 500 },
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to verify database connection',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
