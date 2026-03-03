// ============================================================
// Resume Sharing Routes (ResumeMe)
// ============================================================
// POST/PATCH /api/resume/share   — create share link / toggle sharing for a saved resume
// GET  /api/resume/share?resumeId=123 — fetch share state (auth required)
// GET  /api/resume/public/:id    — fetch public snapshot by resume ID (no auth)
// GET  /api/resume/public/code/:code — fetch public snapshot by short code (no auth)
// ============================================================

import { getSession } from '@ottabase/auth/backend';
import { Shortlink } from '@ottabase/shortlinks';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { ResumeSaved } from '../../ottabase/models/ResumeSaved';
import { getAuthOptions } from '../lib/auth-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

/** Generate a random 8-character alphanumeric short code. */
function generateShortCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => chars[b % 36]).join('');
}

function extractResumeIdFromShortlink(shortlink: InstanceType<typeof Shortlink>): string | null {
    const linkUrl = shortlink.get('fullUrl') as string;
    try {
        const parsed = new URL(linkUrl);
        return parsed.searchParams.get('resumeId');
    } catch {
        return null;
    }
}

/**
 * POST/PATCH/GET /api/resume/share
 * Creates or fetches a shortlink pointing to the public resume viewer, and
 * allows toggling shareEnabled on the saved resume.
 * The resumeId is embedded in the fullUrl as a query parameter so it can
 * be resolved later via `handleResumePublicByCode`.
 * Requires authentication.
 */
export async function handleResumeShare(context: ApiRouteContext): Promise<Response> {
    const { request, env, method, url } = context;

    const session = await getSession(request, env as any, getAuthOptions(env));
    if (!session?.user?.id) {
        return errorResponse('Unauthorised', 401, { code: 'UNAUTHORISED' });
    }

    const body = method === 'GET' ? null : await readJson<{ resumeId?: string; shareEnabled?: boolean }>(request);
    const resumeId = body?.resumeId || url.searchParams.get('resumeId');
    if (!resumeId) {
        return errorResponse('resumeId is required', 400, { code: 'VALIDATION_ERROR' });
    }

    const resume = await ResumeSaved.find(resumeId);
    if (!resume) {
        return errorResponse('Resume not found', 404, { code: 'NOT_FOUND' });
    }

    // Only the owner may share their resume
    if (resume.get('userId') !== session.user.id) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    // Reuse existing shortlink for this resume if one already exists (one-per-resume invariant)
    const existingLinks = await Shortlink.where({ appId: 'resumeme', type: 'internal' });
    const existingForResume = existingLinks.find((link) => extractResumeIdFromShortlink(link) === resumeId);

    // Generate a unique short code with collision detection (only if no existing link)
    let shortCode = existingForResume?.get('shortCode') as string | undefined;
    if (!shortCode) {
        shortCode = generateShortCode();
        let retries = 3;
        while (retries > 0) {
            const existing = await Shortlink.findByCode(shortCode);
            if (!existing) break;
            shortCode = generateShortCode();
            retries--;
        }
    }

    const origin = new URL(request.url).origin;
    // Embed resumeId in the URL so the reverse lookup (code → resume) works
    const fullUrl = `${origin}/r/${shortCode}?resumeId=${encodeURIComponent(resumeId)}`;

    try {
        const shortlink =
            existingForResume ||
            (await Shortlink.create({
                fullUrl,
                shortCode,
                type: 'internal',
                appId: 'resumeme',
            }));

        // PATCH can toggle shareEnabled
        if (method === 'PATCH') {
            const enabled = body?.shareEnabled;
            if (enabled !== undefined) {
                resume.set('shareEnabled', Boolean(enabled));
                await resume.save();
            }
        }

        // GET returns share state without altering anything
        if (method === 'GET') {
            return jsonResponse({
                success: true,
                data: {
                    shareEnabled: Boolean(resume.get('shareEnabled')),
                    shareUrl: `${origin}/r/${shortCode}`,
                },
            });
        }

        return jsonResponse({
            success: true,
            data: {
                ...shortlink.toJson(),
                resumeId,
                shareEnabled: Boolean(resume.get('shareEnabled')),
                shareUrl: `${origin}/r/${shortCode}`,
            },
        });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to create share link', 500, {
            code: 'INTERNAL_ERROR',
        });
    }
}

/** Returns the public-safe subset of a ResumeSaved record. */
function buildPublicPayload(resume: InstanceType<typeof ResumeSaved>) {
    return {
        id: resume.get('id'),
        name: resume.get('name'),
        templateId: resume.get('templateId'),
        accentColor: resume.get('accentColor'),
        fontSize: resume.get('fontSize'),
        sectionOrder: resume.get('sectionOrder'),
        headingLabels: resume.get('headingLabels'),
        snapshotData: resume.get('snapshotData'),
    };
}

/**
 * GET /api/resume/public/:id
 * Returns the public snapshot for a saved resume. No auth required.
 */
export async function handleResumePublic(_context: ApiRouteContext, resumeId: string): Promise<Response> {
    const resume = await ResumeSaved.find(resumeId);
    if (!resume) {
        return errorResponse('Resume not found', 404, { code: 'NOT_FOUND' });
    }

    if (!resume.get('shareEnabled')) {
        return errorResponse('Sharing disabled by owner', 403, { code: 'SHARE_DISABLED' });
    }

    return jsonResponse({ success: true, data: buildPublicPayload(resume) });
}

/**
 * GET /api/resume/public/code/:code
 * Resolves a short code → resume ID (from fullUrl query param) → public snapshot.
 * No auth required.
 */
export async function handleResumePublicByCode(_context: ApiRouteContext, code: string): Promise<Response> {
    const shortlink = await Shortlink.findByCode(code);
    if (!shortlink) {
        return errorResponse('Share link not found', 404, { code: 'NOT_FOUND' });
    }

    // Extract the resumeId query parameter embedded in the fullUrl by handleResumeShare
    const linkUrl = shortlink.get('fullUrl') as string;
    let resumeId: string | null = null;
    try {
        const parsed = new URL(linkUrl);
        resumeId = parsed.searchParams.get('resumeId');
    } catch {
        // Malformed URL — fall through to error
    }

    if (!resumeId) {
        return errorResponse('Unable to resolve resume from share link', 404, { code: 'NOT_FOUND' });
    }

    const resume = await ResumeSaved.find(resumeId);
    if (!resume) {
        return errorResponse('Resume not found', 404, { code: 'NOT_FOUND' });
    }

    if (!resume.get('shareEnabled')) {
        return errorResponse('Sharing disabled by owner', 403, { code: 'SHARE_DISABLED' });
    }

    return jsonResponse({ success: true, data: buildPublicPayload(resume) });
}
