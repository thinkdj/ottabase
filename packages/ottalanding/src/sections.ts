/**
 * The section catalog: every building block a landing page can be made of.
 *
 * Opinionated on purpose — each section has the fields we think a good landing
 * page needs, nothing more. Themes decide how each one looks.
 */

import { z } from 'zod';
import { defineFields, toZod, type Data, type Fields } from './fields';

const actions = {
    kind: 'list',
    label: 'Buttons',
    itemLabel: 'Button',
    max: 3,
    fields: {
        label: { kind: 'text', label: 'Label', required: true },
        href: { kind: 'url', label: 'Link', required: true, placeholder: '/signup or https://…' },
    },
} as const;

export const SECTIONS = {
    hero: {
        label: 'Hero',
        description: 'The headline: what it is, who it is for, and the first call to action.',
        fields: defineFields({
            eyebrow: { kind: 'text', label: 'Eyebrow', placeholder: 'New: v2 is out' },
            title: { kind: 'text', label: 'Headline', required: true },
            subtitle: { kind: 'textarea', label: 'Subheadline' },
            actions,
            imageUrl: { kind: 'url', label: 'Image URL', help: 'Optional product shot or illustration.' },
        }),
    },
    logos: {
        label: 'Logos',
        description: 'Social proof: companies or communities that use you.',
        fields: defineFields({
            title: { kind: 'text', label: 'Heading', placeholder: 'Trusted by teams at' },
            items: {
                kind: 'list',
                label: 'Logos',
                itemLabel: 'Logo',
                max: 12,
                fields: {
                    name: { kind: 'text', label: 'Name', required: true },
                    logoUrl: { kind: 'url', label: 'Logo image URL', help: 'Leave empty to show the name.' },
                },
            },
        }),
    },
    features: {
        label: 'Features',
        description: 'The benefits, one short title and sentence each.',
        fields: defineFields({
            title: { kind: 'text', label: 'Heading' },
            subtitle: { kind: 'textarea', label: 'Intro' },
            items: {
                kind: 'list',
                label: 'Features',
                itemLabel: 'Feature',
                max: 12,
                fields: {
                    title: { kind: 'text', label: 'Title', required: true },
                    description: { kind: 'textarea', label: 'Description', required: true },
                },
            },
        }),
    },
    testimonials: {
        label: 'Testimonials',
        description: 'What customers say, in their words.',
        fields: defineFields({
            title: { kind: 'text', label: 'Heading' },
            items: {
                kind: 'list',
                label: 'Quotes',
                itemLabel: 'Quote',
                max: 9,
                fields: {
                    quote: { kind: 'textarea', label: 'Quote', required: true },
                    author: { kind: 'text', label: 'Name', required: true },
                    role: { kind: 'text', label: 'Role / company' },
                    avatarUrl: { kind: 'url', label: 'Photo URL' },
                },
            },
        }),
    },
    pricing: {
        label: 'Pricing',
        description: 'Plans side by side; mark one as featured.',
        fields: defineFields({
            title: { kind: 'text', label: 'Heading' },
            subtitle: { kind: 'textarea', label: 'Intro' },
            plans: {
                kind: 'list',
                label: 'Plans',
                itemLabel: 'Plan',
                max: 4,
                fields: {
                    name: { kind: 'text', label: 'Name', required: true },
                    price: { kind: 'text', label: 'Price', required: true, placeholder: '$19' },
                    period: { kind: 'text', label: 'Period', placeholder: '/month' },
                    description: { kind: 'text', label: 'Short description' },
                    features: { kind: 'lines', label: 'Included', help: 'One per line.' },
                    ctaLabel: { kind: 'text', label: 'Button label', placeholder: 'Start free' },
                    ctaHref: { kind: 'url', label: 'Button link' },
                    featured: { kind: 'boolean', label: 'Featured plan' },
                },
            },
        }),
    },
    faq: {
        label: 'FAQ',
        description: 'Answer the objections before they are asked.',
        fields: defineFields({
            title: { kind: 'text', label: 'Heading' },
            items: {
                kind: 'list',
                label: 'Questions',
                itemLabel: 'Question',
                max: 20,
                fields: {
                    question: { kind: 'text', label: 'Question', required: true },
                    answer: { kind: 'textarea', label: 'Answer', required: true },
                },
            },
        }),
    },
    cta: {
        label: 'Call to action',
        description: 'The closing ask.',
        fields: defineFields({
            title: { kind: 'text', label: 'Heading', required: true },
            subtitle: { kind: 'textarea', label: 'Supporting line' },
            actions,
        }),
    },
    text: {
        label: 'Text',
        description: 'Plain prose for about, legal or story pages.',
        fields: defineFields({
            title: { kind: 'text', label: 'Heading' },
            body: { kind: 'textarea', label: 'Body', required: true, help: 'Separate paragraphs with a blank line.' },
        }),
    },
} as const satisfies Record<string, { label: string; description: string; fields: Fields }>;

export type SectionType = keyof typeof SECTIONS;
export const SECTION_TYPES = Object.keys(SECTIONS) as SectionType[];

export type SectionData<T extends SectionType> = Data<(typeof SECTIONS)[T]['fields']>;

/** One block on a page. `id` is stable across edits so lists can reorder without losing state. */
export type Section = { [T in SectionType]: { id: string; type: T; data: SectionData<T> } }[SectionType];

const sectionSchemas = SECTION_TYPES.map((type) =>
    z.object({ id: z.string().min(1).max(64), type: z.literal(type), data: toZod(SECTIONS[type].fields) }),
);

export const SectionSchema = z.discriminatedUnion(
    'type',
    sectionSchemas as unknown as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]],
) as unknown as z.ZodType<Section>;

/** Parse stored sections, silently dropping any that no longer match the catalog. */
export function parseSections(value: unknown): Section[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((s) => {
        const r = SectionSchema.safeParse(s);
        return r.success ? [r.data] : [];
    });
}

/** A fresh, empty section of the given type. */
export function newSection(type: SectionType): Section {
    return { id: crypto.randomUUID(), type, data: {} } as Section;
}
