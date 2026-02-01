/**
 * Authentication handlers - Auth config, registration, and Auth.js delegation
 */

import { handleAuthRequest } from '@ottabase/auth/backend';
import { getLoginConfig } from '@ottabase/auth/components';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { User, registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { processReferralAttribution } from '../../ottabase/helpers/referral-attribution';
import { applyCorsHeaders } from '../middleware/cors';
import { readJson } from '../utils/request';

export function handleAuthConfig(env: CloudflareEnv, origin: string): Response {
    const config = getLoginConfig(env as any);
    const response = jsonResponse(
        {
            ...config,
            authSecretConfigured: !!env.AUTH_SECRET,
        },
        200,
    );
    return applyCorsHeaders(response, origin);
}

export async function handleRegistration(request: Request, env: CloudflareEnv): Promise<Response> {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{
        email?: string;
        password?: string;
        name?: string;
        referralCode?: string;
    }>(request);

    if (!body.email || !body.password) {
        return errorResponse('email and password are required', 400);
    }

    try {
        // TODO: In production, you would:
        // 1. Hash the password
        // 2. Validate email uniqueness
        // 3. Create user in database
        // 4. Send verification email

        // For demo purposes, create a mock user
        const newUser = await User.create({
            email: body.email,
            name: body.name,
            emailVerified: null,
        });

        const newUserId = newUser.get('id');

        // Process referral attribution if referralCode provided
        let attributionResult;
        if (body.referralCode) {
            attributionResult = await processReferralAttribution({
                newUserId,
                referralCode: body.referralCode,
            });
        }

        return jsonResponse({
            success: true,
            user: newUser.toJson(),
            referralAttribution: attributionResult || null,
        });
    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse(error instanceof Error ? error.message : 'Registration failed', 500);
    }
}

export async function handleAuthRoutes(request: Request, env: CloudflareEnv, origin: string): Promise<Response> {
    const response = await handleAuthRequest(request, env as any);
    return applyCorsHeaders(response, origin);
}
