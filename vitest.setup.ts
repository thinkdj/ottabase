import '@testing-library/jest-dom';

/**
 * Global test setup file
 * This runs before all test files
 */

// Mock environment variables for testing
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Global test utilities can be added here
// For example, custom matchers, global mocks, etc.

// Suppress console warnings in tests (optional)
// global.console = {
//   ...console,
//   warn: jest.fn(),
//   error: jest.fn(),
// };
