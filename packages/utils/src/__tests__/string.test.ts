import { describe, it, expect } from 'vitest';
import {
  isEmail,
  changeCase,
  getInitials,
  isEmptyStr,
  humanizeString,
  ucFirst,
  replaceStringTokens,
  generateUUID,
} from '../string';

describe('String Utilities', () => {
  describe('isEmail', () => {
    it('should validate correct emails', () => {
      expect(isEmail('user@example.com')).toBe(true);
      expect(isEmail('test.email@domain.co.uk')).toBe(true);
      expect(isEmail('john_doe@example.org')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isEmail('invalid')).toBe(false);
      expect(isEmail('invalid@')).toBe(false);
      expect(isEmail('@example.com')).toBe(false);
      expect(isEmail('test@.com')).toBe(false);
      expect(isEmail('')).toBe(false);
      expect(isEmail('   ')).toBe(false);
    });
  });

  describe('changeCase', () => {
    const str = 'hello-world-example';

    it('should convert to camelCase', () => {
      expect(changeCase(str, 'camel')).toBe('helloWorldExample');
    });

    it('should convert to PascalCase', () => {
      expect(changeCase(str, 'pascal')).toBe('HelloWorldExample');
    });

    it('should convert to snake_case', () => {
      expect(changeCase('HelloWorld', 'snake')).toBe('hello_world');
    });

    it('should convert to kebab-case', () => {
      expect(changeCase('HelloWorld', 'kebab')).toBe('hello-world');
    });

    it('should convert to CONSTANT_CASE', () => {
      expect(changeCase('helloWorld', 'constant')).toBe('HELLO_WORLD');
    });

    it('should convert to Title Case', () => {
      expect(changeCase('hello world', 'title')).toBe('Hello World');
    });

    it('should convert to Sentence case', () => {
      expect(changeCase('hello world', 'sentence')).toBe('Hello world');
    });

    it('should convert to lowercase', () => {
      expect(changeCase('HELLO', 'lower')).toBe('hello');
    });

    it('should convert to UPPERCASE', () => {
      expect(changeCase('hello', 'upper')).toBe('HELLO');
    });

    it('should handle empty strings', () => {
      expect(changeCase('', 'camel')).toBe('');
      expect(changeCase('   ', 'snake')).toBe('');
    });
  });

  describe('getInitials', () => {
    it('should extract initials from full names', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Alice Smith')).toBe('AS');
    });

    it('should handle single names', () => {
      expect(getInitials('Madonna')).toBe('MA');
      expect(getInitials('Prince')).toBe('PR');
    });

    it('should handle names with multiple spaces', () => {
      expect(getInitials('Jean Claude Van Damme')).toBe('JD');
    });

    it('should use default initials for empty/null inputs', () => {
      expect(getInitials(null)).toBe('');
      expect(getInitials(undefined)).toBe('');
      expect(getInitials('', 'N/A')).toBe('N/A');
    });

    it('should trim whitespace', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
    });
  });

  describe('isEmptyStr', () => {
    it('should identify empty strings', () => {
      expect(isEmptyStr('')).toBe(true);
      expect(isEmptyStr('   ')).toBe(true);
      expect(isEmptyStr('\t\n')).toBe(true);
    });

    it('should identify non-empty strings', () => {
      expect(isEmptyStr('hello')).toBe(false);
      expect(isEmptyStr('  a  ')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isEmptyStr(null)).toBe(true);
      expect(isEmptyStr(undefined)).toBe(true);
    });
  });

  describe('humanizeString', () => {
    it('should convert kebab-case to human readable', () => {
      expect(humanizeString('hello-world')).toBe('Hello world');
    });

    it('should convert snake_case to human readable', () => {
      expect(humanizeString('hello_world')).toBe('Hello world');
    });

    it('should convert camelCase to human readable', () => {
      expect(humanizeString('helloWorld')).toBe('Hello world');
    });

    it('should capitalize first letter by default', () => {
      expect(humanizeString('hello')).toBe('Hello');
    });

    it('should handle multiple word capitalization', () => {
      expect(humanizeString('hello-world-example', true, true)).toBe('Hello World Example');
    });

    it('should handle empty strings', () => {
      expect(humanizeString('')).toBe('');
      expect(humanizeString(null as any)).toBe('');
    });
  });

  describe('ucFirst', () => {
    it('should uppercase first letter', () => {
      expect(ucFirst('hello')).toBe('Hello');
      expect(ucFirst('wORLD')).toBe('WORLD');
    });

    it('should handle whitespace', () => {
      expect(ucFirst('  hello')).toBe('Hello');
    });

    it('should handle empty strings', () => {
      expect(ucFirst('')).toBe('');
      expect(ucFirst('   ')).toBe('');
    });
  });

  describe('replaceStringTokens', () => {
    it('should replace tokens with default identifier', () => {
      expect(replaceStringTokens('Hello :name', { name: 'world' })).toBe('Hello world');
      expect(replaceStringTokens('User :id with email :email', { id: 123, email: 'test@example.com' })).toBe(
        'User 123 with email test@example.com',
      );
    });

    it('should replace tokens with custom identifier', () => {
      expect(replaceStringTokens('Path /%id/%slug', { id: 1, slug: 'hello' }, '%')).toBe('Path /1/hello');
    });

    it('should leave unknown tokens unchanged', () => {
      expect(replaceStringTokens('Hello :name, your age is :age', { name: 'John' })).toBe(
        'Hello John, your age is :age',
      );
    });

    it('should handle empty strings', () => {
      expect(replaceStringTokens('', { name: 'world' })).toBe('');
    });
  });

  describe('generateUUID', () => {
    it('should generate UUID of specified length', () => {
      const uuid1 = generateUUID(10);
      expect(uuid1).toHaveLength(10);

      const uuid2 = generateUUID(20);
      expect(uuid2).toHaveLength(20);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID(15);
      const uuid2 = generateUUID(15);
      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate alphanumeric UUID', () => {
      for (let i = 0; i < 10; i++) {
        const uuid = generateUUID(10, true);
        expect(uuid).toHaveLength(10);
        expect(/^[A-Za-z0-9]/.test(uuid)).toBe(true);
      }
    });

    it('should return empty string for length 0 or less', () => {
      expect(generateUUID(0)).toBe('');
      expect(generateUUID(-5)).toBe('');
    });
  });
});
