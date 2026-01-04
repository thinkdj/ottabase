# @ottabase/api

Type-safe fetch wrapper with error handling.

## Usage

```typescript
import { api, createApiClient, isApiError } from "@ottabase/api";

// GET (default)
const user = await api<User>("/api/users/me");

// GET with params
const posts = await api<Post[]>("/api/posts", { params: { limit: 10 } });

// POST with body
await api("/api/posts", { method: "POST", body: { title: "Hello" } });

// Shorthand methods
await api("/api/posts/1", "DELETE");
await api("/api/posts/1", "GET");
```

## Custom Client

```typescript
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
try {
  await api("/api/resource");
} catch (error) {
  if (isApiError(error)) {
    console.log(error.status);      // HTTP status code
    console.log(error.code);        // Error code (e.g., "UNAUTHORIZED")
    console.log(error.details);     // Additional context
    console.log(error.hint);        // Actionable suggestion
    console.log(error.fieldErrors); // Form validation errors
  }
}
```
