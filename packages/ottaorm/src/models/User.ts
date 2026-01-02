// ============================================================
// @ottabase/ottaorm - User Model
// ============================================================

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { BaseModel, IModelConstructorParams, ModelFields } from "../base/BaseModel";

/**
 * User table schema
 */
export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * User model type
 */
export type UserType = typeof usersTable.$inferSelect;
export type NewUserType = typeof usersTable.$inferInsert;

/**
 * User model - Simple fat model example
 *
 * @example
 * ```typescript
 * import { User } from "@ottabase/ottaorm/models";
 *
 * // Find user
 * const user = await User.first({ email: "user@example.com" });
 *
 * // Create user
 * const newUser = await User.create({
 *   name: "John Doe",
 *   email: "john@example.com"
 * });
 *
 * // Get user's posts
 * const posts = await user.posts();
 * ```
 */
export class User extends BaseModel {

  static entity = "users";
  static table = usersTable;
  static primaryKey = "id";

  // UI/Forms metadata
  static displayName = "User";
  static displayNamePlural = "Users";
  static defaultSort = "createdAt";
  static defaultSortDirection = "desc" as const;

  static casts = {
    createdAt: 'date' as const,
    updatedAt: 'date' as const,
  };

  protected static fields: ModelFields = {
    id: {
      type: 'id',
      primaryKey: true,
      editable: false,
      uiConfig: {
        label: 'ID',
      },
    },
    name: {
      type: 'string',
      editable: true,
      searchable: true,
      uiConfig: {
        label: 'Name',
        description: 'User name',
      },
      formConfig: {
        visible: true,
        fieldType: 'input',
      },
      tableConfig: {
        visible: true,
      },
    },
    email: {
      type: 'string',
      editable: true,
      searchable: true,
      unique: true,
      uiConfig: {
        label: 'Email',
        description: 'User email',
      },
      formConfig: {
        visible: true,
        fieldType: 'input',
      },
      tableConfig: {
        visible: true,
      },
      validation: {
        rules: "required|email|unique:users,email",
        messages: {
          required: "Email is required",
          email: "Must be a valid email",
          unique: "Email already exists",
        }
      }
    },
    image: {
      type: 'string',
      editable: true,
      uiConfig: {
        label: 'Profile Image',
      },
      formConfig: {
        visible: true,
        fieldType: 'input',
      },
      tableConfig: {
        visible: false,
      },
    },
  };

  protected static validationRules = {
    "name": {
      rules: "required",
      fieldName: "Name",
      messages: {
        required: "Name is required",
      }
    },
    "email": {
      rules: "required|email|unique:users,email",
      fieldName: "Email",
      messages: {
        required: "Email is required",
        email: "Must be a valid email",
        unique: "Email already exists",
      }
    },
  };

  constructor(data: { [key: string]: any }) {
    const params: IModelConstructorParams = { entity: User.entity, data };
    super(params);
  }

  // ============================================================
  // RELATIONSHIPS
  // ============================================================

  /**
   * Get posts authored by this user (HasMany Post)
   */
  async posts(options?: {
    select?: string[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  }) {
    // Dynamic import
    const { Post } = await import("./Post");

    return this.hasMany(Post, 'authorId', options);
  }

  /**
   * Get authentication accounts for this user (HasMany Account)
   */
  async accounts(options?: {
    select?: string[];
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }) {
    // Dynamic import
    const { Account } = await import("./Account");

    return this.hasMany(Account, 'userId', options);
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Find user by email
   */
  static async findByEmail(email: string) {
    return this.first({ email });
  }

  /**
   * Get user's display name
   */
  getDisplayName(): string {
    return this.get('name') || this.get('email');
  }
}
