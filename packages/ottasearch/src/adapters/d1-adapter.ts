/**
 * D1 Database search adapter
 * Integrates with @ottabase/cf for Cloudflare D1 database searches
 */

import type { D1Client } from '@ottabase/cf/d1';
import type { SearchAdapter, SearchResult, SearchOptions } from '../types';

/**
 * Table configuration for D1 search
 */
export interface D1TableConfig {
  /** Table name in the database */
  name: string;
  /** Fields to search in (for WHERE clause) */
  searchFields: string[];
  /** Fields to display in results */
  displayFields?: string[];
  /** Field to use as title (defaults to first displayField or 'name') */
  titleField?: string;
  /** Field to use as description (optional) */
  descriptionField?: string;
  /** Field to use as ID (defaults to 'id') */
  idField?: string;
  /** Category name for this table (defaults to table name) */
  category?: string;
  /** Icon name from lucide-react */
  icon?: string;
  /** URL template with {id} placeholder */
  urlTemplate?: string;
  /** Custom WHERE clause builder */
  customWhere?: (query: string, params: any[]) => { where: string; params: any[] };
}

/**
 * D1 search adapter configuration
 */
export interface D1AdapterConfig {
  /** D1 client instance from @ottabase/cf */
  d1Client: D1Client;
  /** Tables to search */
  tables: D1TableConfig[];
  /** Use FTS5 for full-text search (requires FTS5 virtual tables) */
  useFTS?: boolean;
  /** Default limit for results */
  defaultLimit?: number;
  /** Case-insensitive search (default: true) */
  caseInsensitive?: boolean;
}

/**
 * Create a D1 search adapter
 */
export function createD1SearchAdapter(config: D1AdapterConfig): SearchAdapter {
  const {
    d1Client,
    tables,
    useFTS = false,
    defaultLimit = 50,
    caseInsensitive = true,
  } = config;

  const adapter: SearchAdapter = {
    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
      // If empty query, return empty results
      if (!query.trim()) {
        return [];
      }

      const limit = options?.limit || defaultLimit;
      const offset = options?.offset || 0;
      const categoryFilter = options?.categories || [];

      // Filter tables by category if specified
      const searchTables =
        categoryFilter.length > 0
          ? tables.filter((t) =>
              categoryFilter.includes(t.category || t.name)
            )
          : tables;

      // Search each table and combine results
      const allResults: SearchResult[] = [];

      for (const table of searchTables) {
        try {
          const results = await searchTable(
            d1Client,
            table,
            query,
            caseInsensitive,
            useFTS
          );
          allResults.push(...results);
        } catch (error) {
          console.error(`Error searching table ${table.name}:`, error);
          // Continue searching other tables
        }
      }

      // Apply limit and offset
      return allResults.slice(offset, offset + limit);
    },
  };

  return adapter;
}

/**
 * Search a single table
 */
async function searchTable(
  d1Client: D1Client,
  table: D1TableConfig,
  query: string,
  caseInsensitive: boolean,
  useFTS: boolean
): Promise<SearchResult[]> {
  const {
    name,
    searchFields,
    displayFields = ['*'],
    titleField,
    descriptionField,
    idField = 'id',
    category,
    icon,
    urlTemplate,
    customWhere,
  } = table;

  // Build SQL query
  let sql: string;
  let params: any[] = [];

  if (useFTS) {
    // FTS5 full-text search
    // Assumes FTS5 virtual table named {table}_fts
    sql = `
      SELECT ${displayFields.join(', ')}
      FROM ${name}
      WHERE ${idField} IN (
        SELECT rowid FROM ${name}_fts WHERE ${name}_fts MATCH ?
      )
      LIMIT 20
    `;
    params = [query];
  } else {
    // Regular LIKE search
    if (customWhere) {
      const whereResult = customWhere(query, params);
      sql = `
        SELECT ${displayFields.join(', ')}
        FROM ${name}
        WHERE ${whereResult.where}
        LIMIT 20
      `;
      params = whereResult.params;
    } else {
      // Build WHERE clause with OR conditions for each search field
      const searchPattern = caseInsensitive
        ? `%${query.toLowerCase()}%`
        : `%${query}%`;

      const whereConditions = searchFields
        .map((field) => {
          if (caseInsensitive) {
            return `LOWER(${field}) LIKE ?`;
          }
          return `${field} LIKE ?`;
        })
        .join(' OR ');

      sql = `
        SELECT ${displayFields.join(', ')}
        FROM ${name}
        WHERE ${whereConditions}
        LIMIT 20
      `;

      params = Array(searchFields.length).fill(searchPattern);
    }
  }

  // Execute query
  const result = await d1Client.query<any>(sql, params);

  if (!result.success) {
    throw new Error(`D1 query failed: ${result.error?.message}`);
  }

  // Transform results to SearchResult format
  const searchResults: SearchResult[] = result.data.map((row) => {
    // Determine title field
    const title = titleField
      ? String(row[titleField] || '')
      : String(row[displayFields[0]] || row.name || row.title || '');

    // Determine description field
    const description = descriptionField
      ? String(row[descriptionField] || '')
      : undefined;

    // Determine ID
    const id = String(row[idField] || row.id || '');

    // Build URL from template
    const url = urlTemplate ? urlTemplate.replace('{id}', id) : undefined;

    return {
      id,
      title,
      description,
      category: category || name,
      icon,
      url,
      metadata: row,
    };
  });

  return searchResults;
}

/**
 * Helper to create FTS5 virtual table
 * Call this during database setup to enable full-text search
 */
export function createFTS5TableSQL(
  tableName: string,
  searchFields: string[]
): string {
  return `
    CREATE VIRTUAL TABLE IF NOT EXISTS ${tableName}_fts
    USING fts5(${searchFields.join(', ')}, content=${tableName}, content_rowid=id);

    -- Populate FTS table
    INSERT INTO ${tableName}_fts(rowid, ${searchFields.join(', ')})
    SELECT id, ${searchFields.join(', ')} FROM ${tableName};

    -- Triggers to keep FTS table in sync
    CREATE TRIGGER IF NOT EXISTS ${tableName}_fts_insert AFTER INSERT ON ${tableName} BEGIN
      INSERT INTO ${tableName}_fts(rowid, ${searchFields.join(', ')})
      VALUES (new.id, ${searchFields.map((f) => `new.${f}`).join(', ')});
    END;

    CREATE TRIGGER IF NOT EXISTS ${tableName}_fts_delete AFTER DELETE ON ${tableName} BEGIN
      DELETE FROM ${tableName}_fts WHERE rowid = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS ${tableName}_fts_update AFTER UPDATE ON ${tableName} BEGIN
      UPDATE ${tableName}_fts
      SET ${searchFields.map((f) => `${f} = new.${f}`).join(', ')}
      WHERE rowid = new.id;
    END;
  `;
}
