import type { z } from "zod";

/**
 * Configuration options for environment validation
 */
export interface EnvConfig<T extends z.ZodType> {
  /**
   * Zod schema for validation
   */
  schema: T;

  /**
   * Environment variables to validate (defaults to process.env)
   */
  env?: Record<string, string | undefined>;

  /**
   * Whether to skip validation (useful for build-time)
   */
  skipValidation?: boolean;

  /**
   * Custom error handler
   */
  onValidationError?: (error: z.ZodError) => never;

  /**
   * Whether to strip unknown env vars (defaults to true)
   */
  stripUnknown?: boolean;

  /**
   * Prefix for environment variables (e.g., "NEXT_PUBLIC_")
   */
  prefix?: string;

  /**
   * Package name for error messages
   */
  packageName?: string;
}

/**
 * Metadata for an environment variable
 */
export interface EnvVarMetadata {
  /**
   * Variable name
   */
  name: string;

  /**
   * Description of what this variable is for
   */
  description?: string;

  /**
   * Whether this variable is required
   */
  required: boolean;

  /**
   * Default value if not required
   */
  defaultValue?: string;

  /**
   * Example value
   */
  example?: string;

  /**
   * Type of the variable
   */
  type: "string" | "number" | "boolean" | "url" | "email" | "json" | "enum";

  /**
   * Possible values for enum types
   */
  enumValues?: string[];

  /**
   * Which package requires this variable
   */
  package?: string;
}

/**
 * Result of env validation with metadata
 */
export interface EnvValidationResult<T> {
  /**
   * Validated environment variables
   */
  data: T;

  /**
   * Metadata about all variables
   */
  metadata: EnvVarMetadata[];

  /**
   * Whether validation was skipped
   */
  skipped: boolean;
}
