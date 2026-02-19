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
    onError: (error) => toast.error(error.message),
    onUnauthorized: () => redirect('/login'),
    timeout: 30000,
    dedupe: true,
});
```

### Optional behavior tweaks

### In-flight request deduping

By default, identical in-flight requests are deduped so parallel callers share a single fetch. This is not caching; once
the request completes, the next call will hit the network again.

```ts
// Disable dedupe per request
await api('/api/metrics', { dedupe: false });

// Provide a custom dedupe key
await api('/api/metrics', { dedupeKey: 'metrics:today' });

// Tag deduped logs with a caller id
await api('/api/metrics', { callerId: 'MetricsPage:load' });
```

Use `skipUnauthorizedHandler: true` when you want to handle a 401 response explicitly (`/api/blog/posts/unlock` is one
example). This tells the client not to run the global `onUnauthorized` callback so you can surface a local error message
instead of redirecting to the login screen.

```ts
await api('/api/blog/posts/unlock', {
    method: 'POST',
    body: { slug: 'secret-post', password: 'guess' },
    skipUnauthorizedHandler: true,
});
```

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
    }
}
```
