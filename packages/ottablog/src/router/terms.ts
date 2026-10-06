import { globalRLS, type SecurityContext } from '@ottabase/ottaorm';
import { PostCategory, PostSeries, PostTag } from '../ottaorm-models';
import { generateSlug } from '../types';

export type TermKind = 'tag' | 'category' | 'series';

export interface TermResolverOptions {
    appId: string;
    /** undefined in platform mode (one app-wide vocabulary); the organization in org mode */
    tenantOrganizationId: string | null | undefined;
    /** When given, every create is checked against RLS as this caller */
    securityContext?: SecurityContext;
}

/**
 * Finds a tag, category or series by name within a scope and creates it when missing. Results are
 * cached per resolver, so "JS" and "js" map to one term across a whole import or seed.
 */
export function createTermResolver({ appId, tenantOrganizationId, securityContext }: TermResolverOptions) {
    const ids = new Map<string, string>();
    return async (kind: TermKind, name: string, onCreate: Record<string, unknown> = {}): Promise<string> => {
        const key = `${kind}:${name.toLowerCase()}`;
        const cached = ids.get(key);
        if (cached) return cached;
        const Model = (kind === 'tag' ? PostTag : kind === 'category' ? PostCategory : PostSeries) as typeof PostTag;
        const nameField = kind === 'series' ? 'title' : 'name';
        const where: Record<string, unknown> = { appId };
        if (kind !== 'series') where.type = 'post';
        if (tenantOrganizationId !== undefined) where.organizationId = tenantOrganizationId;
        const slug = generateSlug(name);
        let term = await Model.first(slug ? { ...where, slug } : { ...where, [nameField]: name });
        if (!term) {
            const data = { ...where, ...onCreate, organizationId: tenantOrganizationId ?? null, [nameField]: name };
            if (securityContext) globalRLS.validateWrite(Model.entity, securityContext, data, 'create');
            term = await Model.create(data);
        }
        const id = term.get('id') as string;
        ids.set(key, id);
        return id;
    };
}
