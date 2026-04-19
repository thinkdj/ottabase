// ============================================================
// @ottabase/ottaorm - Organization (Tenant) model
// ============================================================

import type { DbDriver } from '@ottabase/db/drizzle';
import { D1Driver } from '@ottabase/db/drizzle-d1';
import { eq, sql } from 'drizzle-orm';
import { BaseModel, type ModelFields, type PackageType } from '../base/BaseModel';
import { organizationsTable, type NewOrganizationType, type OrganizationType } from './Organization.schema';
import { organizationMembersTable } from './OrganizationMember.schema';

export type OrganizationPlanValue = 'free' | 'pro' | 'enterprise';
export type OrganizationStatusValue = 'active' | 'suspended' | 'cancelled';

interface CreateWithOwnerOptions {
    name: string;
    ownerId: string;
    slug?: string;
    plan?: OrganizationPlanValue;
    status?: OrganizationStatusValue;
    settings?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    membershipRole?: 'owner' | 'admin' | 'member';
    membershipStatus?: 'active' | 'invited' | 'suspended';
    invitedBy?: string | null;
    invitedAt?: number | null;
    joinedAt?: number;
    membershipMetadata?: Record<string, unknown>;
    enforceUniqueName?: boolean;
}

/**
 * Organization (Tenant) model
 * Top-level entity for multi-tenant SaaS
 */
