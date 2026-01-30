// ============================================================
// @ottabase/ottaselect - OttaORM Integration
// ============================================================

import type { OttaSelectInputItem } from './components/OttaSelect';

/**
 * Configuration for creating a model fetcher for OttaSelect
 */
export interface ModelFetcherConfig {
    /**
     * The ottaorm model entity name (e.g., 'posts', 'users', 'tags')
     */
    entity: string;

    /**
     * Optional custom API endpoint
     * @default `/api/ottaorm/${entity}`
     */
    apiEndpoint?: string;

    /**
     * Field to use as the display label
     * OttaSelect will look for this field first, then fall back to 'name', 'label', or 'title'
     * @default 'name'
     */
    labelField?: string;

    /**
     * Field to use as the value/id
     * @default 'id'
     */
    valueField?: string;

    /**
     * Fields to search on
     * If not provided, will search on the labelField
     * Multiple fields can be provided for broader search
     */
    searchFields?: string[];

    /**
     * Additional filter conditions to apply
     * Example: { status: 'published' }
     */
    where?: Record<string, any>;

    /**
     * Number of items to fetch per request
     * @default 50
     */
    limit?: number;

    /**
     * Field to order by
     * @default labelField
     */
    orderBy?: string;

    /**
     * Order direction
     * @default 'asc'
     */
    orderDirection?: 'asc' | 'desc';

    /**
     * Custom headers to send with the request
     */
    headers?: Record<string, string>;

    /**
     * Custom fetch options
     */
    fetchOptions?: RequestInit;
}

/**
 * Creates a fetchCollection function for OttaSelect from an ottaorm model configuration
 *
 * This enables direct integration between OttaSelect and OttaORM models without
 * needing to manually write API fetching logic.
 *
 * @example
 * ```tsx
 * import { OttaSelect } from '@ottabase/ottaselect';
 * import { createModelFetcher } from '@ottabase/ottaselect/ottaorm';
 *
 * // Simple usage with defaults
 * const UserSelect = () => {
 *   const [user, setUser] = useState(null);
 *
 *   return (
 *     <OttaSelect
 *       value={user}
 *       onChange={setUser}
 *       fetchCollection={createModelFetcher({ entity: 'users' })}
 *     />
 *   );
 * };
 *
 * // Advanced usage with custom configuration
 * const PostSelect = () => {
 *   const [post, setPost] = useState(null);
 *
 *   return (
 *     <OttaSelect
 *       value={post}
 *       onChange={setPost}
 *       fetchCollection={createModelFetcher({
 *         entity: 'posts',
 *         labelField: 'title',
 *         searchFields: ['title', 'excerpt'],
 *         where: { status: 'published' },
 *         orderBy: 'publishedAt',
 *         orderDirection: 'desc',
 *       })}
 *     />
 *   );
 * };
 * ```
 *
 * @param config - Configuration for the model fetcher
 * @returns A fetchCollection function compatible with OttaSelect
 */
export function createModelFetcher(config: ModelFetcherConfig): (searchQuery: string) => Promise<OttaSelectInputItem[]> {
    const {
        entity,
        apiEndpoint = `/api/ottaorm/${entity}`,
        labelField = 'name',
        valueField = 'id',
        searchFields = [labelField],
        where = {},
        limit = 50,
        orderBy = labelField,
        orderDirection = 'asc',
        headers = {},
        fetchOptions = {},
    } = config;

    return async (searchQuery: string): Promise<OttaSelectInputItem[]> => {
        try {
            // Build query parameters
            const params = new URLSearchParams();

            // Add search query if provided
            if (searchQuery) {
                // If multiple search fields, we'll use OR logic
                // The API should support this format
                searchFields.forEach((field) => {
                    params.append(`search[${field}]`, searchQuery);
                });
            }

            // Add where conditions
            for (const key in where) {
                if (Object.prototype.hasOwnProperty.call(where, key)) {
                    params.append(`where[${key}]`, String(where[key]));
                }
            }

            // Add pagination and ordering
            params.append('limit', String(limit));
            params.append('orderBy', orderBy);
            params.append('orderDirection', orderDirection);

            // Construct the full URL
            const url = `${apiEndpoint}?${params.toString()}`;

            // Make the fetch request
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                ...fetchOptions,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${entity}: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle different response formats
            // The API might return { data: [...] } or just [...]
            const items = Array.isArray(data) ? data : data.data || [];

            // Map items to ensure they have the expected format
            // OttaSelect will normalize them, but we can help by setting the right field as 'name'
            return items.map((item: any) => {
                // If labelField is not 'name', add 'name' property
                if (labelField !== 'name' && item[labelField]) {
                    return {
                        ...item,
                        name: item[labelField],
                        // Keep the original field too
                        [labelField]: item[labelField],
                    };
                }
                return item;
            });
        } catch (error) {
            console.error(`Error fetching ${entity}:`, error);
            throw error;
        }
    };
}

/**
 * Type helper for model fetcher configurations
 * This can be used to create type-safe configurations
 */
export type { ModelFetcherConfig as OttaORMConfig };
