export function getCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  } as const;
}

export function withCorsHeaders(
  response: Response,
  headers: Record<string, string>,
) {
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function handleOptions(request: Request) {
  if (request.method !== "OPTIONS") return null;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  const headers = getCorsHeaders(request);
  return new Response(null, {
    status: 204,
    headers,
  });
}
