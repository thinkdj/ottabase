# @ottabase/api

Type-safe fetch wrapper with error handling.

## Usage

```typescript
import { api, createApiClient, isApiError } from '@ottabase/api';

// GET (default)
const user = await api<User>('/api/users/me');

// GET with params
const posts = await api<Post[]>('/api/posts', { params: { limit: 10 } });

// POST with body
await api('/api/posts', { method: 'POST', body: { title: 'Hello' } });

// Shorthand methods
await api('/api/posts/1', 'DELETE');
await api('/api/posts/1', 'GET');
```

## Custom Client

```typescript
const api = createApiClient({
    baseUrl: '/api',
    getAuthToken: () => localStorage.getItem('token'),
    timeout: 30000,
});
```

### One request, one HTTP attempt

The transport deliberately performs exactly one fetch. It does not retry or coalesce requests. A query orchestrator such
as TanStack Query owns safe-read deduplication and retry policy, which guarantees one retry budget and one terminal
error event. Mutation repeat protection belongs on the server behind an explicit idempotency key.

The client is intentionally presentation-free: it normalizes and throws `ApiError`, while a query cache or interaction
boundary decides whether to show a toast, inline message, redirect, or remain silent.

## Error Handling

```typescript
try {
    await api('/api/resource');
} catch (error) {
    if (isApiError(error)) {
        console.log(error.status); // HTTP status code
        console.log(error.code); // Error code (e.g., "UNAUTHORIZED")
        console.log(error.details); // Additional context
        console.log(error.hint); // Actionable suggestion
        console.log(error.fieldErrors); // Form validation errors
        console.log(error.metadata); // Safe machine-readable conflict context
        console.log(error.requestId); // Correlation ID for server-side logs
        console.log(error.retryable); // Safe for a read orchestrator to retry
        console.log(error.retryAfterMs); // Parsed Retry-After delay, when supplied
    }
}
```

Caller cancellation is composed with the request timeout through response-body consumption and preserved as an
`AbortError`; it is never converted into a network failure. Invalid JSON from an otherwise successful response becomes a
non-retryable `INVALID_RESPONSE` error. Malformed error bodies retain their HTTP status and are never misclassified as
network failures.
