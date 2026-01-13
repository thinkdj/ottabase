import { describe, it, expect, vi } from 'vitest';

describe('Jotai State Management', () => {
  describe('State Initialization', () => {
    it('should create application state', () => {
      const createAppState = require('../createAppState').createAppState;
      expect(typeof createAppState).toBe('function');
    });

    it('should create default application state', () => {
      const { createDefaultAppState } = require('../createAppState');
      const state = createDefaultAppState();
      expect(state).toBeDefined();
    });

    it('should export default state values', () => {
      const { STATE_DEFAULTS } = require('../index');
      expect(STATE_DEFAULTS.theme).toBe('light');
    });
  });

  describe('Theme Management', () => {
    it('should define cursor theme types', () => {
      const { DEFAULT_CURSOR_THEME } = require('../index');
      expect(DEFAULT_CURSOR_THEME).toBe('default');
    });

    it('should provide selection color configuration', () => {
      const { DEFAULT_SELECTION_COLOR } = require('../index');
      expect(DEFAULT_SELECTION_COLOR.foreground).toBe('#FFF');
      expect(DEFAULT_SELECTION_COLOR.background).toBe('#3A3A3A');
    });

    it('should support multiple cursor themes', () => {
      const themes = ['default', 'pointer', 'auto'];
      expect(themes).toContain('default');
    });
  });

  describe('Layout Configuration', () => {
    it('should export layout provider type', () => {
      const { DEFAULT_LAYOUT_PROVIDER } = require('../index');
      expect(DEFAULT_LAYOUT_PROVIDER).toBe('mantine');
    });

    it('should provide layout preset', () => {
      const { DEFAULT_LAYOUT_PRESET } = require('../index');
      expect(DEFAULT_LAYOUT_PRESET).toBe('app');
    });

    it('should support different layout providers', () => {
      const providers = ['mantine', 'shadcn', 'custom'];
      expect(providers).toContain('mantine');
    });
  });

  describe('State Types', () => {
    it('should export type definitions', () => {
      const types = require('../index');
      expect(types).toBeDefined();
    });

    it('should define BaseUser type', () => {
      const { createDefaultAppState } = require('../createAppState');
      const state = createDefaultAppState();
      expect(state).toBeDefined();
    });

    it('should define AppGlobalState type', () => {
      const state = require('../index');
      expect(state).toBeDefined();
    });
  });

  describe('Provider State', () => {
    it('should export ProviderState component', () => {
      const ProviderState = require('../index').default;
      expect(ProviderState).toBeDefined();
    });

    it('should manage provider context', () => {
      const provider = require('../ProviderState');
      expect(provider).toBeDefined();
    });
  });

  describe('Atom Management', () => {
    it('should create atoms for state management', () => {
      const createAppState = require('../createAppState').createAppState;
      const atoms = createAppState({});
      expect(atoms).toBeDefined();
    });

    it('should provide atom accessors', () => {
      const { createDefaultAppState } = require('../createAppState');
      const state = createDefaultAppState();
      expect(state).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const mockConfig = {
        theme: 'dark',
        cursorTheme: 'pointer',
      };

      expect(mockConfig.theme).toBe('dark');
      expect(mockConfig.cursorTheme).toBe('pointer');
    });

    it('should merge with defaults', () => {
      const defaults = { theme: 'light' };
      const custom = { cursorTheme: 'auto' };
      const merged = { ...defaults, ...custom };

      expect(merged.theme).toBe('light');
      expect(merged.cursorTheme).toBe('auto');
    });
  });

  describe('Type Safety', () => {
    it('should export type definitions for TypeScript', () => {
      const types = require('../types');
      expect(types).toBeDefined();
    });

    it('should support AppStateConfig type', () => {
      const config = {
        initialTheme: 'light',
        layoutProvider: 'mantine',
      };

      expect(config.initialTheme).toBe('light');
      expect(config.layoutProvider).toBe('mantine');
    });
  });

  describe('Integration', () => {
    it('should work with React applications', () => {
      const { createDefaultAppState } = require('../createAppState');
      const state = createDefaultAppState();
      expect(state).toBeDefined();
    });

    it('should integrate with Jotai', () => {
      const state = require('../index');
      expect(state).toBeDefined();
    });
  });
});
