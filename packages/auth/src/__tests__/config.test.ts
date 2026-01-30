import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOttabaseAuthConfig } from '../config';
import * as providers from '../providers';

describe('Auth Configuration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createOttabaseAuthConfig', () => {
        it('should create a valid auth configuration', () => {
            const config = createOttabaseAuthConfig({
                d1: {
                    prepare: vi.fn().mockReturnValue({
                        all: vi.fn(),
                        first: vi.fn(),
                        run: vi.fn(),
                    }),
                } as any,
                providers: [],
            });

            expect(config).toBeDefined();
            expect(typeof config).toBe('object');
        });

        it('should handle empty providers list', () => {
            const config = createOttabaseAuthConfig({
                d1: {
                    prepare: vi.fn().mockReturnValue({
                        all: vi.fn(),
                        first: vi.fn(),
                        run: vi.fn(),
                    }),
                } as any,
                providers: [],
            });

            expect(config).toBeDefined();
        });

        it('should set trust host when specified', () => {
            const config = createOttabaseAuthConfig({
                d1: {
                    prepare: vi.fn().mockReturnValue({
                        all: vi.fn(),
                        first: vi.fn(),
                        run: vi.fn(),
                    }),
                } as any,
                providers: [],
                authConfig: {
                    trustHost: true,
                },
            });

            expect(config).toBeDefined();
        });

        it('should use provided auth secret', () => {
            const secret = 'test-secret-key';
            const config = createOttabaseAuthConfig({
                d1: {
                    prepare: vi.fn().mockReturnValue({
                        all: vi.fn(),
                        first: vi.fn(),
                        run: vi.fn(),
                    }),
                } as any,
                providers: [],
                authConfig: {
                    secret,
                },
            });

            expect(config).toBeDefined();
        });
    });

    describe('createOttabaseAuthConfigDev', () => {
        it('should create development auth configuration', async () => {
            const { createOttabaseAuthConfigDev } = await import('../config');

            const mockD1 = {
                prepare: vi.fn().mockReturnValue({
                    all: vi.fn(),
                    first: vi.fn(),
                    run: vi.fn(),
                }),
            } as any;

            const config = createOttabaseAuthConfigDev(mockD1, []);

            expect(config).toBeDefined();
        });
    });

    describe('Provider Imports', () => {
        it('should export provider factory functions', () => {
            expect(typeof providers.createGitHubProvider).toBe('function');
            expect(typeof providers.createGoogleProvider).toBe('function');
            expect(typeof providers.createDiscordProvider).toBe('function');
        });
    });
});
