import { describe, expect, it } from 'vitest';
import { Router } from '../index';

type TestContext = {
    route: string;
    method: string;
    steps: string[];
};

describe('Router', () => {
    it('matches grouped routes and passes params', async () => {
        const router = new Router<TestContext>();

        router.group(
            {
                prefix: '/api',
                middleware: [
                    async (context, next) => {
                        context.steps.push('middleware-1');
                        return next();
                    },
                    async (context, next) => {
                        context.steps.push('middleware-2');
                        return next();
                    },
                ],
            },
            (group) => {
                group.get('/posts/:id', (context) => {
                    context.steps.push(`handler:${context.params.id}`);
                    return new Response('ok');
                });
            },
        );

        const context: TestContext = { route: '/api/posts/42', method: 'GET', steps: [] };
        const response = await router.handle(context);

        expect(response?.status).toBe(200);
        expect(await response?.text()).toBe('ok');
        expect(context.steps).toEqual(['middleware-1', 'middleware-2', 'handler:42']);
    });

    it('allows middleware to short-circuit', async () => {
        const router = new Router<TestContext>();

        router.group(
            {
                prefix: '/api',
                middleware: [
                    async (context) => {
                        context.steps.push('blocked');
                        return new Response('blocked', { status: 401 });
                    },
                ],
            },
            (group) => {
                group.get('/secure', (context) => {
                    context.steps.push('handler');
                    return new Response('ok');
                });
            },
        );

        const context: TestContext = { route: '/api/secure', method: 'GET', steps: [] };
        const response = await router.handle(context);

        expect(response?.status).toBe(401);
        expect(context.steps).toEqual(['blocked']);
    });

    it('returns null when no route matches', async () => {
        const router = new Router<TestContext>();
        const response = await router.handle({ route: '/missing', method: 'GET', steps: [] });
        expect(response).toBeNull();
    });

    it('supports nested groups with wildcard all-method routes', async () => {
        const router = new Router<TestContext>();

        router.group({ prefix: '/api' }, (group) => {
            group.group({ prefix: '/files' }, (nested) => {
                nested.all('/*', (context) => {
                    context.steps.push(context.params.wildcard);
                    return new Response(context.params.wildcard);
                });
            });
        });

        const context: TestContext = {
            route: '/api/files/some%20file.txt',
            method: 'POST',
            steps: [],
        };
        const response = await router.handle(context);

        expect(response?.status).toBe(200);
        expect(await response?.text()).toBe('some file.txt');
        expect(context.steps).toEqual(['some file.txt']);
    });
});
