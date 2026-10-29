// ============================================================
// @ottabase/ottaorm - CrudHub model opt-in
// ============================================================
// CrudHub is the generic admin data screen. A model joins it with
// `static admin = { enabled: true, ... }`; grant/auth tables never do,
// whatever they declare. These helpers are headless: the worker route
// and the client both read the descriptors they produce.
// ============================================================

import type { ModelFieldDescriptor, ModelFields } from '../base/AbstractBaseModel';
import { getAllModelsMetadata, type ModelRegistryEntry } from '../registry';

/** Who may open a model in CrudHub: platform admins, or org admins for their own org's rows. */
export type CrudHubScope = 'system' | 'org';

export interface AdminModelConfig {
    /** Absent or false: the model is invisible to CrudHub. */
    enabled: boolean;
    /** Default `'system'`: platform admins only. `'org'` lets org admins open their org's rows (RLS scopes them). */
    scope?: CrudHubScope;
    /** RBAC permission keys checked on top of the admin scope. */
    permissions?: { read?: string; write?: string };
    /** Refuse every write through the hub, server-side. */
    readOnly?: boolean;
    /** Columns of the list view, in order. Defaults to `tableConfig` of the model's fields. */
    listFields?: string[];
    /** Field the list toolbar searches. Defaults to the first `searchable` field. */
    searchField?: string;
    /** Field used for links, breadcrumbs and the details heading. Defaults to `name`, then `title`. */
    titleField?: string;
    /** Custom pages that replace the generic ones. `:field` tokens are filled from the row. */
    routes?: { view?: string; edit?: string };
    /** One line for the directory card. */
    description?: string;
    /**
     * Related records shown on the details page, in `with()` spec syntax: `'author:id{name,image}'`,
     * `'tags:id{name,slug}'`, nested `'tags.category:id{name}'`. They are loaded through the model's
     * own relationship methods for a row the caller could read, but the related rows are NOT
     * filtered by RLS, so always project to the fields an admin of this model may see. A relation to
     * a denylisted table (users, roles...) without a projection is cut to `id` and `name`.
     */
    relations?: string[];
}

/** One relation on the details page: the related rows, and their hub entity so the page can link them. */
export interface CrudHubRelation {
    name: string;
    entity: string | null;
    many: boolean;
    items: Array<Record<string, unknown>>;
    /** True when more rows exist than the details page shows (`CRUDHUB_RELATION_LIMIT`). */
    truncated: boolean;
}

/** At most this many rows per relation on the details page. */
export const CRUDHUB_RELATION_LIMIT = 50;

/** The request facts an action may use. The worker fills this; the function never leaves the server. */
export interface AdminActionContext<Env = unknown> {
    env: Env;
    request: Request;
    user: { id: string; email?: string | null };
    organizationId: string | null;
}

export interface AdminAction<Row = Record<string, unknown>, Env = unknown> {
    title: string;
    /** RBAC permission required to run it (on top of the admin scope). */
    permission?: string;
    /** Row predicate, evaluated server-side for the list and again before the run. */
    when?: (row: Row) => boolean;
    /** ConfirmDialog text; required when `destructive`. */
    confirm?: string;
    destructive?: boolean;
    /** Allow running it over a selection, one row at a time. */
    bulk?: boolean;
    run: (row: Row, ctx: AdminActionContext<Env>) => Promise<unknown> | unknown;
}

/** What the client receives for an action: the functions stay on the server. */
export interface CrudHubActionDescriptor {
    key: string;
    title: string;
    destructive: boolean;
    confirm?: string;
    bulk: boolean;
}

/** One model as the directory and list screens see it. */
export interface CrudHubModelDescriptor {
    entity: string;
    modelName: string;
    tableName: string;
    packageName: string;
    packageType: 'core' | 'app' | 'package';
    displayName: string;
    displayNamePlural: string;
    description?: string;
    scope: CrudHubScope;
    readOnly: boolean;
    primaryKey: string;
    titleField?: string;
    searchField?: string;
    listFields?: string[];
    routes?: { view?: string; edit?: string };
    defaultSort?: string;
    defaultSortDirection?: 'asc' | 'desc';
    defaults?: Record<string, unknown>;
    /** Field metadata minus the model's `hidden` fields. */
    fields: ModelFields;
    actions: CrudHubActionDescriptor[];
}

/**
 * Grant and auth tables never appear in CrudHub, not even read-only, however `static admin` is
 * set on them. They keep their dedicated admin pages and endpoints.
 */
