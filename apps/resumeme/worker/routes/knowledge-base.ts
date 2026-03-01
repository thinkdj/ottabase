// ============================================================
// Knowledge Base API Routes (ResumeMe)
// ============================================================
// GET    /api/kb                      — list user's knowledge bases
// POST   /api/kb                      — create a knowledge base
// GET    /api/kb/:id                  — get KB detail with file count
// PATCH  /api/kb/:id                  — update KB fields
// DELETE /api/kb/:id                  — delete KB and all its files
// GET    /api/kb/:id/files            — list files for a KB
// POST   /api/kb/:id/files            — upload file to KB
// DELETE /api/kb/:id/files/:fileId    — delete a single file
// POST   /api/kb/:id/analyse          — AI-powered job match analysis
// ============================================================

import { getSession } from '@ottabase/auth/backend';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import type { CloudflareEnv } from '../../cloudflare-env';
import { KnowledgeBase } from '../../ottabase/models/KnowledgeBase';
import { KnowledgeBaseFile } from '../../ottabase/models/KnowledgeBaseFile';
import { ResumeProfile } from '../../ottabase/models/ResumeProfile';
import { ResumeSkillSet } from '../../ottabase/models/ResumeSkillSet';
import { ResumeWorkExperience } from '../../ottabase/models/ResumeWorkExperience';
import { getAuthOptions } from '../lib/auth-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

// ── Constants ────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'md', 'docx', 'png', 'jpg', 'jpeg']);

const TEXT_EXTENSIONS = new Set(['txt', 'md']);

// ── Auth helper ──────────────────────────────────────────────

async function requireAuth(request: Request, env: CloudflareEnv): Promise<string | Response> {
    const session = await getSession(request, env as any, getAuthOptions(env));
    if (!session?.user?.id) {
        return errorResponse('Unauthorised', 401, { code: 'UNAUTHORISED' });
    }
    return session.user.id;
}

// ── Handlers ─────────────────────────────────────────────────

/** GET /api/kb — paginated list of user's knowledge bases */
export async function handleKnowledgeBaseList(context: ApiRouteContext): Promise<Response> {
    const { request, env, url } = context;

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const { page, perPage, orderBy, order } = parsePaginationParams(url.searchParams);

    const result = await KnowledgeBase.paginate(page, perPage, { userId }, { orderBy, orderDirection: order });

    return paginatedJsonResponse({
        data: result.data.map((kb) => kb.toJson()),
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        path: '/api/kb',
    });
}

/** POST /api/kb — create a new knowledge base */
export async function handleKnowledgeBaseCreate(context: ApiRouteContext): Promise<Response> {
    const { request, env } = context;

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const body = await readJson<{
        name?: string;
        description?: string;
        targetRole?: string;
        targetCompany?: string;
    }>(request);

    if (!body.name) {
        return errorResponse('name is required', 400, { code: 'VALIDATION_ERROR' });
    }

    try {
        const kb = await KnowledgeBase.create({
            userId,
            name: body.name,
            description: body.description ?? null,
            targetRole: body.targetRole ?? null,
            targetCompany: body.targetCompany ?? null,
        });

        return jsonResponse({ success: true, data: kb.toJson() }, 201);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to create knowledge base', 500, {
            code: 'INTERNAL_ERROR',
        });
    }
}

/** GET/PATCH/DELETE /api/kb/:id */
export async function handleKnowledgeBaseById(context: ApiRouteContext, id: string): Promise<Response> {
    const { request, env, method } = context;

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const kb = await KnowledgeBase.find(id);
    if (!kb) {
        return errorResponse('Knowledge base not found', 404, { code: 'NOT_FOUND' });
    }
    if (kb.get('userId') !== userId) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    // ── GET ──
    if (method === 'GET') {
        const files = await KnowledgeBaseFile.forKnowledgeBase(id);
        return jsonResponse({
            success: true,
            data: { ...kb.toJson(), fileCount: files.length },
        });
    }

    // ── PATCH ──
    if (method === 'PATCH') {
        const body = await readJson<{
            name?: string;
            description?: string;
            targetRole?: string;
            targetCompany?: string;
            status?: string;
        }>(request);

        const updatable = ['name', 'description', 'targetRole', 'targetCompany', 'status'] as const;
        for (const field of updatable) {
            if (body[field] !== undefined) {
                kb.set(field, body[field]);
            }
        }

        try {
            await kb.save();
            return jsonResponse({ success: true, data: kb.toJson() });
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to update knowledge base', 500, {
                code: 'INTERNAL_ERROR',
            });
        }
    }

    // ── DELETE ──
    if (method === 'DELETE') {
        try {
            // Delete all files from R2 and DB
            const files = await KnowledgeBaseFile.forKnowledgeBase(id);
            for (const file of files) {
                const r2Key = file.get('r2Key') as string | null;
                if (r2Key && env.OBCF_R2) {
                    await env.OBCF_R2.delete(r2Key);
                }
                await file.destroy();
            }
            await kb.destroy();
            return jsonResponse({ success: true, message: 'Knowledge base deleted' });
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to delete knowledge base', 500, {
                code: 'INTERNAL_ERROR',
            });
        }
    }

    return errorResponse('Method not allowed', 405, { code: 'METHOD_NOT_ALLOWED' });
}

