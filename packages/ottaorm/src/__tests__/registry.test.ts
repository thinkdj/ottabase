import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerModel, registerModels, getModel, hasModel, getRegisteredModels, clearModelRegistry } from '../registry';

describe('OttaORM Model Registry', () => {
  beforeEach(() => {
    clearModelRegistry();
  });

  describe('registerModel', () => {
    it('should register a single model', () => {
      const TestModel = { name: 'Test', schema: {} };
      registerModel('test', TestModel);

      expect(hasModel('test')).toBe(true);
    });

    it('should store model with correct name', () => {
      const TestModel = { name: 'User', schema: {} };
      registerModel('user', TestModel);

      expect(getModel('user')).toEqual(TestModel);
    });

    it('should handle duplicate registrations', () => {
      const Model1 = { name: 'Test1', schema: {} };
      const Model2 = { name: 'Test2', schema: {} };

      registerModel('test', Model1);
      registerModel('test', Model2);

      expect(getModel('test')).toEqual(Model2);
    });
  });

  describe('registerModels', () => {
    it('should register multiple models at once', () => {
      const models = {
        user: { name: 'User', schema: {} },
        post: { name: 'Post', schema: {} },
        comment: { name: 'Comment', schema: {} },
      };

      registerModels(models);

      expect(hasModel('user')).toBe(true);
      expect(hasModel('post')).toBe(true);
      expect(hasModel('comment')).toBe(true);
    });

    it('should handle empty object', () => {
      expect(() => registerModels({})).not.toThrow();
    });
  });

  describe('getModel', () => {
    it('should retrieve registered model', () => {
      const TestModel = { name: 'Test', schema: { id: 'string' } };
      registerModel('test', TestModel);

      const model = getModel('test');
      expect(model).toEqual(TestModel);
    });

    it('should return undefined for unregistered model', () => {
      expect(getModel('nonexistent')).toBeUndefined();
    });
  });

  describe('hasModel', () => {
    it('should detect registered models', () => {
      registerModel('test', { name: 'Test', schema: {} });
      expect(hasModel('test')).toBe(true);
    });

    it('should return false for unregistered models', () => {
      expect(hasModel('nonexistent')).toBe(false);
    });
  });

  describe('getRegisteredModels', () => {
    it('should return all registered models', () => {
      const models = {
        user: { name: 'User', schema: {} },
        post: { name: 'Post', schema: {} },
      };

      registerModels(models);
      const registered = getRegisteredModels();

      expect(registered).toHaveProperty('user');
      expect(registered).toHaveProperty('post');
    });

    it('should return empty object when no models registered', () => {
      const registered = getRegisteredModels();
      expect(Object.keys(registered)).toHaveLength(0);
    });
  });

  describe('clearModelRegistry', () => {
    it('should clear all registered models', () => {
      registerModel('test1', { name: 'Test1', schema: {} });
      registerModel('test2', { name: 'Test2', schema: {} });

      clearModelRegistry();

      expect(hasModel('test1')).toBe(false);
      expect(hasModel('test2')).toBe(false);
    });

    it('should allow re-registration after clearing', () => {
      registerModel('test', { name: 'Test', schema: {} });
      clearModelRegistry();
      registerModel('test', { name: 'NewTest', schema: {} });

      expect(hasModel('test')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in model names', () => {
      const TestModel = { name: 'Test', schema: {} };
      registerModel('user_profile', TestModel);

      expect(hasModel('user_profile')).toBe(true);
    });

    it('should be case-sensitive', () => {
      registerModel('User', { name: 'User', schema: {} });

      expect(hasModel('User')).toBe(true);
      expect(hasModel('user')).toBe(false);
    });
  });
});
