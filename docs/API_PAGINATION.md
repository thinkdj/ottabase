# API Pagination Standard

This document describes the standardized pagination format used across all OttaBase API endpoints that return
collections/lists.

## Generic CRUD API

OttaBase provides a **generic CRUD endpoint** that handles all registered models:

```
/api/ottaorm/{model}/{id?}
```

### Supported Operations

| Method   | URL                                                 | Description               |
| -------- | --------------------------------------------------- | ------------------------- |
| `GET`    | `/api/ottaorm/shortlinks`                           | List all (paginated)      |
| `GET`    | `/api/ottaorm/shortlinks/123`                       | Get single by ID          |
| `GET`    | `/api/ottaorm/shortlinks?field=shortCode&value=abc` | Get single by field/value |
| `POST`   | `/api/ottaorm/shortlinks`                           | Create new                |
| `PATCH`  | `/api/ottaorm/shortlinks/123`                       | Update existing           |
| `DELETE` | `/api/ottaorm/shortlinks/123`                       | Delete                    |

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

```json
{
    "data": [
        { "id": "1", "shortCode": "gh", "fullUrl": "https://github.com" },
        { "id": "2", "shortCode": "docs", "fullUrl": "https://docs.example.com" }
    ],
    "pagination": {
        "page": 1,
        "perPage": 15,
        "total": 75,
        "totalPages": 5,
        "next": "/api/ottaorm/shortlinks?page=2&per_page=15",
        "prev": null
    }
}
```

## Query Parameters

All paginated endpoints support these query parameters:

| Parameter                   | Type        | Default   | Description                     |
| --------------------------- | ----------- | --------- | ------------------------------- |
| `page`                      | number      | 1         | Page number (1-indexed)         |
| `per_page` or `perPage`     | number      | 15        | Items per page (max: 100)       |
| `sort` or `orderBy`         | string      | createdAt | Field to sort by                |
| `order` or `orderDirection` | string      | desc      | Sort direction: "asc" or "desc" |
| `where`                     | JSON string | -         | Filter conditions as JSON       |
| `field`                     | string      | -         | Field name for single lookup    |
| `value`                     | string      | -         | Field value for single lookup   |

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
const response = await api<PaginatedResponse<Shortlink>>(`/api/ottaorm/shortlinks?page=1&per_page=15`);

// Access data
const items = response.data;

// Access pagination
const { page, totalPages, total } = response.pagination;

// Navigation
const nextPageUrl = response.pagination.next;
```
