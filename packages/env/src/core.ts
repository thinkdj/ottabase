import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import pc from "picocolors";
import type { EnvConfig, EnvVarMetadata, EnvValidationResult } from "./types";

/**
 * Creates a type-safe environment object with Zod validation
 *
 * @example
 * ```ts
 * import { createEnv } from "@ottabase/env";
 * import { z } from "zod";
 *
 * export const env = createEnv({
 *   schema: z.object({
 *     DATABASE_URL: z.string().url(),
 *     PORT: z.coerce.number().default(3000),
 *   }),
 *   packageName: "@ottabase/db",
 * });
 * ```
 */
export function createEnv<T extends z.ZodType>(
  config: EnvConfig<T>,
): z.infer<T> {
  const {
    schema,
    env = process.env,
    skipValidation = false,
    onValidationError,
    stripUnknown = false,
    prefix,
    packageName,
  } = config;

  // Skip validation for build-time or when explicitly requested
  if (skipValidation || process.env.SKIP_ENV_VALIDATION === "true") {
    console.warn(
      pc.yellow(
        `⚠️  Skipping environment validation${packageName ? ` for ${packageName}` : ""}`,
      ),
    );
    return env as z.infer<T>;
  }

  // Apply prefix if specified
  let envToValidate = env;
  if (prefix) {
    envToValidate = Object.entries(env).reduce(
      (acc, [key, value]) => {
        if (key.startsWith(prefix)) {
          const newKey = key.slice(prefix.length);
          acc[newKey] = value;
        }
        return acc;
      },
      {} as Record<string, string | undefined>,
    );
  }

  try {
    const parsed = schema.parse(envToValidate);

    if (packageName) {
      console.log(pc.green(`✓ ${packageName} environment variables validated`));
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (onValidationError) {
        onValidationError(error);
      }

      const validationError = fromZodError(error, {
        prefix: packageName
          ? `Environment validation failed for ${packageName}`
          : "Environment validation failed",
        prefixSeparator: "\n",
        issueSeparator: "\n",
      });

      console.error(pc.red("\n❌ Environment validation failed\n"));
      console.error(validationError.toString());
      console.error(
        pc.yellow(
          "\n💡 Tip: Check your .env file or environment variables.\n",
        ),
      );

      if (packageName) {
        console.error(
          pc.cyan(`📦 Package: ${packageName}\n`),
        );
      }

      process.exit(1);
    }

    throw error;
  }
}

/**
 * Validates environment variables and returns detailed results with metadata
 */
export function validateEnv<T extends z.ZodType>(
  config: EnvConfig<T>,
): EnvValidationResult<z.infer<T>> {
  const data = createEnv(config);
  const metadata = extractMetadata(config.schema, config.prefix);

  return {
    data,
    metadata,
    skipped:
      config.skipValidation === true ||
      process.env.SKIP_ENV_VALIDATION === "true",
  };
}

/**
 * Extracts metadata from a Zod schema for documentation
 */
export function extractMetadata(
  schema: z.ZodType,
  prefix?: string,
): EnvVarMetadata[] {
  const metadata: EnvVarMetadata[] = [];

  // Handle ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const name = prefix ? `${prefix}${key}` : key;
      metadata.push(extractFieldMetadata(name, value as z.ZodType));
    }
  }

  return metadata;
}

/**
 * Extracts metadata for a single field
 */
function extractFieldMetadata(name: string, schema: z.ZodType): EnvVarMetadata {
  let required = true;
  let defaultValue: string | undefined;
  let type: EnvVarMetadata["type"] = "string";
  let enumValues: string[] | undefined;
  let description: string | undefined;

  // Unwrap optional/default schemas
  let currentSchema = schema;

  if (currentSchema instanceof z.ZodOptional) {
    required = false;
    currentSchema = currentSchema._def.innerType;
  }

  if (currentSchema instanceof z.ZodDefault) {
    required = false;
    defaultValue = String(currentSchema._def.defaultValue());
    currentSchema = currentSchema._def.innerType;
  }

  // Extract description if available
  if (currentSchema.description) {
    description = currentSchema.description;
  }

  // Determine type
  if (currentSchema instanceof z.ZodString) {
    if (currentSchema._def.checks.some((c) => c.kind === "url")) {
      type = "url";
    } else if (currentSchema._def.checks.some((c) => c.kind === "email")) {
      type = "email";
    } else {
      type = "string";
    }
  } else if (currentSchema instanceof z.ZodNumber) {
    type = "number";
  } else if (currentSchema instanceof z.ZodBoolean) {
    type = "boolean";
  } else if (currentSchema instanceof z.ZodEnum) {
    type = "enum";
    enumValues = currentSchema._def.values;
  } else if (
    currentSchema instanceof z.ZodObject ||
    currentSchema instanceof z.ZodArray
  ) {
    type = "json";
  }

  // Handle coercion
  if (currentSchema instanceof z.ZodEffects) {
    const inner = currentSchema._def.schema;
    if (inner instanceof z.ZodNumber) {
      type = "number";
    } else if (inner instanceof z.ZodBoolean) {
      type = "boolean";
    }
  }

  return {
    name,
    description,
    required,
    defaultValue,
    type,
    enumValues,
  };
}

/**
 * Merges multiple environment objects (useful for composing env from multiple packages)
 */
export function mergeEnv<T extends Record<string, unknown>>(
  ...envs: T[]
): T {
  return Object.assign({}, ...envs) as T;
}

/**
 * Gets an environment variable with type safety
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(
      `Environment variable ${key} is not defined. ` +
        `Set it in your .env file or environment.`,
    );
  }
  return value ?? defaultValue ?? "";
}

/**
 * Checks if running in a specific environment
 */
export const isDev = ["dev", "development"].includes(
  process.env.NODE_ENV?.toLowerCase() ?? "",
);
export const isProd = ["prod", "production"].includes(
  process.env.NODE_ENV?.toLowerCase() ?? "",
);
export const isTest = ["test", "testing"].includes(
  process.env.NODE_ENV?.toLowerCase() ?? "",
);
export const isStaging = ["stage", "staging"].includes(
  process.env.NODE_ENV?.toLowerCase() ?? "",
);
export const isCI = Boolean(
  process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI,
);
