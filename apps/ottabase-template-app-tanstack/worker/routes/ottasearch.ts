import {
    collectDocumentText,
    ensureFtsTable,
    mergeHybridResults,
    OTTASEARCH_FTS_TABLE,
    parseJsonStringArray,
} from '@ottabase/ottasearch';
import { getAllModelsMetadata } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

const DEFAULT_SEARCH_FIELDS = ['title', 'name', 'label', 'description', 'content', 'body', 'summary', 'slug'];
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

function getModelMetadata() {
    return Array.from(getAllModelsMetadata().entries()).map(([entityName, entry]) => ({
        entityName,
        modelName: entry.metadata.modelName,
        tableName: entry.metadata.tableName,
        model: entry.model,
    }));
}

function buildSpotlightHref(entityName: string, recordId: string, row: Record<string, unknown>): string {
    if (entityName === 'posts') {
        const slug = typeof row.slug === 'string' ? row.slug : recordId;
        return `/blog/${slug}`;
    }
    if (entityName === 'shortlinks') return '/shortlinks';
    if (entityName === 'users') return '/admin/users';
    if (entityName.startsWith('referral')) return '/admin/referrals';
    return `/admin/db?table=${encodeURIComponent(entityName)}`;
}

async function tableExists(context: ApiRouteContext, tableName: string): Promise<boolean> {
    const row = await context.env.OBCF_D1?.prepare(
        `SELECT 1 as ok FROM sqlite_schema WHERE type='table' AND name = ? LIMIT 1`,
    )
        .bind(tableName)
        .first<{ ok: number }>();
    return Boolean(row?.ok);
}

async function getVectorEmbedding(context: ApiRouteContext, text: string): Promise<number[] | null> {
    const ai = (context.env as { OBCF_AI?: { run?: (model: string, payload: unknown) => Promise<unknown> } }).OBCF_AI;
    if (!ai?.run) return null;

    try {
        const response = await ai.run(EMBEDDING_MODEL, { text: [text] });
        const vector =
            (response as { data?: unknown[] } | null)?.data?.[0] ??
            (response as { result?: { data?: unknown[] } } | null)?.result?.data?.[0];
        if (Array.isArray(vector) && vector.every((v) => typeof v === 'number')) {
            return vector;
        }
    } catch {
        return null;
    }

    return null;
}

export async function handleOttaSearchStatus(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    const ftsExists = await env.OBCF_D1.prepare(
        `SELECT 1 as ok FROM sqlite_schema WHERE type='table' AND name = ? LIMIT 1`,
    )
        .bind(OTTASEARCH_FTS_TABLE)
        .first<{ ok: number }>();
    const hasConfigTable = await tableExists(context, 'searchable_models');
    const hasDocumentsTable = await tableExists(context, 'search_documents');
    const docsCount = hasDocumentsTable
        ? await env.OBCF_D1.prepare('SELECT count(*) as total FROM search_documents').first<{ total: number }>()
        : { total: 0 };
    const enabledModels = hasConfigTable
        ? await env.OBCF_D1.prepare('SELECT count(*) as total FROM searchable_models WHERE enabled = 1').first<{
              total: number;
          }>()
        : { total: 0 };

    const hasVectorize = Boolean((env as { OBCF_VECTORIZE?: unknown }).OBCF_VECTORIZE);

    const pending: string[] = [];
    if (!hasConfigTable || !hasDocumentsTable) {
        pending.push('Search tables not initialized. Run /api/ottaorm/init then reindex.');
    }
    if (!ftsExists?.ok) pending.push('FTS index not initialized. Run Reindex once from admin.');
    if (!enabledModels?.total) pending.push('No searchable models enabled. Configure models first.');
    if (!hasVectorize) pending.push('Semantic search unavailable: bind OBCF_VECTORIZE to enable vector ranking.');

    return jsonResponse({
        ftsReady: Boolean(ftsExists?.ok),
        indexedDocuments: docsCount?.total ?? 0,
        enabledModels: enabledModels?.total ?? 0,
        hasVectorize,
        pending,
    });
}

