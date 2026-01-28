# @ottabase/api

Type-safe fetch wrapper with error handling.

## Quick Start

```typescript
import { api } from "@ottabase/api";

// GET
const user = await api<User>("/api/users/me");

// GET with params
const posts = await api<Post[]>("/api/posts", { params: { limit: 10 } });

// POST
await api("/api/posts", { method: "POST", body: { title: "Hello" } });

// Shorthand
await api("/api/posts/1", "DELETE");
```

## Custom Client

```typescript
import { createApiClient } from "@ottabase/api";

const api = createApiClient({
  baseUrl: "/api",
  getAuthToken: () => localStorage.getItem("token"),
  onError: (error) => toast.error(error.message),
  onUnauthorized: () => redirect("/login"),
  timeout: 30000,
});
```

## Error Handling

```typescript
import { api, isApiError, getErrorMessage } from "@ottabase/api";

try {
  await api("/api/resource");
} catch (error) {
  if (isApiError(error)) {
    error.status;       // HTTP status code
    error.code;         // Error code (e.g., "UNAUTHORIZED")
    error.details;      // Additional context
    error.hint;         // Actionable suggestion
    error.fieldErrors;  // Form validation errors { field: ["error"] }
    error.messages;     // All error messages as array

    // Helper methods
    error.isUnauthorized();  // 401
    error.isForbidden();     // 403
    error.isNotFound();      // 404
    error.isRateLimited();   // 429
    error.isServerError();   // 5xx
  }

  // Safe message extraction
  const msg = getErrorMessage(error); // Works with any error type
}
```
