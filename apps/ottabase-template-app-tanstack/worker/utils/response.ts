/**
 * Response utilities for Cloudflare Worker handlers
 */

/** Create a JSON response */
export function json(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Parse JSON from request body safely */
export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Standard error response */
export function errorResponse(message: string, status = 400, details?: unknown): Response {
  return json({ error: message, ...(details ? { details } : {}) }, { status });
}

/** Method not allowed response */
export function methodNotAllowed(): Response {
  return json({ error: "Method not allowed" }, { status: 405 });
}

/** Check if request expects HTML response */
export function isHtmlRequest(request: Request): boolean {
  const accept = request.headers.get("Accept");
  return !!accept && accept.includes("text/html");
}