export async function handleOttaSearchConfig(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    if (!context.env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }
    if (!(await tableExists(context, 'searchable_models'))) {
        return jsonResponse({ models: [] });
    }

    const metadata = getModelMetadata();
    const configsResult = await context.env.OBCF_D1.prepare(
        'SELECT entity_name as entityName, enabled, fields_json as fieldsJson, last_indexed_at as lastIndexedAt FROM searchable_models ORDER BY entity_name',
    ).all<{ entityName: string; enabled: number; fieldsJson: string; lastIndexedAt: number | null }>();

    const configsByEntity = new Map<
        string,
        { entityName: string; enabled: number; fields: string[]; lastIndexedAt: number | null }
    >(
        configsResult.results.map(
            (row: { entityName: string; enabled: number; fieldsJson: string; lastIndexedAt: number | null }) => [
                row.entityName,
                {
                    entityName: row.entityName,
                    enabled: row.enabled,
                    fields: parseJsonStringArray(row.fieldsJson),
                    lastIndexedAt: row.lastIndexedAt,
                },
            ],
        ),
    );

    return jsonResponse({
        models: metadata.map((model) => ({
            entityName: model.entityName,
            modelName: model.modelName,
            tableName: model.tableName,
            enabled: Boolean(configsByEntity.get(model.entityName)?.enabled),
            fields: configsByEntity.get(model.entityName)?.fields ?? DEFAULT_SEARCH_FIELDS,
            lastIndexedAt: configsByEntity.get(model.entityName)?.lastIndexedAt ?? null,
        })),
    });
}

export async function handleOttaSearchConfigUpsert(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    if (!context.env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }
    if (!(await tableExists(context, 'searchable_models'))) {
        return errorResponse('searchable_models table not found. Run /api/ottaorm/init first.', 400, {
            code: 'SETUP_REQUIRED',
        });
    }

    const body = (await context.request.json().catch(() => null)) as {
        entityName?: string;
        enabled?: boolean;
        fields?: string[];
    } | null;

    const entityName = body?.entityName?.trim();
    if (!entityName) return errorResponse('entityName is required', 400, { code: 'VALIDATION_ERROR' });

    const fields = (body?.fields ?? DEFAULT_SEARCH_FIELDS).filter((field) => typeof field === 'string' && field.trim());
    const enabled = body?.enabled !== false;
    const now = Date.now();

    await context.env.OBCF_D1.prepare(
        `INSERT INTO searchable_models(entity_name, enabled, fields_json, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(entity_name) DO UPDATE SET enabled = excluded.enabled, fields_json = excluded.fields_json, updated_at = excluded.updated_at`,
    )
        .bind(entityName, enabled ? 1 : 0, JSON.stringify(fields), now, now)
        .run();

    return jsonResponse({ success: true, entityName, enabled, fields });
}

