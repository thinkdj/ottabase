/**
 * Site settings and page metadata contracts.
 */

import { z } from 'zod';
import { defineFields, toZod, type Data } from './fields';
import { SectionSchema, type Section } from './sections';
import { THEMES } from './themes';

const links = (label: string, itemLabel: string, max: number) =>
    ({
        kind: 'list',
        label,
        itemLabel,
        max,
        fields: {
            label: { kind: 'text', label: 'Label', required: true },
            href: { kind: 'url', label: 'Link', required: true, placeholder: '/about' },
        },
    }) as const;

export const SITE_FIELDS = defineFields({
    name: { kind: 'text', label: 'Site name', required: true },
    tagline: { kind: 'text', label: 'Tagline', help: 'Shown in the footer and as the default description.' },
    siteUrl: {
        kind: 'url',
        absolute: true,
        label: 'Public URL',
        placeholder: 'https://example.com',
        help: 'Where the landing site is deployed. Turns on “View” links in the admin.',
    },
    theme: {
        kind: 'select',
        label: 'Theme',
        options: THEMES.map((t) => ({ value: t.id, label: t.label })),
    },
    nav: links('Navigation', 'Link', 8),
    navCtaLabel: { kind: 'text', label: 'Nav button label', placeholder: 'Get started' },
    navCtaHref: { kind: 'url', label: 'Nav button link' },
    footerLinks: links('Footer links', 'Link', 12),
    footerNote: { kind: 'text', label: 'Footer note', placeholder: '© 2026 Acme Inc.' },
});

export type SiteSettings = Data<typeof SITE_FIELDS>;
export const SiteSettingsSchema = toZod(SITE_FIELDS);

/** `/`, `/about`, `/docs/getting-started` — lowercase slug segments only. */
export const PAGE_PATH = /^\/([a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/** Maximum stored size of one page's sections (UTF-8 bytes of the JSON). */
export const PAGE_CONTENT_BUDGET_BYTES = 512 * 1024;

export const PageInputSchema = z.object({
    path: z.string().trim().max(200).regex(PAGE_PATH, 'Use lowercase words and dashes, starting with / (e.g. /about)'),
    title: z.string().trim().min(1, 'Required').max(120),
    description: z.string().trim().max(300).optional().default(''),
    published: z.boolean().optional().default(false),
    sections: z
        .array(SectionSchema)
        .max(40)
        .optional()
        .default([])
        .superRefine((sections, ctx) => {
            // Ids key the editor's state and React lists; duplicates would edit and delete together.
            if (new Set(sections.map((s) => s.id)).size !== sections.length) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each section needs a unique id.' });
            }
            // Stay far below D1's ~2 MB row limit, with an error the editor can show.
            if (new TextEncoder().encode(JSON.stringify(sections)).length > PAGE_CONTENT_BUDGET_BYTES) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'This page has too much content. Split it into more pages.',
                });
            }
        }),
});

export type PageInput = z.input<typeof PageInputSchema>;

/** A page as the renderer and admin see it. */
export type LandingPageData = {
    id: string;
    path: string;
    title: string;
    description: string;
    published: boolean;
    sections: Section[];
    updatedAt?: string;
};
