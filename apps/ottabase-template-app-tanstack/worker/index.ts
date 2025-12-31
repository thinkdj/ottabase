/**
 * Worker module exports
 *
 * This is the main entry point for worker utilities and router.
 * Route modules are loaded lazily for optimal performance.
 */

export { createRouter, Router } from "./router";
export type { HttpMethod, RouteContext, RouteDefinition, RouteHandler, RouteModule } from "./types";
export { errorResponse, isHtmlRequest, json, methodNotAllowed, readJson } from "./utils/response";
export { checkMigrationAuth, simulateRateLimit } from "./utils/auth";
