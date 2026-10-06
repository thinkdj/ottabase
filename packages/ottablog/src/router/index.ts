/**
 * @ottabase/ottablog/router
 *
 * Mountable, React-free blog HTTP surface for Cloudflare Workers. Import from
 * this subpath in worker code so the package's React components stay out of
 * the bundle graph.
 */
export { createBlogHandlers } from './handlers';
export { seedDemoPosts } from './demo-seed';
export type { BlogDemoSeedResult, BlogDemoSeedScope } from './demo-seed';
export { buildBlogRouter, createBlogRouter } from './router';
export type { BuildBlogRouterOptions } from './router';
export type {
    BlogAdminResult,
    BlogDemoPhotoSeed,
    BlogDemoPostSeed,
    BlogHandlers,
    BlogRequestContext,
    BlogRouterConfig,
} from './types';