export class Organization extends BaseModel {
    static entity = 'organizations';
    static table = organizationsTable;
    static primaryKey = 'id';
    static connection = 'default';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Organization';
    static displayNamePlural = 'Organizations';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        settings: 'json' as const,
        metadata: 'json' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
                description: 'Unique organization identifier',
            },
            tableConfig: {
                visible: true,
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Name',
                description: 'Organization name',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
                placeholder: 'Enter organization name',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|min:2|max:100',
                messages: {
                    required: 'Organization name is required',
                    min: 'Name must be at least 2 characters',
                    max: 'Name cannot exceed 100 characters',
                },
            },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Slug',
                description: 'URL-friendly identifier',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
                placeholder: 'organization-slug',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required|min:2|max:50|alpha_dash',
                messages: {
                    required: 'Slug is required',
                    alpha_dash: 'Slug can only contain letters, numbers, dashes and underscores',
                },
            },
        },
        ownerId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Owner',
                description: 'Organization owner user ID',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        plan: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Plan',
                description: 'Subscription plan',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'free', name: 'Free' },
                    { id: 'pro', name: 'Pro' },
                    { id: 'enterprise', name: 'Enterprise' },
                ],
            },
            tableConfig: {
                visible: true,
            },
        },
        status: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Status',
                description: 'Organization status',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'active', name: 'Active' },
                    { id: 'suspended', name: 'Suspended' },
                    { id: 'cancelled', name: 'Cancelled' },
                ],
            },
            tableConfig: {
                visible: true,
            },
        },
        settings: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Settings',
                description: 'Organization settings (JSON)',
            },
            formConfig: {
                visible: false,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        metadata: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Metadata',
                description: 'Additional metadata (JSON)',
            },
            formConfig: {
                visible: false,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Created At',
            },
            tableConfig: {
                visible: true,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            uiConfig: {
                label: 'Updated At',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    /**
     * Create a new organization
     */
    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        // Generate slug from name if not provided
        if (!data.slug && data.name) {
            data.slug = Organization.generateSlug(data.name);
        }

        // Call parent create method
        return (await super.create.call(this, data, driver)) as InstanceType<T>;
    }

    /**
     * Create an organization and its initial owner membership in one atomic batch when D1 is available.
     */
    static async createWithOwner(options: CreateWithOwnerOptions): Promise<Organization> {
        const name = this.normalizeName(options.name);
        const ownerId = String(options.ownerId || '').trim();
        const slug = this.normalizeSlug(options.slug || name);
        const plan = this.normalizePlan(options.plan);
        const status = this.normalizeStatus(options.status);
        const joinedAt = Number.isFinite(options.joinedAt) ? Number(options.joinedAt) : Date.now();
        const invitedAt =
            options.invitedAt === null || options.invitedAt === undefined
                ? null
                : Number.isFinite(options.invitedAt)
                  ? Number(options.invitedAt)
                  : null;

        if (name.length < 2 || name.length > 100) {
            throw new Error('Organization name must be 2-100 characters');
        }

        if (!ownerId) {
            throw new Error('Owner id is required');
        }

        if (!this.isValidSlug(slug)) {
            throw new Error('Organization slug must be lowercase letters, numbers, and hyphens (2-100 chars)');
        }

        if (await this.isSlugTaken(slug)) {
            throw new Error('Organization slug already exists');
        }

        if (options.enforceUniqueName !== false && (await this.isNameTaken(name))) {
            throw new Error('Organization name already exists');
        }

        const payload = {
            id: `org-${crypto.randomUUID()}`,
            name,
            slug,
            ownerId,
            plan,
            status,
            settings: options.settings ?? {},
            metadata: options.metadata ?? {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const membershipRole = options.membershipRole ?? 'owner';
        const membershipStatus = options.membershipStatus ?? 'active';
        const membershipMetadata = options.membershipMetadata ?? null;
        const driver = this.getDriver();

        if (driver instanceof D1Driver) {
            const d1 = driver.getD1();

            await d1.batch([
                d1
                    .prepare(
                        `INSERT INTO organizations (
                        id, name, slug, owner_id, plan, status, settings, metadata, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        payload.id,
                        payload.name,
                        payload.slug,
                        payload.ownerId,
                        payload.plan,
                        payload.status,
                        JSON.stringify(payload.settings),
                        JSON.stringify(payload.metadata),
                        payload.createdAt,
                        payload.updatedAt,
                    ),
                d1
                    .prepare(
                        `INSERT INTO organization_members (
                        user_id, organization_id, role, status, invited_by, invited_at, joined_at, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        ownerId,
                        payload.id,
                        membershipRole,
                        membershipStatus,
                        options.invitedBy ?? ownerId,
                        invitedAt,
                        joinedAt,
                        membershipMetadata ? JSON.stringify(membershipMetadata) : null,
                    ),
            ]);

            const created = (await this.find(payload.id)) as Organization | undefined;
            if (!created) {
                throw new Error('Created organization could not be loaded');
            }
            return created;
        }

        let createdOrg: Organization | null = null;

        try {
            createdOrg = (await this.create(payload)) as Organization;
            const { OrganizationMember } = await import('./OrganizationMember');
            await OrganizationMember.create({
                userId: ownerId,
                organizationId: payload.id,
                role: membershipRole,
                status: membershipStatus,
                invitedBy: options.invitedBy ?? ownerId,
                invitedAt,
                joinedAt,
                metadata: membershipMetadata,
            } as Record<string, unknown>);
            return createdOrg;
        } catch (error) {
            if (createdOrg) {
                await this.delete(String(createdOrg.get('id'))).catch(() => false);
            }
            throw error;
        }
    }

    /**
     * Find organization by slug
     */
    static async findBySlug(slug: string): Promise<OrganizationType | undefined> {
        const db = this.getDriver().getDb();

        const [organization] = await db
            .select()
            .from(organizationsTable)
            .where(eq(organizationsTable.slug, slug))
            .limit(1);

        return organization;
    }

    /**
     * Find organization by case-insensitive name match.
     */
    static async findByNameInsensitive(name: string): Promise<OrganizationType | undefined> {
        const normalizedName = this.normalizeName(name);
        if (!normalizedName) return undefined;

        const db = this.getDriver().getDb();
        const [organization] = await db
            .select()
            .from(organizationsTable)
            .where(sql`lower(${organizationsTable.name}) = lower(${normalizedName})`)
            .limit(1);

        return organization;
    }

    static async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
        const existing = await this.findBySlug(this.normalizeSlug(slug));
        return !!existing && (!excludeId || existing.id !== excludeId);
    }

    static async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
        const existing = await this.findByNameInsensitive(name);
        return !!existing && (!excludeId || existing.id !== excludeId);
    }

    /**
     * Update organization
     */
    static async update<T extends typeof BaseModel>(
        this: T,
        id: string,
        data: Record<string, any>,
        driver?: any,
    ): Promise<InstanceType<T>> {
        // Update updatedAt timestamp
        data.updatedAt = Date.now();

        // Call parent update method
        return (await super.update.call(this, id, data, driver)) as InstanceType<T>;
    }

    /**
     * Update organization settings
     */
    static async updateSettings(id: string, settings: Record<string, any>): Promise<Organization> {
        return (await this.update(id, { settings })) as Organization;
    }

    /**
     * Update organization status
     */
    static async updateStatus(id: string, status: 'active' | 'suspended' | 'cancelled'): Promise<Organization> {
        return (await this.update(id, { status })) as Organization;
    }

    static normalizePlan(plan?: unknown): OrganizationPlanValue {
        return plan === 'pro' || plan === 'enterprise' || plan === 'free' ? plan : 'free';
    }

    static normalizeStatus(status?: unknown): OrganizationStatusValue {
        return status === 'suspended' || status === 'cancelled' || status === 'active' ? status : 'active';
    }

    static normalizeName(name: string): string {
        return String(name || '')
            .trim()
            .replace(/\s+/g, ' ');
    }

    static normalizeSlug(input: string): string {
        return this.generateSlug(String(input || ''));
    }

    static isValidSlug(slug: string): boolean {
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 100;
    }

    // ============================================================
    // Validation helpers — keep route layer thin (Fat Model).
    // Returns discriminated union so callers can map 1:1 onto
    // errorResponse without re-implementing shape rules here.
    // ============================================================

    /**
     * Validate and normalize a create-organization payload.
     * Does NOT hit the database; pure input hygiene.
     */
    static validateCreateInput(input: { name?: unknown; slug?: unknown; plan?: unknown; status?: unknown }):
        | {
              ok: true;
              payload: {
                  name: string;
                  slug: string;
                  plan: OrganizationPlanValue;
                  status: OrganizationStatusValue;
              };
          }
        | { ok: false; code: 'VALIDATION_ERROR'; message: string; fieldErrors: Record<string, string[]> } {
        const name = this.normalizeName(String(input.name ?? ''));
        const slug = this.normalizeSlug(String(input.slug ?? name));

        if (name.length < 2 || name.length > 100) {
            return {
                ok: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid organization name',
                fieldErrors: { name: ['Name must be 2-100 characters'] },
            };
        }

        if (!this.isValidSlug(slug)) {
            return {
                ok: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid slug',
                fieldErrors: { slug: ['Slug must be lowercase letters, numbers, and hyphens (2-100 chars)'] },
            };
        }

        return {
            ok: true,
            payload: {
                name,
                slug,
                plan: this.normalizePlan(input.plan),
                status: this.normalizeStatus(input.status),
            },
        };
    }

    /**
     * Validate and normalize a platform-scope update payload.
     * Only the keys present in `input` are emitted in `patch`.
     * Does NOT hit the database.
     */
    static validatePlatformUpdateInput(input: {
        name?: unknown;
        slug?: unknown;
        plan?: unknown;
        status?: unknown;
        settings?: unknown;
        metadata?: unknown;
    }):
        | { ok: true; patch: Record<string, unknown> }
        | { ok: false; code: 'VALIDATION_ERROR'; message: string; fieldErrors: Record<string, string[]> } {
        const patch: Record<string, unknown> = {};

        if (input.name !== undefined) {
            const name = this.normalizeName(String(input.name));
            if (name.length < 2 || name.length > 100) {
                return {
                    ok: false,
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid organization name',
                    fieldErrors: { name: ['Name must be 2-100 characters'] },
                };
            }
            patch.name = name;
        }

        if (input.slug !== undefined) {
            const slug = this.normalizeSlug(String(input.slug));
            if (!this.isValidSlug(slug)) {
                return {
                    ok: false,
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid slug',
                    fieldErrors: { slug: ['Slug must be lowercase letters, numbers, and hyphens (2-100 chars)'] },
                };
            }
            patch.slug = slug;
        }

        if (input.plan !== undefined) {
            patch.plan = this.normalizePlan(input.plan);
        }

        if (input.status !== undefined) {
            patch.status = this.normalizeStatus(input.status);
        }

        if (input.settings !== undefined && typeof input.settings === 'object' && input.settings !== null) {
            patch.settings = input.settings;
        }

        if (input.metadata !== undefined && typeof input.metadata === 'object' && input.metadata !== null) {
            patch.metadata = input.metadata;
        }

        return { ok: true, patch };
    }

    /**
     * Validate a tenant-scope (non-platform) update payload.
     * Rejects platform-only fields (slug/plan/status) with FORBIDDEN.
     */
    static validateTenantUpdateInput(input: {
        name?: unknown;
        slug?: unknown;
        plan?: unknown;
        status?: unknown;
        settings?: unknown;
        metadata?: unknown;
    }):
        | { ok: true; patch: Record<string, unknown> }
        | {
              ok: false;
              code: 'VALIDATION_ERROR' | 'FORBIDDEN';
              message: string;
              fieldErrors?: Record<string, string[]>;
          } {
        if (input.slug !== undefined || input.plan !== undefined || input.status !== undefined) {
            return {
                ok: false,
                code: 'FORBIDDEN',
                message: 'Slug, plan, and status are platform-admin fields',
            };
        }

        // Reuse platform validator for the subset of allowed fields.
        return this.validatePlatformUpdateInput({
            name: input.name,
            settings: input.settings,
            metadata: input.metadata,
        });
    }

    /**
     * Get organization member count
     */
    static async getMemberCount(id: string): Promise<number> {
        const db = this.getDriver().getDb();

        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(organizationMembersTable)
            .where(eq(organizationMembersTable.organizationId, id));

        return Number(result?.count ?? 0);
    }

    /**
     * Check if organization is active
     */
    static async isActive(id: string): Promise<boolean> {
        const org = await this.find(id);
        return org?.get('status') === 'active';
    }

    /**
     * Generate URL-friendly slug from name
     */
    private static generateSlug(name: string): string {
        return name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Get all active organizations
     */
    static async getActive(limit?: number): Promise<OrganizationType[]> {
        const db = this.getDriver().getDb();

        let query = db
            .select()
            .from(organizationsTable)
            .where(eq(organizationsTable.status, 'active'))
            .orderBy(organizationsTable.createdAt);

        if (limit) {
            query = query.limit(limit) as any;
        }

        return query;
    }

    /**
     * Search organizations by name or slug
     */
    static async search(query: string, limit?: number): Promise<OrganizationType[]>;
    static async search<T extends typeof BaseModel>(
        this: T,
        query: string,
        fields: string[],
        where?: Record<string, any>,
        options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
        driver?: DbDriver,
    ): Promise<InstanceType<T>[]>;
    static async search<T extends typeof BaseModel>(
        this: T,
        query: string,
        fieldsOrLimit: string[] | number = ['name', 'slug'],
        where?: Record<string, any>,
        options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
        driver?: DbDriver,
    ): Promise<OrganizationType[] | InstanceType<T>[]> {
        if (typeof fieldsOrLimit === 'number') {
            const db = this.getDriver(driver).getDb();
            const searchPattern = `%${query}%`;
            return db
                .select()
                .from(organizationsTable)
                .where(
                    sql`${organizationsTable.name} LIKE ${searchPattern} OR ${organizationsTable.slug} LIKE ${searchPattern}`,
                )
                .limit(fieldsOrLimit) as unknown as Promise<OrganizationType[]>;
        }

        const fields = fieldsOrLimit;
        const mergedOptions = options;
        return super.search(query, fields, where, mergedOptions, driver) as Promise<InstanceType<T>[]>;
    }
}

export { organizationsTable, type NewOrganizationType, type OrganizationType };
