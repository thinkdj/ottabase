import { Router, type RouterMiddleware } from '@ottabase/framework';
import type { ApiRouteContext } from './router';
import {
    handleAuthConfig,
    handlePasswordResetConfirm,
    handlePasswordResetRequest,
    handleVerifyEmail,
    handleVerifyEmailResend,
} from './auth';

const router = new Router<ApiRouteContext>();

const corsMiddleware: RouterMiddleware<ApiRouteContext> = async (context, next) => {
    const response = await next();
    return response ? context.withAuthCors(response) : null;
};

router.group({ prefix: '/api/auth', middleware: [corsMiddleware] }, (group) => {
    group.get('/config', handleAuthConfig);
    group.get('/verify-email', handleVerifyEmail);
    group.post('/verify-email/resend', handleVerifyEmailResend);
    group.post('/password/reset/request', handlePasswordResetRequest);
    group.post('/password/reset/confirm', handlePasswordResetConfirm);
});

export default router;
