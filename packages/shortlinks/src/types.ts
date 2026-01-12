import type { Shortlink, NewShortlink } from "./schema";

export type { Shortlink, NewShortlink };

/**
 * Shortlink type enum for categorization
 */
export const ShortlinkTypes = {
  REDIRECT: "redirect",
  TRACKING: "tracking",
  INTERNAL: "internal",
  EXTERNAL: "external",
} as const;

export type ShortlinkType = typeof ShortlinkTypes[keyof typeof ShortlinkTypes];

/**
 * Request payload for creating a new shortlink
 */
export interface CreateShortlinkRequest {
  fullUrl: string;
  shortCode: string;
  type?: ShortlinkType;
  appName?: string;
  expiryDate?: Date | null;
}

/**
 * Request payload for updating an existing shortlink
 */
export interface UpdateShortlinkRequest {
  fullUrl?: string;
  shortCode?: string;
  type?: ShortlinkType;
  expiryDate?: Date | null;
}

/**
 * Response for shortlink operations
 */
export interface ShortlinkResponse {
  success: boolean;
  data?: Shortlink;
  error?: string;
}

/**
 * Response for list operations
 */
export interface ShortlinksListResponse {
  success: boolean;
  data?: Shortlink[];
  total?: number;
  error?: string;
}
