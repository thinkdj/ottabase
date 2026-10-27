// ============================================================
// @ottabase/og — the manifest
// ============================================================

import type { BrowserRunLike } from '@ottabase/cf/browser';
import { definePackage, type OttaPackage } from '@ottabase/kernel';
import type { OgCard } from './card';
import { createOgRenderer, type OgBucket, type OgRenderer } from './renderer';
import { createOgRouter, type OgTemplateSource } from './routes';
import { OG_BASE_PATH } from './sign';
import type { OgTemplate } from './template';

export const OG_PACKAGE_KEY = 'og';

export interface OgPackageOptions<Env> {
    getBrowserBinding: (env: Env) => BrowserRunLike | null | undefined;
    /** The R2 bucket that keeps rendered images; without it every request renders. */
    getBucket?: (env: Env) => OgBucket | null | undefined;
    /** Signs the image URLs the app emits; `AUTH_SECRET` does. */
    secret: (env: Env) => string | null | undefined;
    /** Fields every card gets unless the URL names them: site name, domain, colors, logo. */
    defaults?: (env: Env, request: Request) => Partial<OgCard> | Promise<Partial<OgCard>>;
    /** Another look; name its `version` so cached images are drawn again when it changes. */
    template?: OgTemplate;
    version?: string;
    /** Key prefix in the bucket. Default `og/`. */
    prefix?: string;
    /** Chooses a template per request (og-studio does); the registered source when not given. */
    templates?: OgTemplateSource<Env>;
    /** Serve unsigned URLs. Default false. */
    open?: boolean;
    maxAge?: number;
    basePath?: string;
}

/** `GET /api/og/image` and `GET /api/og/preview`, and a health line saying whether rendering can happen. */
export function createOgPackage<Env = unknown>(options: OgPackageOptions<Env>): OttaPackage<Env> {
    const basePath = options.basePath ?? OG_BASE_PATH;
    // One renderer per isolate per browser binding: the binding object is stable across requests.
    const renderers = new WeakMap<object, OgRenderer>();
    const renderer = (env: Env): OgRenderer | null => {
        const browser = options.getBrowserBinding(env);
        if (!browser) return null;
        let found = renderers.get(browser);
        if (!found) {
            found = createOgRenderer({
                browser,
                bucket: options.getBucket?.(env) ?? null,
                prefix: options.prefix,
                template: options.template,
                version: options.version,
            });
            renderers.set(browser, found);
        }
        return found;
    };
    return definePackage<Env>({
        key: OG_PACKAGE_KEY,
        name: 'Social images',
        version: '0.1.0',
        description:
            'Open Graph images drawn from an HTML card through Browser Rendering, cached in R2, served from signed URLs.',
        docsUrl: 'https://github.com/thinkdj/ottabase/tree/main/packages/og#readme',
        routes: {
            basePath,
            build: () =>
                createOgRouter<Env>({
                    renderer,
                    templates: options.templates,
                    secret: options.secret,
                    open: options.open,
                    defaults: options.defaults,
                    maxAge: options.maxAge,
                }),
        },
        health: (env) => {
            const browser = Boolean(options.getBrowserBinding(env));
            const bucket = Boolean(options.getBucket?.(env));
            const signed = Boolean(options.secret(env)) || options.open === true;
            return {
                name: 'og:render',
                ok: browser && signed,
                detail: `${browser ? 'Browser Rendering bound' : 'no Browser Rendering binding'}; ${
                    bucket ? 'images cached in R2' : 'no bucket, every request renders'
                }; ${options.open ? 'open URLs' : signed ? 'signed URLs' : 'no signing secret'}`,
            };
        },
    });
}
