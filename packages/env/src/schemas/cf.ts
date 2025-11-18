import { z } from "zod";
import { cloudflareToken, cloudflareAccountId, cloudflareZoneId } from "../helpers";

/**
 * Environment schema for @ottabase/cf package
 * Cloudflare bindings and API configuration
 */
export const cfEnvSchema = z.object({
  /**
   * Cloudflare API Token for authentication
   * Get it from: https://dash.cloudflare.com/profile/api-tokens
   */
  CF_API_TOKEN: cloudflareToken()
    .optional()
    .describe("Cloudflare API Token for API operations"),

  /**
   * Cloudflare Account ID
   * Found in your Cloudflare dashboard
   */
  CF_ACCOUNT_ID: cloudflareAccountId()
    .optional()
    .describe("Cloudflare Account ID"),

  /**
   * Cloudflare Zone ID (for domain-specific operations)
   */
  CF_ZONE_ID: cloudflareZoneId()
    .optional()
    .describe("Cloudflare Zone ID for domain operations"),

  /**
   * Cloudflare Images Account Hash
   */
  CF_IMAGES_ACCOUNT_HASH: z
    .string()
    .optional()
    .describe("Cloudflare Images account hash"),

  /**
   * Cloudflare R2 Bucket Name
   */
  CF_R2_BUCKET: z.string().optional().describe("Cloudflare R2 bucket name"),

  /**
   * Cloudflare KV Namespace ID
   */
  CF_KV_NAMESPACE_ID: z
    .string()
    .optional()
    .describe("Cloudflare KV namespace ID"),

  /**
   * Cloudflare D1 Database ID
   */
  CF_D1_DATABASE_ID: z
    .string()
    .optional()
    .describe("Cloudflare D1 database ID"),

  /**
   * Cloudflare Workers environment (production/preview)
   */
  CF_ENVIRONMENT: z
    .enum(["production", "preview", "development"])
    .optional()
    .default("development")
    .describe("Cloudflare Workers environment"),

  /**
   * Cloudflare PubSub Broker URL
   */
  CF_PUBSUB_BROKER_URL: z
    .string()
    .url()
    .optional()
    .describe("Cloudflare PubSub broker URL"),

  /**
   * Cloudflare PubSub JWT
   */
  CF_PUBSUB_JWT: z.string().optional().describe("Cloudflare PubSub JWT token"),
});

export type CfEnv = z.infer<typeof cfEnvSchema>;
