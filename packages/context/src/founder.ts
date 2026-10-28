// ============================================================
// The founder manifest: one person, every product
// ============================================================
// One file on the founder's own domain (`/.well-known/otta.json` there, or wherever they put
// it) that names the person and lists the products with their own context files. A tool
// that has this one address can import a whole shelf of products at once.
// ============================================================

import { founder as clampFounder, httpUrl, obj, socials, str, urlOrNull } from './facts';
import { canonical, emptyFounder, hashText } from './json';
import { OTTA_CONTEXT_VERSION, OTTA_FOUNDER_KIND, type Founder, type FounderProduct, type OttaFounder } from './types';

export interface FounderFacts {
    founder: Founder;
    products: {
        name: string;
        url: string;
        tagline?: string;
        stage?: string;
        /** The product's context file. When left out, `<url>/.well-known/otta.json` is assumed. */
        context?: string;
    }[];
    updatedAt?: string;
}

/** The manifest. Products without a name or an absolute address are left out. */
export function founderJson(f: FounderFacts, opts: { from: string; at?: Date }): OttaFounder {
    const founder = clampFounder(f.founder);
    const products: FounderProduct[] = (f.products ?? [])
        .map((p): FounderProduct | null => {
            const url = httpUrl(p.url);
            const name = str(p.name, 80);
            if (!name || !url) return null;
            return {
                name,
                url,
                tagline: str(p.tagline, 200),
                stage: str(p.stage, 20),
                context: httpUrl(p.context) || new URL('/.well-known/otta.json', url).href,
            };
        })
        .filter((p): p is FounderProduct => p !== null)
        .slice(0, 50);
    const wire = founder
        ? { ...emptyFounder(), ...founder, url: founder.url ?? null, photo: founder.photo ?? null }
        : emptyFounder();
    return {
        version: OTTA_CONTEXT_VERSION,
        kind: OTTA_FOUNDER_KIND,
        at:
            f.updatedAt && !Number.isNaN(Date.parse(f.updatedAt))
                ? new Date(f.updatedAt).toISOString()
                : (opts.at ?? new Date()).toISOString(),
        from: opts.from,
        hash: hashText(canonical({ founder: wire, products })),
        founder: wire,
        products,
    };
}

/** Read a founder manifest from any source. Null when it is not one. */
export function parseFounderJson(raw: unknown): OttaFounder | null {
    const r = obj(raw);
    const fo = r && obj(r.founder);
    if (!r || r.kind !== OTTA_FOUNDER_KIND || !fo) return null;
    const founder = {
        name: str(fo.name, 80),
        title: str(fo.title, 80),
        url: urlOrNull(fo.url),
        bio: str(fo.bio, 4000),
        bioShort: str(fo.bioShort, 300),
        photo: urlOrNull(fo.photo),
        place: str(fo.place, 80),
        socials: socials(fo.socials),
    };
    const products = (Array.isArray(r.products) ? r.products : [])
        .map((x): FounderProduct | null => {
            const p = obj(x);
            const name = p ? str(p.name, 80) : '';
            const url = p ? httpUrl(p.url) : '';
            return p && name && url
                ? { name, url, tagline: str(p.tagline, 200), stage: str(p.stage, 20), context: urlOrNull(p.context) }
                : null;
        })
        .filter((p): p is FounderProduct => p !== null)
        .slice(0, 50);
    return {
        version: Number.isInteger(r.version) && (r.version as number) > 0 ? (r.version as number) : 1,
        kind: OTTA_FOUNDER_KIND,
        at: str(r.at, 40),
        from: str(r.from, 500),
        hash: /^[0-9a-f]{8,16}$/.test(str(r.hash, 16)) ? str(r.hash, 16) : hashText(canonical({ founder, products })),
        founder,
        products,
    };
}
