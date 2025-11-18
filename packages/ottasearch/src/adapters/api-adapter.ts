/**
 * API search adapter for REST endpoints
 * Fetches search results from a REST API
 */

import type { SearchAdapter, SearchResult, SearchOptions } from '../types';

/**
 * Create an AbortController with timeout
 * @param timeout Timeout in milliseconds
 * @returns Object with controller and cleanup function
 */
function createAbortController(timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const cleanup = () => clearTimeout(timeoutId);

  return { controller, cleanup };
}

/**
 * API adapter configuration
 */
export interface ApiAdapterConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** Search endpoint (will be appended to baseUrl) */
  searchEndpoint?: string;
  /** Query parameter name for search query */
  queryParam?: string;
  /** Additional headers for requests */
  headers?: Record<string, string>;
  /** Transform function to convert API response to SearchResult[] */
  transform?: (data: any) => SearchResult[];
  /** Request timeout in ms */
  timeout?: number;
  /** Debounce delay (handled externally, but can be configured here) */
  debounceMs?: number;
}

/**
 * Default transform function
 * Assumes API returns an array of objects with id, title, description, etc.
 */
function defaultTransform(data: any): SearchResult[] {
  if (!Array.isArray(data)) {
    // Try common response formats
    if (data.results && Array.isArray(data.results)) {
      data = data.results;
    } else if (data.data && Array.isArray(data.data)) {
      data = data.data;
    } else if (data.items && Array.isArray(data.items)) {
      data = data.items;
    } else {
      return [];
    }
  }

  return data.map((item: any) => ({
    id: String(item.id || item._id || item.key || Math.random()),
    title: String(item.title || item.name || item.label || ''),
    description: item.description || item.desc || item.subtitle,
    category: item.category || item.type || item.group,
    icon: item.icon,
    url: item.url || item.link || item.href,
    metadata: item,
  }));
}

/**
 * Create an API search adapter
 */
export function createApiAdapter(config: ApiAdapterConfig): SearchAdapter {
  const {
    baseUrl,
    searchEndpoint = '/search',
    queryParam = 'q',
    headers = {},
    transform = defaultTransform,
    timeout = 10000,
  } = config;

  const adapter: SearchAdapter = {
    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
      if (!query.trim()) {
        return [];
      }

      try {
        // Build URL with query params
        const url = new URL(searchEndpoint, baseUrl);
        url.searchParams.set(queryParam, query);

        // Add additional params from options
        if (options?.limit) {
          url.searchParams.set('limit', String(options.limit));
        }
        if (options?.offset) {
          url.searchParams.set('offset', String(options.offset));
        }
        if (options?.scope) {
          url.searchParams.set('scope', options.scope);
        }
        if (options?.categories && options.categories.length > 0) {
          url.searchParams.set('categories', options.categories.join(','));
        }

        // Create abort controller for timeout
        const { controller, cleanup } = createAbortController(timeout);

        try {
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            signal: controller.signal,
          });

          cleanup();

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          return transform(data);
        } catch (error) {
          cleanup();
          throw error;
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Search request timed out');
          }
          throw error;
        }
        throw new Error('Search failed');
      }
    },
  };

  return adapter;
}

/**
 * Create an API adapter with POST method
 */
export function createApiAdapterPost(config: ApiAdapterConfig): SearchAdapter {
  const {
    baseUrl,
    searchEndpoint = '/search',
    headers = {},
    transform = defaultTransform,
    timeout = 10000,
  } = config;

  const adapter: SearchAdapter = {
    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
      if (!query.trim()) {
        return [];
      }

      try {
        const url = new URL(searchEndpoint, baseUrl);

        // Create abort controller for timeout
        const { controller, cleanup } = createAbortController(timeout);

        try {
          const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({
              query,
              limit: options?.limit,
              offset: options?.offset,
              scope: options?.scope,
              categories: options?.categories,
              ...options,
            }),
            signal: controller.signal,
          });

          cleanup();

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          return transform(data);
        } catch (error) {
          cleanup();
          throw error;
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Search request timed out');
          }
          throw error;
        }
        throw new Error('Search failed');
      }
    },
  };

  return adapter;
}
