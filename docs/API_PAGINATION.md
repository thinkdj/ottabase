# API Pagination Standard

This document describes the standardized pagination format used across all OttaBase API endpoints that return
collections/lists.

## Generic CRUD API

OttaBase provides a **generic CRUD endpoint** that handles all registered models:

```
/api/ottaorm/{model}/{id?}
```

### Supported Operations

| Method   | URL                                                 | Description                                          |
| -------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/ottaorm/posts`                                 | List all (paginated only if `page`/`per_page` given)  |
| `GET`    | `/api/ottaorm/posts/123`                             | Get single by ID                                      |
| `GET`    | `/api/ottaorm/posts?field=slug&value=my-post-slug`   | Get single by field/value                             |
| `POST`   | `/api/ottaorm/posts`                                 | Create new                                            |
| `PATCH`  | `/api/ottaorm/posts/123`                             | Update existing                                       |
| `DELETE` | `/api/ottaorm/posts/123`                             | Delete                                                 |

> **Note:** Not every registered model is reachable through this generic endpoint. A handful —
> `users`, `menus`/`menu_items`, `organization_members`, and `shortlinks` — are explicitly blocked
> (`403 CRUD_DISABLED`) in favor of dedicated, more tightly-scoped routes. Shortlink management,
> for example, lives at `/api/shortlinks`, not `/api/ottaorm/shortlinks`.

## Simplified Pagination Format

We use a clean, flattened structure for pagination responses.

### Response Structure

```typescript
interface PaginatedResponse<T> {
    // Array of items for the current page
    data: T[];

    // Pagination metadata
    pagination: {
        page: number; // Current page number (1-indexed)
        perPage: number; // Items per page
        total: number; // Total items count
        totalPages: number; // Total pages count
        next: string | null; // URL to next page
        prev: string | null; // URL to previous page
    };
}
```

### Example Response

`GET /api/ottaorm/posts?page=1&per_page=15`:

```json
{
    "data": [
        { "id": "1", "slug": "hello-world", "title": "Hello World" },
        { "id": "2", "slug": "second-post", "title": "Second Post" }
    ],
    "pagination": {
        "page": 1,
        "perPage": 15,
        "total": 75,
        "totalPages": 5,
        "next": "/api/ottaorm/posts?page=2&per_page=15",
        "prev": null
    }
}
```

## Query Parameters

The generic CRUD endpoint's `GET` list route supports these query parameters:

| Parameter                   | Type        | Default | Description                                                                                      |
| --------------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------- |
| `page`                      | number      | -       | Page number (1-indexed). Passing `page` and/or `per_page`/`perPage` is what triggers pagination   |
| `per_page` or `perPage`     | number      | 15      | Items per page once paginating (max: 100)                                                         |
| `sort` or `orderBy`         | string      | -       | Field to sort by                                                                                   |
| `order` or `orderDirection` | string      | -       | Sort direction: "asc" or "desc" (ignored unless `sort`/`orderBy` is also set)                     |
| `where`                     | JSON string | -       | Filter conditions as JSON                                                                          |
| `field`                     | string      | -       | Field name for single lookup                                                                       |
| `value`                     | string      | -       | Field value for single lookup                                                                      |

**Pagination is opt-in, and there's no default sort order.** If neither `page` nor
`per_page`/`perPage` is supplied, the endpoint returns *every* matching record in one response —
still wrapped in the same `data`/`pagination` envelope, but with `page: 1`, `perPage: total`, and
`totalPages: 1`. Likewise, if `sort`/`orderBy` is omitted, no `ORDER BY` is applied at all — results
come back in whatever order the database happens to return them, not `createdAt desc`. This differs
from hand-written endpoints like `/api/shortlinks`, which use the shared pagination helper
(`packages/utils/src/pagination.ts`) and always paginate with `createdAt desc` as the default sort.

### Find Single Record by Field/Value

Find a record by any field (useful for slugs, emails, codes, etc.):

```bash
GET /api/ottaorm/posts?field=slug&value=my-post-slug
```

**Response:** Returns the object directly (not wrapped in pagination):

```json
{
    "id": "123",
    "slug": "my-post-slug",
    "title": "My Post",
    "content": "..."
}
```

**Example Client Usage:**

```typescript
import { createModelHooks } from '@ottabase/ottaorm/client';

const postHooks = createModelHooks<Post>({ entityName: 'posts' });

// Find by slug
const { data: post } = postHooks.useFind('slug', 'my-post-slug');
```

### Example Client Usage

```typescript
import type { PaginatedResponse } from '@/lib/api-types';

// Fetch with types
const response = await api<PaginatedResponse<Post>>(`/api/ottaorm/posts?page=1&per_page=15`);

// Access data
const items = response.data;

// Access pagination
const { page, totalPages, total } = response.pagination;

// Navigation
const nextPageUrl = response.pagination.next;
```
