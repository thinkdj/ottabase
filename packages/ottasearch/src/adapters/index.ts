/**
 * Search adapters for different data sources
 */

export { createMockAdapter } from './mock-adapter';
export type { MockAdapterConfig } from './mock-adapter';

export { createD1SearchAdapter, createFTS5TableSQL } from './d1-adapter';
export type { D1AdapterConfig, D1TableConfig } from './d1-adapter';

export { createApiAdapter, createApiAdapterPost } from './api-adapter';
export type { ApiAdapterConfig } from './api-adapter';
