/**
 * Adapter exports for @ottabase/ottasearch/adapters
 * This allows users to import adapters separately to avoid CF dependency
 */

export { createMockAdapter } from './adapters/mock-adapter';
export type { MockAdapterConfig } from './adapters/mock-adapter';

export { createD1SearchAdapter, createFTS5TableSQL } from './adapters/d1-adapter';
export type { D1AdapterConfig, D1TableConfig } from './adapters/d1-adapter';

export { createApiAdapter, createApiAdapterPost } from './adapters/api-adapter';
export type { ApiAdapterConfig } from './adapters/api-adapter';