export const CRUDHUB_DENYLIST: ReadonlySet<string> = new Set([
    'users',
    'accounts',
    'verification_tokens',
    'roles',
    'permissions',
    'user_roles',
    'user_groups',
    'user_group_members',
    'organization_members',
    'audit_logs',
]);

interface CrudHubModelStatics {
    entity: string;
    primaryKey: string;
    admin?: AdminModelConfig;
    adminActions?: Record<string, AdminAction<any, any>>;
    displayName?: string;
    displayNamePlural?: string;
    defaultSort?: string;
    defaultSortDirection?: 'asc' | 'desc';
    hidden?: string[];
    getFields: () => ModelFields;
    getModelConfig: () => { defaults?: Record<string, unknown> };
}

/** True when a registered model has opted in and is not a denylisted table. */
export function isCrudHubModel(entry: ModelRegistryEntry): boolean {
    const Model = entry.model as unknown as CrudHubModelStatics;
    return Model.admin?.enabled === true && !CRUDHUB_DENYLIST.has(Model.entity);
}

/** The registered model behind an entity name, or null when it is not in the hub. */
export function getCrudHubModel(entity: string): ModelRegistryEntry | null {
    const entry = getAllModelsMetadata().get(entity);
    return entry && isCrudHubModel(entry) ? entry : null;
}

function humanize(entity: string): string {
    const words = entity.replace(/[_-]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function singular(word: string): string {
    if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

/** Field metadata safe for the browser: hidden fields are dropped entirely. */
export function clientFields(Model: { getFields: () => ModelFields; hidden?: string[] }): ModelFields {
    const hidden = new Set(Array.isArray(Model.hidden) ? Model.hidden : []);
    const out: ModelFields = {};
    for (const [key, field] of Object.entries(Model.getFields())) {
        if (hidden.has(key) || field.formConfig?.fieldType === 'password') continue;
        out[key] = field as ModelFieldDescriptor;
    }
    return out;
}

export function actionDescriptors(
    actions: Record<string, AdminAction<any, any>> | undefined,
): CrudHubActionDescriptor[] {
    return Object.entries(actions ?? {}).map(([key, action]) => ({
        key,
        title: action.title,
        destructive: action.destructive === true,
        confirm: action.confirm,
        bulk: action.bulk === true,
    }));
}

/** Build the client descriptor of one hub model. */
export function describeCrudHubModel(entry: ModelRegistryEntry): CrudHubModelDescriptor {
    const Model = entry.model as unknown as CrudHubModelStatics;
    const admin = Model.admin ?? { enabled: true };
    const fields = clientFields(Model);
    const searchField = admin.searchField ?? Object.keys(fields).find((key) => fields[key].searchable);
    const titleField = admin.titleField ?? ['name', 'title'].find((key) => key in fields);
    const displayName = Model.displayName ?? humanize(singular(Model.entity));
    return {
        entity: Model.entity,
        modelName: entry.metadata.modelName,
        tableName: entry.metadata.tableName,
        packageName: entry.metadata.packageName,
        packageType: entry.metadata.packageType,
        displayName,
        displayNamePlural: Model.displayNamePlural ?? humanize(Model.entity),
        description: admin.description,
        scope: admin.scope ?? 'system',
        readOnly: admin.readOnly === true,
        primaryKey: Model.primaryKey || 'id',
        titleField,
        searchField,
        listFields: admin.listFields,
        routes: admin.routes,
        defaultSort: Model.defaultSort,
        defaultSortDirection: Model.defaultSortDirection,
        defaults: Model.getModelConfig?.().defaults,
        fields,
        actions: actionDescriptors(Model.adminActions),
    };
}

/** Every registered model that opted in, sorted by package then name. */
export function listCrudHubModels(): CrudHubModelDescriptor[] {
    return Array.from(getAllModelsMetadata().values())
        .filter(isCrudHubModel)
        .map(describeCrudHubModel)
        .sort((a, b) => a.packageName.localeCompare(b.packageName) || a.displayName.localeCompare(b.displayName));
}

/** Fill `:field` tokens of a custom route from a row: `/blog/:slug` becomes `/blog/hello`. */
export function fillRouteTokens(template: string, row: Record<string, unknown>): string | null {
    let missing = false;
    const path = template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, field: string) => {
        const value = row[field];
        if (value === null || value === undefined || value === '') {
            missing = true;
            return '';
        }
        return encodeURIComponent(String(value));
    });
    return missing ? null : path;
}
