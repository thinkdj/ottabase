// ============================================================
// @ottabase/ottaorm - Generic CRUD Handler
// ============================================================
// Single handler for all model CRUD operations
// ============================================================

import { getModel, hasModel } from "../registry";

export interface CrudRequest {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  model: string;
  id?: string;
  body?: Record<string, unknown>;
  query?: {
    where?: Record<string, unknown>;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    limit?: number;
    offset?: number;
    page?: number;
    perPage?: number;
  };
}

export interface CrudResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  status: number;
}

/**
 * Handle a generic CRUD request for any registered model
 *
 * @example
 * ```typescript
 * // In your API route handler:
 * const result = await handleCrud({
 *   method: "GET",
 *   model: "users",
 *   query: { orderBy: "createdAt", orderDirection: "desc" }
 * });
 *
 * if (!result.success) {
 *   return new Response(JSON.stringify({ error: result.error }), { status: result.status });
 * }
 * return new Response(JSON.stringify(result.data), { status: 200 });
 * ```
 */
export async function handleCrud(request: CrudRequest): Promise<CrudResponse> {
  const { method, model: entityName, id, body, query } = request;

  // Check if model is registered
  if (!hasModel(entityName)) {
    return {
      success: false,
      error: `Model '${entityName}' not found. Make sure to register it with registerModel().`,
      status: 404,
    };
  }

  const Model = getModel(entityName)!;

  try {
    // GET with ID - find single record
    if (method === "GET" && id) {
      const record = await Model.find(id);
      if (!record) {
        return {
          success: false,
          error: `${entityName} with id '${id}' not found`,
          status: 404,
        };
      }
      return {
        success: true,
        data: { [singularize(entityName)]: record.toJson() },
        status: 200,
      };
    }

    // GET without ID - list records
    if (method === "GET") {
      // Check for pagination
      if (query?.page || query?.perPage) {
        const page = query.page || 1;
        const perPage = query.perPage || 15;
        const result = await Model.paginate(
          page,
          perPage,
          query.where,
          { orderBy: query.orderBy, orderDirection: query.orderDirection }
        );
        return {
          success: true,
          data: {
            [entityName]: result.data.map((r: any) => r.toJson()),
            total: result.total,
            page: result.page,
            perPage: result.perPage,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
          },
          status: 200,
        };
      }

      // Regular list
      const records = await Model.where(query?.where || {}, {
        orderBy: query?.orderBy,
        orderDirection: query?.orderDirection,
        limit: query?.limit,
        offset: query?.offset,
      });
      return {
        success: true,
        data: { [entityName]: records.map((r: any) => r.toJson()) },
        status: 200,
      };
    }

    // POST - create new record
    if (method === "POST") {
      if (!body) {
        return {
          success: false,
          error: "Request body is required",
          status: 400,
        };
      }
      const record = await Model.create(body);
      return {
        success: true,
        data: { [singularize(entityName)]: record.toJson() },
        status: 201,
      };
    }

    // PATCH/PUT - update record
    if ((method === "PATCH" || method === "PUT") && id) {
      if (!body) {
        return {
          success: false,
          error: "Request body is required",
          status: 400,
        };
      }
      const record = await Model.update(id, body);
      return {
        success: true,
        data: { [singularize(entityName)]: record.toJson() },
        status: 200,
      };
    }

    // DELETE - delete record
    if (method === "DELETE" && id) {
      await Model.delete(id);
      return {
        success: true,
        data: { success: true, message: `${singularize(entityName)} deleted` },
        status: 200,
      };
    }

    return {
      success: false,
      error: "Invalid request",
      status: 400,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: message,
      status: 500,
    };
  }
}

/**
 * Simple singularize - removes trailing 's'
 */
function singularize(word: string): string {
  if (word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Parse request URL and body into CrudRequest
 *
 * @example
 * ```typescript
 * // In Cloudflare Worker:
 * const crudRequest = await parseCrudRequest(request, url, "/api/ottaorm");
 * if (crudRequest) {
 *   const result = await handleCrud(crudRequest);
 *   return new Response(JSON.stringify(result.data || { error: result.error }), {
 *     status: result.status
 *   });
 * }
 * ```
 */
export async function parseCrudRequest(
  request: Request,
  url: URL,
  basePath: string = "/api/ottaorm"
): Promise<CrudRequest | null> {
  const path = url.pathname;

  // Check if this is a CRUD request
  if (!path.startsWith(basePath + "/")) {
    return null;
  }

  // Extract model and id from path: /api/ottaorm/users/123 -> ["users", "123"]
  const relativePath = path.slice(basePath.length + 1);
  const parts = relativePath.split("/").filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const model = parts[0];
  const id = parts[1];

  // Parse query parameters
  const query: CrudRequest["query"] = {};

  const whereParam = url.searchParams.get("where");
  if (whereParam) {
    try {
      query.where = JSON.parse(whereParam);
    } catch (error) {
      // Log invalid JSON in "where" to aid debugging, but keep behavior lenient
      console.warn('ottaorm: Ignoring invalid JSON in "where" query parameter:', whereParam, error);
    }
  }

  const orderBy = url.searchParams.get("orderBy");
  if (orderBy) query.orderBy = orderBy;

  const orderDirection = url.searchParams.get("orderDirection");
  if (orderDirection === "asc" || orderDirection === "desc") {
    query.orderDirection = orderDirection;
  }

  const limit = url.searchParams.get("limit");
  if (limit) query.limit = parseInt(limit, 10);

  const offset = url.searchParams.get("offset");
  if (offset) query.offset = parseInt(offset, 10);

  const page = url.searchParams.get("page");
  if (page) query.page = parseInt(page, 10);

  const perPage = url.searchParams.get("perPage");
  if (perPage) query.perPage = parseInt(perPage, 10);

  // Parse body for POST/PATCH/PUT
  let body: Record<string, unknown> | undefined;
  if (request.method === "POST" || request.method === "PATCH" || request.method === "PUT") {
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  return {
    method: request.method as CrudRequest["method"],
    model,
    id,
    body,
    query: Object.keys(query).length > 0 ? query : undefined,
  };
}
