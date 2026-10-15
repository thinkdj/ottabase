import { errorResponse } from '@ottabase/utils/http-errors';
import type { GateAnswer, GateReason } from './types';

const REASON_MESSAGES: Record<GateReason, string> = {
    OK: 'Allowed',
    FEATURE_NOT_IN_PLAN: 'This feature is not included in your plan',
    LIMIT_REACHED: 'You have reached the limit for your plan',
    NO_SUBJECT: 'Sign in to use this feature',
};

/**
 * A closed gate as a response. 402 PAYMENT REQUIRED for anything an upgrade would fix, so a
 * client can tell "upgrade" from "forbidden" without string-matching; 401 when there is no
 * subject at all. The body carries what a UI needs to render the upsell: plan, which feature
 * or limit, the ceiling, where to go. None of it is sensitive: it is the caller's own plan.
 */
export function gateDeniedResponse(answer: GateAnswer, subject: { feature?: string; limit?: string }): Response {
    if (answer.reason === 'NO_SUBJECT') {
        return errorResponse(REASON_MESSAGES.NO_SUBJECT, 401, { code: 'UNAUTHORIZED' });
    }
    return errorResponse(REASON_MESSAGES[answer.reason], 402, {
        code: 'UPGRADE_REQUIRED',
        hint: answer.upgradeHref ? `Upgrade your plan: ${answer.upgradeHref}` : undefined,
        metadata: {
            plan: answer.plan,
            reason: answer.reason,
            ...(subject.feature ? { feature: subject.feature } : {}),
            ...(subject.limit ? { limitKey: subject.limit } : {}),
            ...(answer.limit !== undefined ? { limit: answer.limit } : {}),
            ...(answer.upgradeHref ? { upgradeHref: answer.upgradeHref } : {}),
        },
    });
}