export async function handleOttaSearchReindex(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    await ensureFtsTable(env.OBCF_D1);
    if (!(await tableExists(context, 'searchable_models')) || !(await tableExists(context, 'search_documents'))) {
        return errorResponse('Search tables not found. Run /api/ottaorm/init first.', 400, { code: 'SETUP_REQUIRED' });
    }

    const body = (await context.request.json().catch(() => ({}))) as { entityName?: string };
    const targetEntity = body.entityName?.trim();

    const configsResult = await env.OBCF_D1.prepare(
        'SELECT entity_name as entityName, fields_json as fieldsJson FROM searchable_models WHERE enabled = 1',
    ).all<{ entityName: string; fieldsJson: string }>();

    const configs = configsResult.results.filter(
        (row: { entityName: string; fieldsJson: string }) => !targetEntity || row.entityName === targetEntity,
    );
    const metadataByEntity = new Map(getModelMetadata().map((item) => [item.entityName, item]));

    let indexedCount = 0;

    for (const config of configs) {
        const meta = metadataByEntity.get(config.entityName);
        if (!meta) continue;

        const ModelClass = meta.model as {
            all: (options?: { limit?: number }) => Promise<Array<{ toJson: () => Record<string, unknown> }>>;
            primaryKey?: string;
        };

        const rows = await ModelClass.all({ limit: 200 });
        const fields = parseJsonStringArray(config.fieldsJson).length
            ? parseJsonStringArray(config.fieldsJson)
            : DEFAULT_SEARCH_FIELDS;

        const existingIds = await env.OBCF_D1.prepare('SELECT id FROM search_documents WHERE entity_name = ?')
            .bind(config.entityName)
            .all<{ id: string }>();
        for (const row of existingIds.results) {
            await env.OBCF_D1.prepare(`DELETE FROM ${OTTASEARCH_FTS_TABLE} WHERE id = ?`).bind(row.id).run();
        }
        await env.OBCF_D1.prepare('DELETE FROM search_documents WHERE entity_name = ?').bind(config.entityName).run();

        for (const rowModel of rows) {
            const row = rowModel.toJson();
            const primaryKey = ModelClass.primaryKey ?? 'id';
            const recordIdRaw = row[primaryKey] ?? row.id;
            const recordId = recordIdRaw ? String(recordIdRaw) : '';
            if (!recordId) continue;

            const content = collectDocumentText(row, fields);
            if (!content) continue;

            const title =
                (typeof row.title === 'string' && row.title) ||
                (typeof row.name === 'string' && row.name) ||
                (typeof row.label === 'string' && row.label) ||
                `${config.entityName}:${recordId}`;

            const keywords = fields
                .filter((field) => typeof row[field] === 'string')
                .map((field) => String(row[field]));
            const id = `${config.entityName}:${recordId}`;
            const now = Date.now();

            const embedding = await getVectorEmbedding(context, `${title}\n${content.slice(0, 2000)}`);

            await env.OBCF_D1.prepare(
                `INSERT INTO search_documents(id, entity_name, record_id, title, content, keywords_json, embedding_json, created_at, updated_at)
                 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, keywords_json = excluded.keywords_json, embedding_json = excluded.embedding_json, updated_at = excluded.updated_at`,
            )
                .bind(
                    id,
                    config.entityName,
                    recordId,
                    title,
                    content,
                    JSON.stringify(keywords),
                    embedding ? JSON.stringify(embedding) : null,
                    now,
                    now,
                )
                .run();

            await env.OBCF_D1.prepare(`DELETE FROM ${OTTASEARCH_FTS_TABLE} WHERE id = ?`).bind(id).run();
            await env.OBCF_D1.prepare(
                `INSERT INTO ${OTTASEARCH_FTS_TABLE}(id, title, content, keywords) VALUES(?, ?, ?, ?)`,
            )
                .bind(id, title, content, keywords.join(' '))
                .run();

            const vectorize = (
                env as {
                    OBCF_VECTORIZE?: {
                        upsert?: (vectors: Array<{ id: string; values: number[]; metadata: unknown }>) => Promise<void>;
                    };
                }
            ).OBCF_VECTORIZE;
            if (vectorize?.upsert && embedding) {
                await vectorize.upsert([
                    {
                        id,
                        values: embedding,
                        metadata: { entityName: config.entityName, recordId, title },
                    },
                ]);
            }

            indexedCount += 1;
        }

        await env.OBCF_D1.prepare(
            'UPDATE searchable_models SET last_indexed_at = ?, updated_at = ? WHERE entity_name = ?',
        )
            .bind(Date.now(), Date.now(), config.entityName)
            .run();
    }

    return jsonResponse({ success: true, indexedCount, models: configs.length });
}

