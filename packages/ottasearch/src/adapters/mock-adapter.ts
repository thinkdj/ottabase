/**
 * Mock search adapter for demos and testing
 */

import type { SearchAdapter, SearchResult, SearchOptions } from '../types';
import { clientSearch, getRecentSearches, addRecentSearch, clearRecentSearches } from '../utils';

/**
 * Mock data configuration
 */
export interface MockAdapterConfig {
  /** Custom mock data (optional) */
  data?: SearchResult[];
  /** Simulate network delay in ms */
  delay?: number;
  /** Simulate error (for testing) */
  simulateError?: boolean;
}

/**
 * Default mock data - realistic examples
 */
const DEFAULT_MOCK_DATA: SearchResult[] = [
  // Users
  {
    id: 'user-1',
    title: 'Alice Johnson',
    description: 'alice@example.com',
    category: 'Users',
    icon: 'User',
    url: '/users/alice-johnson',
    metadata: { email: 'alice@example.com', role: 'Admin' },
  },
  {
    id: 'user-2',
    title: 'Bob Smith',
    description: 'bob@example.com',
    category: 'Users',
    icon: 'User',
    url: '/users/bob-smith',
    metadata: { email: 'bob@example.com', role: 'Editor' },
  },
  {
    id: 'user-3',
    title: 'Charlie Brown',
    description: 'charlie@example.com',
    category: 'Users',
    icon: 'User',
    url: '/users/charlie-brown',
    metadata: { email: 'charlie@example.com', role: 'Viewer' },
  },
  {
    id: 'user-4',
    title: 'Diana Prince',
    description: 'diana@example.com',
    category: 'Users',
    icon: 'User',
    url: '/users/diana-prince',
    metadata: { email: 'diana@example.com', role: 'Admin' },
  },
  {
    id: 'user-5',
    title: 'Ethan Hunt',
    description: 'ethan@example.com',
    category: 'Users',
    icon: 'User',
    url: '/users/ethan-hunt',
    metadata: { email: 'ethan@example.com', role: 'Editor' },
  },

  // Documents
  {
    id: 'doc-1',
    title: 'Getting Started Guide',
    description: 'Learn how to use Ottabase',
    category: 'Documents',
    icon: 'FileText',
    url: '/docs/getting-started',
    metadata: { type: 'guide', updatedAt: '2024-01-15' },
  },
  {
    id: 'doc-2',
    title: 'API Documentation',
    description: 'Complete API reference',
    category: 'Documents',
    icon: 'FileText',
    url: '/docs/api',
    metadata: { type: 'reference', updatedAt: '2024-01-20' },
  },
  {
    id: 'doc-3',
    title: 'Architecture Overview',
    description: 'System architecture and design patterns',
    category: 'Documents',
    icon: 'FileText',
    url: '/docs/architecture',
    metadata: { type: 'guide', updatedAt: '2024-01-10' },
  },
  {
    id: 'doc-4',
    title: 'Best Practices',
    description: 'Recommended patterns and practices',
    category: 'Documents',
    icon: 'FileText',
    url: '/docs/best-practices',
    metadata: { type: 'guide', updatedAt: '2024-01-18' },
  },

  // Projects
  {
    id: 'project-1',
    title: 'Website Redesign',
    description: 'Q1 2024 website refresh project',
    category: 'Projects',
    icon: 'FolderOpen',
    url: '/projects/website-redesign',
    metadata: { status: 'active', deadline: '2024-03-31' },
  },
  {
    id: 'project-2',
    title: 'Mobile App Launch',
    description: 'iOS and Android app development',
    category: 'Projects',
    icon: 'FolderOpen',
    url: '/projects/mobile-app',
    metadata: { status: 'active', deadline: '2024-06-30' },
  },
  {
    id: 'project-3',
    title: 'API v2 Migration',
    description: 'Migrate to new API version',
    category: 'Projects',
    icon: 'FolderOpen',
    url: '/projects/api-migration',
    metadata: { status: 'planning', deadline: '2024-09-30' },
  },
  {
    id: 'project-4',
    title: 'Security Audit',
    description: 'Comprehensive security review',
    category: 'Projects',
    icon: 'FolderOpen',
    url: '/projects/security-audit',
    metadata: { status: 'completed', deadline: '2024-01-15' },
  },

  // Tasks
  {
    id: 'task-1',
    title: 'Update homepage copy',
    description: 'Review and update marketing content',
    category: 'Tasks',
    icon: 'CheckSquare',
    url: '/tasks/update-homepage',
    metadata: { priority: 'high', assignee: 'Alice Johnson' },
  },
  {
    id: 'task-2',
    title: 'Fix login bug',
    description: 'Users unable to login with SSO',
    category: 'Tasks',
    icon: 'CheckSquare',
    url: '/tasks/fix-login-bug',
    metadata: { priority: 'urgent', assignee: 'Bob Smith' },
  },
  {
    id: 'task-3',
    title: 'Design new dashboard',
    description: 'Create mockups for analytics dashboard',
    category: 'Tasks',
    icon: 'CheckSquare',
    url: '/tasks/design-dashboard',
    metadata: { priority: 'medium', assignee: 'Diana Prince' },
  },
  {
    id: 'task-4',
    title: 'Write API tests',
    description: 'Add integration tests for new endpoints',
    category: 'Tasks',
    icon: 'CheckSquare',
    url: '/tasks/write-tests',
    metadata: { priority: 'medium', assignee: 'Charlie Brown' },
  },

  // Settings
  {
    id: 'settings-1',
    title: 'Account Settings',
    description: 'Manage your account preferences',
    category: 'Settings',
    icon: 'Settings',
    url: '/settings/account',
  },
  {
    id: 'settings-2',
    title: 'Team Settings',
    description: 'Configure team members and permissions',
    category: 'Settings',
    icon: 'Settings',
    url: '/settings/team',
  },
  {
    id: 'settings-3',
    title: 'Billing Settings',
    description: 'Manage subscription and payments',
    category: 'Settings',
    icon: 'Settings',
    url: '/settings/billing',
  },
  {
    id: 'settings-4',
    title: 'Notifications',
    description: 'Configure email and push notifications',
    category: 'Settings',
    icon: 'Settings',
    url: '/settings/notifications',
  },
];

