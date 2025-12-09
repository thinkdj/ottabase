/**
 * Templates for generating migration files
 */

export interface MigrationTemplateData {
  name: string;
  feature: string;
  timestamp: number;
  sql?: string;
  tableName?: string;
}

/**
 * Generate a blank migration template
 */
export function generateBlankMigration(data: MigrationTemplateData): string {
  return `// Migration: ${data.name}
// Feature: ${data.feature}
// Generated: ${new Date(data.timestamp).toISOString()}

export interface MigrationDatabase {
  run(sql: string): Promise<void>;
  exec(sql: string): Promise<void>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

export default {
  name: "${data.name}",
  feature: "${data.feature}",

  async up(db: MigrationDatabase): Promise<void> {
    // TODO: Add migration logic here
    // Example:
    // await db.run(\`
    //   CREATE TABLE example (
    //     id TEXT PRIMARY KEY,
    //     name TEXT NOT NULL
    //   )
    // \`);
  },

  async down(db: MigrationDatabase): Promise<void> {
    // TODO: Add rollback logic here
    // Example:
    // await db.run('DROP TABLE IF EXISTS example');
  }
};
`;
}

/**
 * Generate a migration for creating a table
 */
export function generateCreateTableMigration(data: MigrationTemplateData): string {
  if (!data.sql) {
    throw new Error('SQL is required for create table migration');
  }

  return `// Migration: ${data.name}
// Feature: ${data.feature}
// Generated: ${new Date(data.timestamp).toISOString()}

export interface MigrationDatabase {
  run(sql: string): Promise<void>;
  exec(sql: string): Promise<void>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

export default {
  name: "${data.name}",
  feature: "${data.feature}",

  async up(db: MigrationDatabase): Promise<void> {
    await db.exec(\`${data.sql.replace(/`/g, '\\`')}\`);
  },

  async down(db: MigrationDatabase): Promise<void> {
    ${data.tableName ? `await db.run('DROP TABLE IF EXISTS ${data.tableName}');` : '// TODO: Add rollback logic'}
  }
};
`;
}

/**
 * Generate a data migration template
 */
export function generateDataMigration(data: MigrationTemplateData): string {
  return `// Migration: ${data.name}
// Feature: ${data.feature}
// Type: Data Migration
// Generated: ${new Date(data.timestamp).toISOString()}

export interface MigrationDatabase {
  run(sql: string): Promise<void>;
  exec(sql: string): Promise<void>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

export default {
  name: "${data.name}",
  feature: "${data.feature}",

  async up(db: MigrationDatabase): Promise<void> {
    // Example: Update existing data
    // await db.run(\`
    //   UPDATE users
    //   SET role = 'user'
    //   WHERE role IS NULL
    // \`);
  },

  async down(db: MigrationDatabase): Promise<void> {
    // Example: Revert data changes
    // await db.run(\`
    //   UPDATE users
    //   SET role = NULL
    //   WHERE role = 'user'
    // \`);
  }
};
`;
}
