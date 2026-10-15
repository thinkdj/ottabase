// AI providers (BYOK): the credentials table, model and policy from the package; this app
// adds the routes. Credential CRUD is deliberately NOT exposed through /api/ottaorm: the model
// is absent from the generic CRUD allowlist, and these handlers come from the package's route
// factory, which owns tenancy stamping, the authorize hook, and the filter/sort deny-list on
// the secret-union columns.
import { createOttaaiPackage } from '@ottabase/ottaai/manifest';
import { Router } from '@ottabase/ottarouter';
import { ctxOf, h } from '../../worker/lib/api-context';
import {
    handleAiComplete,
    handleAiCredentialsActivate,
    handleAiCredentialsCreate,
    handleAiCredentialsDelete,
    handleAiCredentialsList,
    handleAiCredentialsTest,
    handleAiCredentialsUpdate,
    handleAiEmbed,
    handleAiExplain,
    handleAiProviders,
    handleAiStatus,
    handleAiVision,
} from '../../worker/routes/ai';
import ottabaseConfig from '../ottabase.config';

export const ottaaiPackage = createOttaaiPackage<CloudflareEnv>({
    // Structural, so read from the config FILE: the strategy shapes the credentials RLS policy.
    strategy: ottabaseConfig.features.ottaai.strategy,
    routes: {
        basePath: '/api/ai',
        build: () =>
            new Router<CloudflareEnv>()
                .get('/status', h(handleAiStatus))
                .get('/providers', h(handleAiProviders))
                .get('/explain', h(handleAiExplain))
                .get('/credentials', h(handleAiCredentialsList))
                .post('/credentials', h(handleAiCredentialsCreate))
                // Static beats :param in this router, so /credentials/test cannot be shadowed by :id.
                .post('/credentials/test', h(handleAiCredentialsTest))
                .post('/credentials/:id/activate', (c) => handleAiCredentialsActivate(ctxOf(c), c.params.id))
                .patch('/credentials/:id', (c) => handleAiCredentialsUpdate(ctxOf(c), c.params.id))
                .delete('/credentials/:id', (c) => handleAiCredentialsDelete(ctxOf(c), c.params.id))
                // Registered with the RAW `Ctx`, not `h(...)`: the inference path needs a real
                // `waitUntil` or the credential-health and attribution writes it defers are
                // cancelled at response. Silent data loss, and the one thing the `defer` seam prevents.
                .post('/complete', (c) => handleAiComplete(ctxOf(c), (promise) => c.ctx.waitUntil(promise)))
                .post('/vision', (c) => handleAiVision(ctxOf(c), (promise) => c.ctx.waitUntil(promise)))
                .post('/embed', (c) => handleAiEmbed(ctxOf(c), (promise) => c.ctx.waitUntil(promise))),
    },
    env: { optional: ['OBCF_AI', 'CFAI_GATEWAY_NAME', 'OTTAAI_MASTER_KEY'] },
});
