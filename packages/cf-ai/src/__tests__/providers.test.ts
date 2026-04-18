import { describe, it, expect } from 'vitest';
import {
    AI_PROVIDERS,
    buildGatewayBaseUrl,
    buildProviderUrl,
    buildUniversalChatUrl,
    buildAuthHeaders,
    isValidProvider,
    getProvider,
} from '../providers';

describe('providers', () => {
    describe('AI_PROVIDERS', () => {
        it('should have all expected providers', () => {
            const expectedProviders = [
                'workers-ai',
                'openai',
                'anthropic',
                'google-ai-studio',
                'azure',
                'mistral',
                'groq',
                'cohere',
                'hugging-face',
                'perplexity',
                'deepseek',
            ];
            for (const provider of expectedProviders) {
                expect(AI_PROVIDERS).toHaveProperty(provider);
            }
        });

        it('should have correct auth config for each provider', () => {
            // Standard Bearer auth
            expect(AI_PROVIDERS.openai.authHeader).toBe('Authorization');
            expect(AI_PROVIDERS.openai.authPrefix).toBe('Bearer ');

            // Anthropic uses x-api-key header
            expect(AI_PROVIDERS.anthropic.authHeader).toBe('x-api-key');
            expect(AI_PROVIDERS.anthropic.authPrefix).toBe('');

            // Azure uses api-key header
            expect(AI_PROVIDERS.azure.authHeader).toBe('api-key');
            expect(AI_PROVIDERS.azure.authPrefix).toBe('');

            // Google AI Studio uses query param (no header)
            expect(AI_PROVIDERS['google-ai-studio'].authHeader).toBeNull();
        });
    });

    describe('buildGatewayBaseUrl', () => {
        it('should construct the correct base URL', () => {
            const url = buildGatewayBaseUrl('acc123', 'my-gw');
            expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acc123/my-gw');
        });
    });

    describe('buildProviderUrl', () => {
        it('should construct provider-specific URL with leading slash', () => {
            const url = buildProviderUrl('acc123', 'my-gw', 'openai', '/chat/completions');
            expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acc123/my-gw/openai/chat/completions');
        });

        it('should construct provider-specific URL without leading slash', () => {
            const url = buildProviderUrl('acc123', 'my-gw', 'openai', 'chat/completions');
            expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acc123/my-gw/openai/chat/completions');
        });

        it('should use the correct path prefix for workers-ai', () => {
            const url = buildProviderUrl('acc123', 'my-gw', 'workers-ai', '/v1/chat/completions');
            expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acc123/my-gw/workers-ai/v1/chat/completions');
        });

        it('should use the correct path prefix for azure', () => {
            const url = buildProviderUrl('acc123', 'my-gw', 'azure', '/deployments/gpt4/chat/completions');
            expect(url).toBe(
                'https://gateway.ai.cloudflare.com/v1/acc123/my-gw/azure-openai/deployments/gpt4/chat/completions',
            );
        });

        it('should use the correct path prefix for perplexity', () => {
            const url = buildProviderUrl('acc123', 'my-gw', 'perplexity', '/chat/completions');
            expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acc123/my-gw/perplexity-ai/chat/completions');
        });
    });

    describe('buildUniversalChatUrl', () => {
        it('should return the gateway base URL (universal endpoint base)', () => {
            const url = buildUniversalChatUrl('acc123', 'my-gw');
            expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acc123/my-gw');
        });
    });

    describe('buildAuthHeaders', () => {
        it('should build Bearer auth for OpenAI', () => {
            const headers = buildAuthHeaders('openai', 'sk-test');
            expect(headers).toEqual({ Authorization: 'Bearer sk-test' });
        });

        it('should build x-api-key header for Anthropic', () => {
            const headers = buildAuthHeaders('anthropic', 'ant-test');
            expect(headers).toEqual({ 'x-api-key': 'ant-test' });
        });

        it('should return empty object for Google AI Studio (uses query param)', () => {
            const headers = buildAuthHeaders('google-ai-studio', 'goog-key');
            expect(headers).toEqual({});
        });

        it('should build api-key header for Azure', () => {
            const headers = buildAuthHeaders('azure', 'azure-key');
            expect(headers).toEqual({ 'api-key': 'azure-key' });
        });
    });

    describe('isValidProvider', () => {
        it('should return true for known providers', () => {
            expect(isValidProvider('openai')).toBe(true);
            expect(isValidProvider('anthropic')).toBe(true);
            expect(isValidProvider('workers-ai')).toBe(true);
            expect(isValidProvider('groq')).toBe(true);
        });

        it('should return false for unknown providers', () => {
            expect(isValidProvider('unknown-provider')).toBe(false);
            expect(isValidProvider('')).toBe(false);
        });
    });

    describe('getProvider', () => {
        it('should return config for valid providers', () => {
            const openai = getProvider('openai');
            expect(openai).toBeDefined();
            expect(openai!.name).toBe('OpenAI');
        });

        it('should return undefined for unknown providers', () => {
            expect(getProvider('nonexistent')).toBeUndefined();
        });
    });
});
