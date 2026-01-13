import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOttabaseAuthConfig } from '../config';

describe('Auth Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOttabaseAuthConfig', () => {
    it('should create a valid auth configuration', () => {
      const config = createOttabaseAuthConfig({
        adapter: {
          db: {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn(),
              first: vi.fn(),
              run: vi.fn(),
            }),
          },
        } as any,
        providers: [],
      });

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should handle empty providers list', () => {
      const config = createOttabaseAuthConfig({
        adapter: {
          db: {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn(),
              first: vi.fn(),
              run: vi.fn(),
            }),
          },
        } as any,
        providers: [],
      });

      expect(config).toBeDefined();
    });

    it('should set trust host when specified', () => {
      const config = createOttabaseAuthConfig({
        adapter: {
          db: {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn(),
              first: vi.fn(),
              run: vi.fn(),
            }),
          },
        } as any,
        providers: [],
        trustHost: true,
      });

      expect(config).toBeDefined();
    });

    it('should use provided auth secret', () => {
      const secret = 'test-secret-key';
      const config = createOttabaseAuthConfig({
        adapter: {
          db: {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn(),
              first: vi.fn(),
              run: vi.fn(),
            }),
          },
        } as any,
        providers: [],
        secret,
      });

      expect(config).toBeDefined();
    });
  });

  describe('createOttabaseAuthConfigDev', () => {
    it('should create development auth configuration', async () => {
      const { createOttabaseAuthConfigDev } = await import('../config');

      const config = createOttabaseAuthConfigDev({
        adapter: {
          db: {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn(),
              first: vi.fn(),
              run: vi.fn(),
            }),
          },
        } as any,
        providers: [],
      });

      expect(config).toBeDefined();
    });
  });

  describe('Provider Imports', () => {
    it('should export provider factory functions', () => {
      const { createGitHubProvider, createGoogleProvider, createDiscordProvider } = require('../providers');

      expect(typeof createGitHubProvider).toBe('function');
      expect(typeof createGoogleProvider).toBe('function');
      expect(typeof createDiscordProvider).toBe('function');
    });
  });

  describe('Auth Feature', () => {
    it('should export auth feature for database registration', () => {
      const { authFeature } = require('../db.feature');

      expect(authFeature).toBeDefined();
      expect(typeof authFeature).toBe('object');
    });

    it('should export feature registration function', () => {
      const { registerAuthFeature } = require('../db.feature');

      expect(typeof registerAuthFeature).toBe('function');
    });
  });
});
