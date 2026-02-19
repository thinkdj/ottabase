// ============================================================
// @ottabase/notifications
// Minimalistic notifications engine for Ottabase
// ============================================================

/**
 * Multi-channel notification system for Ottabase
 *
 * Features:
 * - Email notifications via @ottabase/email
 * - Real-time WebSocket notifications via @ottabase/cf-realtime
 * - System/admin alerts
 * - Async queue processing via @ottabase/queue
 * - User preference management
 * - OttaORM models for persistence
 *
 * @example
 * ```typescript
 * import { NotificationManager, createEmailChannel } from "@ottabase/notifications";
 *
 * const manager = new NotificationManager({
 *   defaultChannels: ["email", "websocket"],
 *   email: { from: "noreply@example.com" }
 * });
 *
 * await manager.notify({
 *   recipient: { userId: "123", email: "user@example.com" },
 *   payload: {
 *     title: "Welcome!",
 *     message: "Thanks for signing up"
 *   }
 * });
 * ```
 *
 * @packageDocumentation
 */

// Core types
export * from './types';

// Manager
export * from './manager';

// Channels
export * from './channels';

// Models
export * from './models';

// Queue integration
export * from './queue';