export async function handleOttaSearchQuery(context: ApiRouteContext): Promise<Response> {
    const { env, url } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    const query = url.searchParams.get('q')?.trim() ?? '';
    if (!query) return jsonResponse({ results: [] });
    if (!(await tableExists(context, 'search_documents'))) {
        return jsonResponse({ results: [] });
    }

    const limit = Math.min(Number(url.searchParams.get('limit') || 10), 25);
    await ensureFtsTable(env.OBCF_D1);

    const ftsResult = await env.OBCF_D1.prepare(
        `SELECT sd.id, sd.entity_name as entityName, sd.record_id as recordId, sd.title, sd.content, sd.keywords_json as keywordsJson,
                (1.0 / (1 + abs(bm25(${OTTASEARCH_FTS_TABLE})))) as score
         FROM ${OTTASEARCH_FTS_TABLE}
         JOIN search_documents sd ON sd.id = ${OTTASEARCH_FTS_TABLE}.id
         WHERE ${OTTASEARCH_FTS_TABLE} MATCH ?
         ORDER BY score DESC
         LIMIT ?`,
    )
        .bind(query, limit)
        .all<{
            id: string;
            entityName: string;
            recordId: string;
            title: string;
            content: string;
            keywordsJson: string;
            score: number;
        }>();

    const ftsDocs = ftsResult.results.map(
        (row: {
            id: string;
            entityName: string;
            recordId: string;
            title: string;
            content: string;
            keywordsJson: string;
            score: number;
        }) => ({
            id: row.id,
            entityName: row.entityName,
            recordId: row.recordId,
            title: row.title,
            content: row.content,
            keywords: parseJsonStringArray(row.keywordsJson),
            score: row.score,
        }),
    );

    let semanticDocs: Array<{
        id: string;
        entityName: string;
        recordId: string;
        title: string;
        content: string;
        keywords: string[];
        score: number;
    }> = [];

    const vectorize = (
        env as {
            OBCF_VECTORIZE?: {
                query?: (
                    vector: number[],
                    options: { topK: number },
                ) => Promise<{ matches?: Array<{ id: string; score: number }> }>;
            };
        }
    ).OBCF_VECTORIZE;

    if (vectorize?.query) {
        const embedding = await getVectorEmbedding(context, query);
        if (embedding) {
            const vectorResult = await vectorize.query(embedding, { topK: limit });
            const vectorMatches = vectorResult.matches ?? [];

            for (const match of vectorMatches) {
                const doc = await env.OBCF_D1.prepare(
                    'SELECT id, entity_name as entityName, record_id as recordId, title, content, keywords_json as keywordsJson FROM search_documents WHERE id = ? LIMIT 1',
                )
                    .bind(match.id)
                    .first<{
                        id: string;
                        entityName: string;
                        recordId: string;
                        title: string;
                        content: string;
                        keywordsJson: string;
                    }>();

                if (doc) {
                    semanticDocs.push({
                        id: doc.id,
                        entityName: doc.entityName,
                        recordId: doc.recordId,
                        title: doc.title,
                        content: doc.content,
                        keywords: parseJsonStringArray(doc.keywordsJson),
                        score: match.score,
                    });
                }
            }
        }
    }

    const merged = mergeHybridResults(ftsDocs, semanticDocs).slice(0, limit);

    return jsonResponse({
        results: merged.map((row) => ({
            id: row.id,
            entityName: row.entityName,
            recordId: row.recordId,
            title: row.title,
            description: row.content.slice(0, 180),
            keywords: row.keywords,
            score: row.score ?? 0,
            href: buildSpotlightHref(row.entityName, row.recordId, row as unknown as Record<string, unknown>),
        })),
    });
}

export async function handleOttaSearchSpotlight(context: ApiRouteContext): Promise<Response> {
    const result = await handleOttaSearchQuery(context);
    const json = (await result.json()) as { results?: Array<Record<string, unknown>> };

    return jsonResponse(
        (json.results ?? []).map((row) => ({
            id: row.id,
            label: row.title,
            description: row.description,
            keywords: row.keywords,
            href: row.href,
        })),
    );
}
