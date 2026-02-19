// ============================================================
// @ottabase/ottaorm - Permission Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { permissionsTable } from './Permission.schema';

export { permissionsTable, type NewPermissionType, type PermissionType } from './Permission.schema';

/**
 * Permission model for RBAC
 *
 * @example
 * ```typescript
 * import { Permission } from "@ottabase/ottaorm/models";
 *
 * // Create permission
 * const permission = await Permission.create({
 *   name: "users:create",
 *   description: "Create new users",
 *   resource: "users",
 *   action: "create"
 * });
 *
 * // Find by name
 * const perm = await Permission.findByName("users:read");
 * ```
 */
export class Permission extends BaseModel {
    static entity = 'permissions';
    static table = permissionsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Permission';
    static displayNamePlural = 'Permissions';
    static defaultSort = 'resource';
    static defaultSortDirection = 'asc' as const;

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
            unique: true,
            uiConfig: {
                label: 'Name',
                description: 'Permission name (format: resource:action)',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|unique:permissions,name',
                messages: {
                    required: 'Permission name is required',
                    unique: 'Permission already exists',
                },
            },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Description',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: true,
            },
        },
        resource: {
            type: 'string',
            editable: true,
            searchable: true,
            filterable: true,
            uiConfig: {
                label: 'Resource',
                description: 'Resource type (e.g., users, posts)',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Resource is required',
                },
            },
        },
        action: {
            type: 'string',
            editable: true,
            searchable: true,
            filterable: true,
            uiConfig: {
                label: 'Action',
                description: 'Action (e.g., create, read, update, delete, manage)',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'create', name: 'Create' },
                    { id: 'read', name: 'Read' },
                    { id: 'update', name: 'Update' },
                    { id: 'delete', name: 'Delete' },
                    { id: 'manage', name: 'Manage' },
                ],
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required',
                messages: {
                    required: 'Action is required',
                },
            },
        },
    };

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Find permission by name
     */
    static async findByName(name: string) {
        return this.first({ name });
    }

    /**
     * Find permissions by resource
     */
    static async findByResource(resource: string) {
        return this.where({ resource });
    }

    /**
     * Find permissions by action
     */
    static async findByAction(action: string) {
        return this.where({ action });
    }

    /**
     * Check if permission matches a pattern
     * Supports wildcards: * matches anything
     * Examples:
     *   users:read matches users:read
     *   users:* matches users:read, users:create, etc.
     *   *:read matches users:read, posts:read, etc.
     *   *:* matches everything
     */
    matches(pattern: string): boolean {
        const name = this.get('name');
        const [patternResource, patternAction] = pattern.split(':');
        const [resource, action] = name.split(':');

        const resourceMatches = patternResource === '*' || patternResource === resource;
        const actionMatches = patternAction === '*' || patternAction === action;

        return resourceMatches && actionMatches;
    }

    /**
     * Seed default permissions
     */
    static async seedDefaultPermissions() {
        const resources = ['users', 'roles', 'permissions', 'audit_logs'];
        const actions = ['create', 'read', 'update', 'delete'];

        const permissions = [];
        for (const resource of resources) {
            for (const action of actions) {
                const name = `${resource}:${action}`;
                const existing = await this.findByName(name);
                if (!existing) {
                    permissions.push(
                        await this.create({
                            name,
                            description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource}`,
                            resource,
                            action,
                        }),
                    );
                }
            }
        }

        return permissions;
    }
}
