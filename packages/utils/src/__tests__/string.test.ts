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
    it('should validate correct email addresses', () => {
      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('user.name@example.co.uk')).toBe(true);
      expect(isEmail('name+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isEmail('invalid')).toBe(false);
      expect(isEmail('invalid@')).toBe(false);
      expect(isEmail('@example.com')).toBe(false);
      expect(isEmail('')).toBe(false);
      expect(isEmail('no-domain@')).toBe(false);
    });
  });

  describe('changeCase', () => {
    const testStr = 'hello world';

    it('should convert to camelCase', () => {
      expect(changeCase('hello world', 'camel')).toBe('helloWorld');
      expect(changeCase('hello-world', 'camel')).toBe('helloWorld');
      expect(changeCase('hello_world', 'camel')).toBe('helloWorld');
    });

    it('should convert to snake_case', () => {
      expect(changeCase('helloWorld', 'snake')).toBe('hello_world');
      expect(changeCase('hello-world', 'snake')).toBe('hello_world');
      expect(changeCase('hello world', 'snake')).toBe('hello_world');
    });

    it('should convert to kebab-case', () => {
      expect(changeCase('helloWorld', 'kebab')).toBe('hello-world');
      expect(changeCase('hello_world', 'kebab')).toBe('hello-world');
      expect(changeCase('hello world', 'kebab')).toBe('hello-world');
    });

    it('should convert to PascalCase', () => {
      expect(changeCase('hello world', 'pascal')).toBe('HelloWorld');
      expect(changeCase('hello-world', 'pascal')).toBe('HelloWorld');
      expect(changeCase('hello_world', 'pascal')).toBe('HelloWorld');
    });

    it('should convert to Title Case', () => {
      expect(changeCase('hello world', 'title')).toBe('Hello World');
      expect(changeCase('hello-world', 'title')).toBe('Hello World');
    });

    it('should convert to CONSTANT_CASE', () => {
      expect(changeCase('helloWorld', 'constant')).toBe('HELLO_WORLD');
      expect(changeCase('hello world', 'constant')).toBe('HELLO_WORLD');
    });

    it('should convert to lower and upper case', () => {
      expect(changeCase('HELLO WORLD', 'lower')).toBe('hello world');
      expect(changeCase('hello world', 'upper')).toBe('HELLO WORLD');
    });

    it('should return empty string for empty input', () => {
      expect(changeCase('', 'camel')).toBe('');
    });
  });

  describe('getInitials', () => {
    it('should get initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Jane Smith')).toBe('JS');
      expect(getInitials('Alice Bob Charlie')).toBe('AC');
    });

    it('should handle single name', () => {
      expect(getInitials('John')).toBe('JO');
      expect(getInitials('A')).toBe('A'); // Single character returns just that character uppercase
    });

    it('should handle empty or null values', () => {
      expect(getInitials(null)).toBe('');
      expect(getInitials(undefined)).toBe('');
      expect(getInitials('')).toBe('');
      expect(getInitials(null, 'XX')).toBe('XX');
    });

    it('should handle extra whitespace', () => {
      expect(getInitials('  John   Doe  ')).toBe('JD');
    });
  });

  describe('isEmptyStr', () => {
    it('should identify empty strings', () => {
      expect(isEmptyStr('')).toBe(true);
      expect(isEmptyStr('   ')).toBe(true);
      expect(isEmptyStr(null)).toBe(true);
      expect(isEmptyStr(undefined)).toBe(true);
    });

    it('should identify non-empty strings', () => {
      expect(isEmptyStr('hello')).toBe(false);
      expect(isEmptyStr('  hello  ')).toBe(false);
    });
  });

  describe('humanizeString', () => {
    it('should humanize kebab-case', () => {
      expect(humanizeString('hello-world')).toBe('Hello world');
      expect(humanizeString('user-profile-settings')).toBe('User profile settings');
    });

    it('should humanize snake_case', () => {
      expect(humanizeString('hello_world')).toBe('Hello world');
      expect(humanizeString('user_profile_settings')).toBe('User profile settings');
    });

    it('should humanize camelCase', () => {
      expect(humanizeString('helloWorld')).toBe('Hello world');
      expect(humanizeString('userProfileSettings')).toBe('User profile settings');
    });

    it('should respect capitalizeFirstLetter option', () => {
      expect(humanizeString('hello-world', false)).toBe('hello world');
      expect(humanizeString('hello-world', true)).toBe('Hello world');
    });

    it('should respect capitalizeAllWords option', () => {
      expect(humanizeString('hello-world', true, true)).toBe('Hello World');
      expect(humanizeString('user-profile-settings', true, true)).toBe(
        'User Profile Settings',
      );
    });
  });

  describe('ucFirst', () => {
    it('should uppercase first letter', () => {
      expect(ucFirst('hello')).toBe('Hello');
      expect(ucFirst('world')).toBe('World');
    });

    it('should handle already capitalized strings', () => {
      expect(ucFirst('Hello')).toBe('Hello');
    });

    it('should handle empty strings', () => {
      expect(ucFirst('')).toBe('');
      expect(ucFirst('  ')).toBe('');
    });
  });

  describe('replaceStringTokens', () => {
    it('should replace tokens with values', () => {
      expect(replaceStringTokens('Hello :name', { name: 'World' })).toBe(
        'Hello World',
      );
      expect(
        replaceStringTokens('User :id has :count items', {
          id: '123',
          count: 5,
        }),
      ).toBe('User 123 has 5 items');
    });

    it('should use custom identifier', () => {
      expect(
        replaceStringTokens('/blog/%id/%slug', { id: 1, slug: 'hello' }, '%'),
      ).toBe('/blog/1/hello');
    });

    it('should leave unmatched tokens unchanged', () => {
      expect(replaceStringTokens('Hello :name :age', { name: 'World' })).toBe(
        'Hello World :age',
      );
    });

    it('should handle empty string', () => {
      expect(replaceStringTokens('', { name: 'World' })).toBe('');
    });
  });

  describe('generateUUID', () => {
    it('should generate UUID of specified length', () => {
      const uuid10 = generateUUID(10);
      expect(uuid10).toHaveLength(10);

      const uuid20 = generateUUID(20);
      expect(uuid20).toHaveLength(20);
    });

    it('should return empty string for zero or negative length', () => {
      expect(generateUUID(0)).toBe('');
      expect(generateUUID(-5)).toBe('');
    });

    it('should generate different UUIDs on each call', () => {
      const uuid1 = generateUUID(10);
      const uuid2 = generateUUID(10);
      expect(uuid1).not.toBe(uuid2);
    });

    it('should only contain valid characters', () => {
      const uuid = generateUUID(100);
      const validChars =
        /^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_~-]+$/;
      expect(validChars.test(uuid)).toBe(true);
    });
  });
});