/**
 * Create a mock search adapter
 */
export function createMockAdapter(config: MockAdapterConfig = {}): SearchAdapter {
  const {
    data = DEFAULT_MOCK_DATA,
    delay = 300,
    simulateError = false,
  } = config;

  const adapter: SearchAdapter = {
    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Simulate error if configured
      if (simulateError) {
        throw new Error('Mock adapter error');
      }

      // Filter by scope if specified
      let scopedData = data;
      if (options?.scope) {
        scopedData = data.filter(item => item.category === options.scope);
      }

      // Empty query returns recent or all results
      if (!query.trim()) {
        const recent = getRecentSearches();
        const results = recent.length > 0 ? recent : scopedData;
        return applyOptions(results, options);
      }

      // Client-side search
      const results = clientSearch(scopedData, query);

      return applyOptions(results, options);
    },

    async getRecentSearches(): Promise<SearchResult[]> {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return getRecentSearches();
    },

    async clearHistory(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 100));
      clearRecentSearches();
    },
  };

  return adapter;
}

/**
 * Apply search options (limit, offset, category filter)
 */
function applyOptions(
  results: SearchResult[],
  options?: SearchOptions
): SearchResult[] {
  let filtered = results;

  // Filter by categories if specified
  if (options?.categories && options.categories.length > 0) {
    filtered = filtered.filter(
      (r) => r.category && options.categories!.includes(r.category)
    );
  }

  // Apply offset and limit
  const offset = options?.offset || 0;
  const limit = options?.limit || 50;

  return filtered.slice(offset, offset + limit);
}