/** GET /api/kb/:id/files — list files for a KB */
export async function handleKnowledgeBaseFiles(context: ApiRouteContext, kbId: string): Promise<Response> {
    const { request, env } = context;

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const kb = await KnowledgeBase.find(kbId);
    if (!kb) {
        return errorResponse('Knowledge base not found', 404, { code: 'NOT_FOUND' });
    }
    if (kb.get('userId') !== userId) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const files = await KnowledgeBaseFile.forKnowledgeBase(kbId);
    return jsonResponse({
        success: true,
        data: files.map((f) => f.toJson()),
    });
}

/** POST /api/kb/:id/files — upload file to KB */
export async function handleKnowledgeBaseFileUpload(context: ApiRouteContext, kbId: string): Promise<Response> {
    const { request, env } = context;

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const kb = await KnowledgeBase.find(kbId);
    if (!kb) {
        return errorResponse('Knowledge base not found', 404, { code: 'NOT_FOUND' });
    }
    if (kb.get('userId') !== userId) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    if (!env.OBCF_R2) {
        return errorResponse('File storage is not configured', 503, { code: 'STORAGE_UNAVAILABLE' });
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return errorResponse('Invalid multipart form data', 400, { code: 'VALIDATION_ERROR' });
    }

    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
        return errorResponse('file is required', 400, { code: 'VALIDATION_ERROR' });
    }

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return errorResponse(`Unsupported file type: .${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`, 400, {
            code: 'VALIDATION_ERROR',
        });
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
        return errorResponse(`File too large. Maximum size is 10 MB.`, 400, { code: 'VALIDATION_ERROR' });
    }

    // Determine file type category
    const fileType = TEXT_EXTENSIONS.has(ext) ? ext : ['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : ext;

    // Generate file ID and R2 key
    const fileId = crypto.randomUUID();
    const r2Key = `kb/${userId}/${kbId}/${fileId}/${file.name}`;

    try {
        // Read file content once as ArrayBuffer for both R2 upload and text extraction
        const fileBuffer = await file.arrayBuffer();

        // Upload to R2
        await env.OBCF_R2.put(r2Key, fileBuffer, {
            httpMetadata: { contentType: file.type },
            customMetadata: { originalName: file.name, kbId, userId },
        });

        // Extract text content for text files
        let extractedText: string | null = null;
        let status = 'uploaded';
        if (TEXT_EXTENSIONS.has(ext)) {
            extractedText = new TextDecoder().decode(fileBuffer);
            status = 'processed';
        }

        // Create DB record
        const kbFile = await KnowledgeBaseFile.create({
            id: fileId,
            userId,
            knowledgeBaseId: kbId,
            fileName: file.name,
            fileType,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            r2Key,
            extractedText,
            status,
        });

        return jsonResponse({ success: true, data: kbFile.toJson() }, 201);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to upload file', 500, {
            code: 'INTERNAL_ERROR',
        });
    }
}

/** DELETE /api/kb/:id/files/:fileId — delete a file */
export async function handleKnowledgeBaseFileDelete(
    context: ApiRouteContext,
    kbId: string,
    fileId: string,
): Promise<Response> {
    const { request, env } = context;

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const file = await KnowledgeBaseFile.find(fileId);
    if (!file) {
        return errorResponse('File not found', 404, { code: 'NOT_FOUND' });
    }
    if (file.get('userId') !== userId || file.get('knowledgeBaseId') !== kbId) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    try {
        const r2Key = file.get('r2Key') as string | null;
        if (r2Key && env.OBCF_R2) {
            await env.OBCF_R2.delete(r2Key);
        }
        await file.destroy();
        return jsonResponse({ success: true, message: 'File deleted' });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to delete file', 500, {
            code: 'INTERNAL_ERROR',
        });
    }
}

