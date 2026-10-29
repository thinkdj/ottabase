/**
 * `GET /api/admin/system/readiness` (platform admins only): every declared env key and binding
 * with its package, kind and description, whether it is set (never a secret's value), every
 * package health probe under a 3 s timeout, and the app facts the overview shows.
 */
import { readDeploymentVersion, runReadiness } from '@ottabase/kernel';
import { isPremiumPackage } from '@ottabase/premium';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { packages } from '../../ottabase/registry';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

export async function handleAdminSystemReadiness(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;
    const { env } = context;
    try {
        const report = await runReadiness(packages, env, { probeTimeoutMs: 3000 });
        const installed = packages.packages.map((pkg) => ({
            key: pkg.key,
            name: pkg.name,
            version: pkg.version,
            premium: isPremiumPackage(pkg),
        }));
        return jsonResponse(
            {
                ...report,
                app: {
                    appId: getOttabaseConfig(env).appId,
                    environment: env.ENVIRONMENT || 'development',
                    version: readDeploymentVersion(env.OBCF_VERSION),
                    packages: installed,
                    premiumInstalled: installed.some((pkg) => pkg.premium),
                },
                timestamp: Date.now(),
            },
            200,
            { headers: { 'Cache-Control': 'private, no-store' } },
        );
    } catch (error) {
        console.error(JSON.stringify({ event: 'admin.system.readiness', error: redactErrorForLog(error) }));
        return errorResponse('Failed to compute readiness', 500, { code: 'READINESS_FAILED' });
    }
}
