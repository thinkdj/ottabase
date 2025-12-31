/**
 * Health check endpoint
 */

import type { RouteModule } from "../types";
import { json } from "../utils/response";

export const routes: RouteModule["routes"] = [
  {
    path: "/api/health",
    handlers: {
      GET: () => json({ ok: true, name: "ottabase-template-app-tanstack" }),
    },
  },
];