/** POST /api/kb/:id/analyse — AI-powered job match analysis */
export async function handleKnowledgeBaseAnalyse(context: ApiRouteContext, kbId: string): Promise<Response> {
    const { request, env } = context;

    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const kb = await KnowledgeBase.find(kbId);
    if (!kb) {
        return errorResponse('Knowledge base not found', 404, { code: 'NOT_FOUND' });
    }
    if (kb.get('userId') !== userId) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    if (!env.OBCF_AI) {
        return errorResponse('AI service is not configured', 503, { code: 'AI_UNAVAILABLE' });
    }

    // Gather all context in parallel
    const [profile, skillSets, workExperiences, files] = await Promise.all([
        ResumeProfile.forUser(userId),
        ResumeSkillSet.forUser(userId),
        ResumeWorkExperience.forUser(userId),
        KnowledgeBaseFile.forKnowledgeBase(kbId),
    ]);

    // Build candidate profile section
    const headline = profile ? (profile.get('headline') as string) || '' : '';
    const summary = profile ? (profile.get('summary') as string) || '' : '';

    // Build skills section
    const skillsText = skillSets.length
        ? skillSets
              .map((s) => {
                  const name = s.get('name') as string;
                  const skills = s.getSkills();
                  return `${name}: ${skills.join(', ')}`;
              })
              .join('\n')
        : 'No skills listed';

    // Build work experience section
    const workText = workExperiences.length
        ? workExperiences
              .map((w) => {
                  const company = w.get('company') as string;
                  const designation = w.get('designation') as string;
                  const start = (w.get('startDate') as string) || '';
                  const end = w.get('isCurrent') ? 'Present' : (w.get('endDate') as string) || '';
                  const desc = (w.get('description') as string) || '';
                  const highlights = w.getHighlights();
                  const highlightsText = highlights.length ? `\n  Highlights: ${highlights.join('; ')}` : '';
                  return `${designation} at ${company} (${start} – ${end})${desc ? `\n  ${desc}` : ''}${highlightsText}`;
              })
              .join('\n\n')
        : 'No work experience listed';

    // Collect extracted text from KB files
    const fileTexts = files
        .map((f) => f.get('extractedText') as string | null)
        .filter(Boolean)
        .join('\n\n---\n\n');

    if (!fileTexts) {
        return errorResponse(
            'No extracted text found in knowledge base files. Upload text or markdown files first.',
            400,
            { code: 'NO_CONTENT' },
        );
    }

    const targetRole = (kb.get('targetRole') as string) || 'Not specified';
    const targetCompany = (kb.get('targetCompany') as string) || 'Not specified';

    const systemPrompt = `You are an expert career coach and resume analyst. Analyse the following candidate data against a job description and provide a structured assessment. Always respond with valid JSON only, no markdown fences or extra text.`;

    const userPrompt = `## Candidate Profile
Headline: ${headline}
Summary: ${summary}

## Skills
${skillsText}

## Work Experience
${workText}

## Target Position
Role: ${targetRole}
Company: ${targetCompany}

## Job Description & Context
${fileTexts}

Provide your analysis in the following JSON format:
{
  "matchScore": <number 0-100>,
  "summary": "<Brief overall assessment>",
  "skillMatches": [{ "skill": "...", "relevance": "high|medium|low", "note": "..." }],
  "skillGaps": [{ "skill": "...", "importance": "critical|important|nice-to-have", "suggestion": "..." }],
  "resumeImprovements": [{ "section": "...", "suggestion": "...", "priority": "high|medium|low" }],
  "talkingPoints": ["...", "..."],
  "interviewTips": ["...", "..."]
}`;

    try {
        const aiResponse = (await env.OBCF_AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 2048,
        })) as { response?: string };

        const rawText = aiResponse?.response ?? '';

        // Attempt to parse AI response as JSON
        let analysis: unknown;
        try {
            analysis = JSON.parse(rawText);
        } catch {
            // If the AI returned non-JSON, wrap it
            analysis = { rawResponse: rawText, matchScore: 0, summary: 'Analysis could not be parsed as JSON.' };
        }

        // Persist analysis to the KB
        kb.setAnalysisResult(analysis);
        await kb.save();

        return jsonResponse({ success: true, data: analysis });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'AI analysis failed', 500, {
            code: 'AI_ERROR',
        });
    }
}
