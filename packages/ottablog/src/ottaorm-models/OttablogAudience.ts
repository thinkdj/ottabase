/**
 * Audiences of a blog: named groups of readers, each given some of the blog's locked
 * (invite-only) categories. A reader opens a locked category when an audience they belong to is
 * given that category or one of its ancestors.
 */
import type { DbDriver } from '@ottabase/db/drizzle';
import { BaseModel, DomainValidationError, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { eq } from 'drizzle-orm';
import type { BlogScope } from '../types';
import {
    ottablogAudienceMembersTable,
    ottablogAudiencesTable,
    ottablogCategoryAudiencesTable,
} from './OttablogAudience.schema';

export {
    ottablogAudienceMembersTable,
    ottablogAudiencesTable,
    ottablogCategoryAudiencesTable,
    type NewOttablogAudienceType,
    type OttablogAudienceType,
} from './OttablogAudience.schema';

const MAX_AUDIENCE_NAME_LENGTH = 60;

function isUniqueViolation(error: unknown): boolean {
    return /unique|constraint|duplicate/i.test(error instanceof Error ? error.message : String(error));
}

/** A reader in an audience. */
export class OttablogAudienceMember extends BaseModel {
    static entity = 'ottablog_audience_members';
    static table = ottablogAudienceMembersTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = { create: ['audienceId', 'userId'], update: [] as string[] };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        audienceId: { type: 'string', editable: false, uiConfig: { label: 'Audience' } },
        userId: { type: 'string', editable: false, uiConfig: { label: 'Reader' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Added' } },
    };
}

/** An audience given a locked category. */
export class OttablogCategoryAudience extends BaseModel {
    static entity = 'ottablog_category_audiences';
    static table = ottablogCategoryAudiencesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = { create: ['categoryId', 'audienceId'], update: [] as string[] };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        categoryId: { type: 'string', editable: false, uiConfig: { label: 'Category' } },
        audienceId: { type: 'string', editable: false, uiConfig: { label: 'Audience' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Given' } },
    };

    /** Replace the audiences given a category. The caller checks they all belong to its blog. */
    static async setForCategory(categoryId: string, audienceIds: string[]): Promise<void> {
        const wanted = new Set(audienceIds);
        const current = await this.where({ categoryId }, { select: ['id', 'audienceId'] });
        for (const row of current) {
            if (!wanted.delete(String(row.get('audienceId')))) await this.delete(String(row.get('id')));
        }
        for (const audienceId of wanted) {
            try {
                await this.create({ categoryId, audienceId });
            } catch (error) {
                // A concurrent save gave it already.
                if (!isUniqueViolation(error)) throw error;
            }
        }
    }
}

export class OttablogAudience extends BaseModel {
    static entity = 'ottablog_audiences';
    static table = ottablogAudiencesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static writable = { create: ['name', 'appId', 'organizationId'], update: ['name'] };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        name: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Name', description: 'Who these readers are, e.g. Family' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true },
        },
        appId: { type: 'string', editable: false, uiConfig: { label: 'App' } },
        organizationId: { type: 'string', editable: false, uiConfig: { label: 'Organization' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
        updatedAt: { type: 'date', editable: false, uiConfig: { label: 'Updated' } },
    };

    /** A trimmed name of 1 to 60 characters, else a 400. */
    static normalizeName(value: unknown): string {
        const name = typeof value === 'string' ? value.trim() : '';
        if (!name || name.length > MAX_AUDIENCE_NAME_LENGTH) {
            const message = `Name an audience in 1 to ${MAX_AUDIENCE_NAME_LENGTH} characters`;
            throw new DomainValidationError(message, { status: 400, fieldErrors: { name: message } });
        }
        return name;
    }

    private static nameTaken(): DomainValidationError {
        const message = 'This blog already has an audience with that name';
        return new DomainValidationError(message, { code: 'AUDIENCE_EXISTS', fieldErrors: { name: message } });
    }

    /** A blog's audiences, by name. */
    static async forBlog(scope: BlogScope): Promise<OttablogAudience[]> {
        return (await this.where({ ...scope }, { orderBy: 'name', orderDirection: 'asc' })) as OttablogAudience[];
    }

    /** One audience of this blog, or null (never another blog's). */
    static async findInBlog(id: string, scope: BlogScope): Promise<OttablogAudience | null> {
        return (await this.first({ id, ...scope })) as OttablogAudience | null;
    }

    static async createInBlog(scope: BlogScope, name: unknown): Promise<OttablogAudience> {
        const normalized = this.normalizeName(name);
        try {
            return (await this.create({ ...scope, name: normalized })) as OttablogAudience;
        } catch (error) {
            if (isUniqueViolation(error)) throw this.nameTaken();
            throw error;
        }
    }

    async rename(name: unknown): Promise<this> {
        this.set('name', OttablogAudience.normalizeName(name));
        try {
            return await this.save();
        } catch (error) {
            if (isUniqueViolation(error)) throw OttablogAudience.nameTaken();
            throw error;
        }
    }

    /**
     * There are no FOREIGN KEY clauses in D1 (see Post.delete), so an audience takes its members
     * and its category grants with it.
     */
    static async delete(id: string | number, driver?: DbDriver): Promise<boolean> {
        const db = this.getDriver(driver).getDb();
        await db.delete(ottablogAudienceMembersTable).where(eq(ottablogAudienceMembersTable.audienceId, String(id)));
        await db
            .delete(ottablogCategoryAudiencesTable)
            .where(eq(ottablogCategoryAudiencesTable.audienceId, String(id)));
        return super.delete(id, driver);
    }

    async addMember(userId: string): Promise<void> {
        try {
            await OttablogAudienceMember.create({ audienceId: String(this.get('id')), userId });
        } catch (error) {
            // Already a member: adding twice is not an error.
            if (!isUniqueViolation(error)) throw error;
        }
    }

    async removeMember(userId: string): Promise<void> {
        const member = await OttablogAudienceMember.first({ audienceId: String(this.get('id')), userId });
        if (member) await OttablogAudienceMember.delete(String(member.get('id')));
    }
}
