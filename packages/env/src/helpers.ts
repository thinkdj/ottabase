import { z } from "zod";

/**
 * Common Zod helpers for environment variables
 */

/**
 * String that must be a valid URL
 */
export const url = (message?: string) =>
  z.string().url(message ?? "Must be a valid URL");

/**
 * String that must be a valid email
 */
export const email = (message?: string) =>
  z.string().email(message ?? "Must be a valid email");

/**
 * String that represents a port number
 */
export const port = () =>
  z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .describe("Port number between 1 and 65535");

/**
 * Boolean from string ("true" | "false" | "1" | "0")
 */
export const bool = () =>
  z
    .enum(["true", "false", "1", "0"])
    .transform((val) => val === "true" || val === "1")
    .describe("Boolean value (true/false or 1/0)");

/**
 * JSON string that will be parsed
 */
export const json = <T extends z.ZodType>(schema?: T) => {
  const baseSchema = z.string().transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid JSON",
      });
      return z.NEVER;
    }
  });

  return schema ? baseSchema.pipe(schema) : baseSchema;
};

/**
 * Comma-separated list of strings
 */
export const csvList = () =>
  z
    .string()
    .transform((str) =>
      str
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .describe("Comma-separated list of values");

/**
 * Non-empty string
 */
export const nonEmpty = (message?: string) =>
  z.string().min(1, message ?? "Cannot be empty");

/**
 * Positive integer
 */
export const positiveInt = () => z.coerce.number().int().positive();

/**
 * Non-negative integer
 */
export const nonNegativeInt = () => z.coerce.number().int().nonnegative();

/**
 * String that matches a semver version
 */
export const semver = () =>
  z
    .string()
    .regex(
      /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
      "Must be a valid semver version",
    );

/**
 * Database URL (postgres, mysql, sqlite, etc.)
 */
export const databaseUrl = () =>
  z
    .string()
    .url()
    .refine(
      (url) => {
        const protocols = [
          "postgresql://",
          "postgres://",
          "mysql://",
          "sqlite://",
          "file:",
          "mongodb://",
        ];
        return protocols.some((p) => url.startsWith(p));
      },
      {
        message:
          "Must be a valid database URL (postgresql://, mysql://, sqlite://, etc.)",
      },
    );

/**
 * Environment type
 */
export const environment = () =>
  z.enum(["development", "production", "test", "staging"]).default(
    "development",
  );

/**
 * Cloudflare API token (32 or 40 character hex string)
 */
export const cloudflareToken = () =>
  z
    .string()
    .regex(
      /^[A-Za-z0-9_-]{40}$/,
      "Must be a valid Cloudflare API token",
    );

/**
 * Cloudflare Account ID (32 character hex string)
 */
export const cloudflareAccountId = () =>
  z
    .string()
    .regex(/^[a-f0-9]{32}$/, "Must be a valid Cloudflare Account ID");

/**
 * Cloudflare Zone ID (32 character hex string)
 */
export const cloudflareZoneId = () =>
  z.string().regex(/^[a-f0-9]{32}$/, "Must be a valid Cloudflare Zone ID");

/**
 * API key (generic - at least 16 characters)
 */
export const apiKey = () =>
  z.string().min(16, "API key must be at least 16 characters");

/**
 * Secret key (generic - at least 32 characters for security)
 */
export const secretKey = () =>
  z.string().min(32, "Secret key must be at least 32 characters for security");

/**
 * NEXT_PUBLIC_ prefixed variable (for client-side Next.js)
 */
export const nextPublic = <T extends z.ZodType>(schema: T) =>
  schema.describe("Available on client-side (NEXT_PUBLIC_ prefix)");

/**
 * Optional string with default
 */
export const optionalString = (defaultValue: string) =>
  z.string().optional().default(defaultValue);

/**
 * Optional number with default
 */
export const optionalNumber = (defaultValue: number) =>
  z.coerce.number().optional().default(defaultValue);

/**
 * Optional boolean with default
 */
export const optionalBool = (defaultValue: boolean) =>
  bool().optional().default(defaultValue ? "true" : "false");

/**
 * Helper to create a prefixed schema (e.g., for NEXT_PUBLIC_)
 */
export function withPrefix<T extends z.ZodRawShape>(
  prefix: string,
  shape: T,
): z.ZodObject<T> {
  const prefixedShape = Object.entries(shape).reduce(
    (acc, [key, schema]) => {
      acc[`${prefix}${key}`] = schema;
      return acc;
    },
    {} as Record<string, z.ZodType>,
  ) as T;

  return z.object(prefixedShape);
}
