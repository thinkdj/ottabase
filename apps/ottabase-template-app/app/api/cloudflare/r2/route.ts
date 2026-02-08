import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createR2Client } from '@ottabase/cf/r2';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// POST /api/cloudflare/r2 - Upload a file
export async function POST(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_R2) {
            return NextResponse.json({ error: 'R2 bucket binding not configured' }, { status: 500 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const key = formData.get('key') as string;

        if (!file || !key) {
            return NextResponse.json({ error: 'File and key are required' }, { status: 400 });
        }

        const r2 = createR2Client({ bucket: env.OBCF_R2 });
        const buffer = await file.arrayBuffer();

        const result = await r2.put(key, buffer, {
            httpMetadata: {
                contentType: file.type,
            },
            customMetadata: {
                originalName: file.name,
                uploadedAt: String(Date.now()),
            },
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to upload file', details: result.error.message },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully',
            key,
            size: file.size,
        });
    } catch (error) {
        console.error('R2 POST error:', error);
        return NextResponse.json(
            {
                error: 'Failed to upload file',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}

// GET /api/cloudflare/r2?key=file.txt - Get file or list files
export async function GET(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_R2) {
            return NextResponse.json({ error: 'R2 bucket binding not configured' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        const list = searchParams.get('list') === 'true';

        const r2 = createR2Client({ bucket: env.OBCF_R2 });

        if (list) {
            // List all objects
            const result = await r2.list();

            if (!result.success) {
                return NextResponse.json(
                    { error: 'Failed to list objects', details: result.error.message },
                    { status: 500 },
                );
            }

            const objects = result.data.objects.map((obj) => ({
                key: obj.key,
                size: obj.size,
                uploaded: obj.uploaded,
                httpMetadata: obj.httpMetadata,
                customMetadata: obj.customMetadata,
            }));

            return NextResponse.json({ objects });
        }

        if (!key) {
            return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 });
        }

        // Get specific file
        const result = await r2.get(key);

        if (!result.success) {
            return NextResponse.json({ error: 'Failed to get file', details: result.error.message }, { status: 500 });
        }

        if (!result.data) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const object = result.data;

        return new Response(object.body as unknown as BodyInit, {
            headers: {
                'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
                'Content-Length': object.size.toString(),
                'Content-Disposition': `attachment; filename="${key}"`,
                ETag: object.etag,
            },
        });
    } catch (error) {
        console.error('R2 GET error:', error);
        return NextResponse.json(
            {
                error: 'Failed to get file',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}

// DELETE /api/cloudflare/r2?key=file.txt - Delete a file
export async function DELETE(request: NextRequest) {
    try {
        const { env } = await getCloudflareContext();

        if (!env.OBCF_R2) {
            return NextResponse.json({ error: 'R2 bucket binding not configured' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) {
            return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 });
        }

        const r2 = createR2Client({ bucket: env.OBCF_R2 });
        const result = await r2.delete(key);

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to delete file', details: result.error.message },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error) {
        console.error('R2 DELETE error:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete file',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
