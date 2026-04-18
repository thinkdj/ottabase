import { errorResponse } from '@ottabase/utils/http-errors';

const LOCKDOWN_HTML =
    '<!doctype html><html><head><meta charset="utf-8"><title>LOCKDOWN</title></head><body style="font-family:system-ui;padding:2rem;text-align:center;">LOCKDOWN ENFORCED</body></html>';

export function isTrue(value: any): boolean {
    const v = String(value ?? '').toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
}

export function getKillSwitchStatus(env: Record<string, any>) {
    return {
        readonly: isTrue(env.KILLSWITCH_READONLY_MODE),
        lockdown: isTrue(env.KILLSWITCH_LOCKDOWN),
    };
}

export function checkKillSwitches(request: Request, env: Record<string, any>): Response | null {
    const { readonly, lockdown } = getKillSwitchStatus(env);
    if (lockdown) {
        return new Response(LOCKDOWN_HTML, {
            status: 503,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    }

    if (readonly) {
        const method = request.method.toUpperCase();
        if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
            return errorResponse('Read-only mode is enabled', 503, {
                code: 'READONLY_MODE',
            });
        }
    }

    return null;
}
