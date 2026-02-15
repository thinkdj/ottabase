/**
 * @ottabase/cf
 * Framework-agnostic Cloudflare bindings wrapper
 *
 * Provides type-safe wrappers for all Cloudflare Worker bindings:
 * - D1: SQLite database
 * - KV: Key-value storage
 * - R2: Object storage
 * - Images: Image transformation and optimization
 * - Hyperdrive: Database connection pooling
 * - Queues: Message queue processing
 * - Secrets: Environment variables and secrets management
 * - Rate Limiting: Request throttling
 */

// Types
export * from './types';

// D1 Database
export { D1Client, createD1Client, type D1Config, type D1QueryOptions } from './d1';

// KV Storage
export {
    KVClient,
    createKVClient,
    type KVConfig,
    type KVGetOptions,
    type KVListOptions,
    type KVPutOptions,
} from './kv';

// R2 Storage
export {
    R2Client,
    createR2Client,
    type R2Config,
    type R2GetOptions,
    type R2ListOptions,
    type R2PutOptions,
} from './r2';

// Images
export {
    ImagesClient,
    createImagesClient,
    type ImageDetails,
    type ImageUploadOptions,
    type ImageVariant,
    type ImagesConfig,
} from './images';

// Hyperdrive
export { HyperdriveClient, createHyperdriveClient, type HyperdriveConfig } from './hyperdrive';

// Queues
export {
    QueuesClient,
    createQueuesClient,
    processQueueBatch,
    type QueueHandler,
    type QueueMessage,
    type QueueSendOptions,
    type QueuesConfig,
} from './queues';

// Secrets
export { SecretsClient, createSecretsClient, type SecretsConfig } from './secrets';

// Rate Limiting
export {
    RateLimitingClient,
    createRateLimitingClient,
    type RateLimitOptions,
    type RateLimitResult,
    type RateLimitingConfig,
} from './rate-limiting';

// KV Cache (read-through helper)
export { invalidateCache, invalidateCacheByPrefix, withCache } from './kv-cache';

// Cache Keys
export {
    CacheKeyBuilder,
    appKey,
    appUserKey,
    globalKey,
    orgAppKey,
    orgAppUserKey,
    orgKey,
    orgUserKey,
    parseKey,
    userKey,
    versionedOrgKey,
    type CacheNamespace,
    type CacheScope,
} from './cache-keys';
