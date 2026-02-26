/**
 * @ottabase/ottalanding — Section Field Definitions
 *
 * Defines admin form fields for each section type.
 * Instead of a generic JSON editor, the admin gets purpose-built
 * form fields for each content type (hero, features, pricing, etc.).
 *
 * These plug into OttaORM's auto-form system via ModelFields.
 */

import type { ModelFields } from '@ottabase/ottaorm';
import type { SectionType } from './types';

// ─── Hero ────────────────────────────────────────────────────────────────────

const heroFields: ModelFields = {
    badge: {
        type: 'string',
        editable: true,
        uiConfig: {
            label: 'Badge',
            description: 'Small chip/badge above the headline (e.g. "New in v2.0")',
            placeholder: 'Now available',
        },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: {
            label: 'Headline',
            description: 'Main hero headline',
            placeholder: 'Ship faster with our platform',
        },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required|min:1', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: {
            label: 'Subheadline',
            description: 'Supporting text below the headline',
            placeholder: 'A short description of your product...',
        },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    'primaryCta.label': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Primary CTA Label', placeholder: 'Get started free' },
        formConfig: { visible: true, fieldType: 'input', order: 4 },
    },
    'primaryCta.href': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Primary CTA Link', placeholder: '/signup' },
        formConfig: { visible: true, fieldType: 'input', order: 5 },
    },
    'secondaryCta.label': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Secondary CTA Label', placeholder: 'Learn more' },
        formConfig: { visible: true, fieldType: 'input', order: 6 },
    },
    'secondaryCta.href': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Secondary CTA Link', placeholder: '/docs' },
        formConfig: { visible: true, fieldType: 'input', order: 7 },
    },
    'image.src': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Hero Image URL', placeholder: 'https://...' },
        formConfig: { visible: true, fieldType: 'input', order: 8 },
    },
    'image.alt': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Hero Image Alt Text', placeholder: 'Product screenshot' },
        formConfig: { visible: true, fieldType: 'input', order: 9 },
    },
    'socialProof.count': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Social Proof Number', placeholder: '10,000+' },
        formConfig: { visible: true, fieldType: 'input', order: 10 },
    },
    'socialProof.label': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Social Proof Label', placeholder: 'developers building with us' },
        formConfig: { visible: true, fieldType: 'input', order: 11 },
    },
};

// ─── Features ────────────────────────────────────────────────────────────────

const featuresFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', description: 'Small text above headline', placeholder: 'Everything you need' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Built for production' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Subheadline' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    columns: {
        type: 'integer',
        editable: true,
        uiConfig: { label: 'Columns', description: 'Number of columns (2, 3, or 4)', defaultValue: 3 },
        formConfig: {
            visible: true,
            fieldType: 'select',
            options: [
                { id: '2', name: '2 columns', label: '2 columns', value: '2' },
                { id: '3', name: '3 columns', label: '3 columns', value: '3' },
                { id: '4', name: '4 columns', label: '4 columns', value: '4' },
            ],
            order: 4,
        },
    },
    features: {
        type: 'json',
        editable: true,
        uiConfig: {
            label: 'Features',
            description: 'Array of features — each has icon (name), title, description',
        },
        formConfig: { visible: true, fieldType: 'json', order: 5 },
    },
};

// ─── Pricing ─────────────────────────────────────────────────────────────────

const pricingFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'Simple pricing' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Start free, scale as you grow' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Subheadline', placeholder: 'No hidden fees.' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    defaultBilling: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Default Billing Period', defaultValue: 'monthly' },
        formConfig: {
            visible: true,
            fieldType: 'select',
            options: [
                { id: 'monthly', name: 'Monthly', label: 'Monthly', value: 'monthly' },
                { id: 'annual', name: 'Annual', label: 'Annual', value: 'annual' },
            ],
            order: 4,
        },
    },
    plans: {
        type: 'json',
        editable: true,
        uiConfig: {
            label: 'Pricing Plans',
            description: 'Array of plans — each has name, description, price, features, cta',
        },
        formConfig: { visible: true, fieldType: 'json', order: 5 },
    },
};

// ─── Testimonials ────────────────────────────────────────────────────────────

const testimonialsFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'What developers say' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Teams ship faster with us' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
    },
    testimonials: {
        type: 'json',
        editable: true,
        uiConfig: {
            label: 'Testimonials',
            description: 'Array of testimonials — each has quote, author, role, company, avatar, rating',
        },
        formConfig: { visible: true, fieldType: 'json', order: 3 },
    },
};

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faqFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'FAQ' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Common questions' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Subheadline' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    items: {
        type: 'json',
        editable: true,
        uiConfig: {
            label: 'FAQ Items',
            description: 'Array of items — each has question and answer',
        },
        formConfig: { visible: true, fieldType: 'json', order: 4 },
    },
};

// ─── Logo Cloud ──────────────────────────────────────────────────────────────

const logoCloudFields: ModelFields = {
    label: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Label', placeholder: 'Trusted by teams using' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    logos: {
        type: 'json',
        editable: true,
        uiConfig: {
            label: 'Logos',
            description: 'Array of logos — each has name, src (optional), width, height',
        },
        formConfig: { visible: true, fieldType: 'json', order: 2 },
    },
};

// ─── CTA Banner ──────────────────────────────────────────────────────────────

const ctaFields: ModelFields = {
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Ready to get started?' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Subheadline' },
        formConfig: { visible: true, fieldType: 'textarea', order: 2 },
    },
    'primaryCta.label': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Primary CTA Label', placeholder: 'Get started free' },
        formConfig: { visible: true, fieldType: 'input', order: 3 },
    },
    'primaryCta.href': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Primary CTA Link', placeholder: '/signup' },
        formConfig: { visible: true, fieldType: 'input', order: 4 },
    },
    'secondaryCta.label': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Secondary CTA Label' },
        formConfig: { visible: true, fieldType: 'input', order: 5 },
    },
    'secondaryCta.href': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Secondary CTA Link' },
        formConfig: { visible: true, fieldType: 'input', order: 6 },
    },
};

// ─── Stats ───────────────────────────────────────────────────────────────────

const statsFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'By the numbers' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
    },
    stats: {
        type: 'json',
        editable: true,
        uiConfig: {
            label: 'Stats',
            description: 'Array of stats — each has value, label, description',
        },
        formConfig: { visible: true, fieldType: 'json', order: 3 },
    },
};

// ─── Steps ───────────────────────────────────────────────────────────────────

const stepsFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'How it works' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Get started in minutes' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Subheadline' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    steps: {
        type: 'json',
        editable: true,
        uiConfig: {
            label: 'Steps',
            description: 'Array of steps — each has title, description, icon (optional)',
        },
        formConfig: { visible: true, fieldType: 'json', order: 4 },
    },
};

// ─── Feature Highlight ──────────────────────────────────────────────────────

const featureHighlightFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'Why choose us' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Built for modern teams' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    description: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Description' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
        validation: { rules: 'required', messages: { required: 'Description is required' } },
    },
    imagePosition: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Image Position', defaultValue: 'right' },
        formConfig: {
            visible: true,
            fieldType: 'select',
            options: [
                { id: 'right', name: 'Right', label: 'Right', value: 'right' },
                { id: 'left', name: 'Left', label: 'Left', value: 'left' },
            ],
            order: 4,
        },
    },
    'image.src': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Image URL', placeholder: 'https://...' },
        formConfig: { visible: true, fieldType: 'input', order: 5 },
    },
    'image.alt': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Image Alt Text', placeholder: 'Feature screenshot' },
        formConfig: { visible: true, fieldType: 'input', order: 6 },
    },
    bullets: {
        type: 'json',
        editable: true,
        uiConfig: { label: 'Bullet Points', description: 'Array of items — each has icon (optional), text' },
        formConfig: { visible: true, fieldType: 'json', order: 7 },
    },
    'cta.label': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'CTA Label', placeholder: 'Learn more' },
        formConfig: { visible: true, fieldType: 'input', order: 8 },
    },
    'cta.href': {
        type: 'string',
        editable: true,
        uiConfig: { label: 'CTA Link', placeholder: '/features' },
        formConfig: { visible: true, fieldType: 'input', order: 9 },
    },
};

// ─── About ──────────────────────────────────────────────────────────────────

const aboutFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'About us' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Our story' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    mission: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Mission Statement' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    story: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Our Story' },
        formConfig: { visible: true, fieldType: 'textarea', order: 4 },
    },
    values: {
        type: 'json',
        editable: true,
        uiConfig: { label: 'Values', description: 'Array of values — each has icon (optional), title, description' },
        formConfig: { visible: true, fieldType: 'json', order: 5 },
    },
    team: {
        type: 'json',
        editable: true,
        uiConfig: { label: 'Team Members', description: 'Array — each has name, role, avatar, bio, social links' },
        formConfig: { visible: true, fieldType: 'json', order: 6 },
    },
};

// ─── Contact ────────────────────────────────────────────────────────────────

const contactFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'Contact' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Get in touch' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Subheadline' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    contactInfo: {
        type: 'json',
        editable: true,
        uiConfig: { label: 'Contact Info', description: 'Array — each has icon, label, value, href (optional)' },
        formConfig: { visible: true, fieldType: 'json', order: 4 },
    },
    showForm: {
        type: 'boolean',
        editable: true,
        uiConfig: { label: 'Show Contact Form', defaultValue: true },
        formConfig: { visible: true, fieldType: 'boolean', order: 5 },
    },
    formAction: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Form Action URL', placeholder: '/api/contact' },
        formConfig: { visible: true, fieldType: 'input', order: 6 },
    },
};

// ─── Timeline ───────────────────────────────────────────────────────────────

const timelineFields: ModelFields = {
    eyebrow: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Eyebrow', placeholder: 'Our journey' },
        formConfig: { visible: true, fieldType: 'input', order: 1 },
    },
    headline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Headline', placeholder: 'Milestones' },
        formConfig: { visible: true, fieldType: 'input', order: 2 },
        validation: { rules: 'required', messages: { required: 'Headline is required' } },
    },
    subheadline: {
        type: 'string',
        editable: true,
        uiConfig: { label: 'Subheadline' },
        formConfig: { visible: true, fieldType: 'textarea', order: 3 },
    },
    events: {
        type: 'json',
        editable: true,
        uiConfig: { label: 'Timeline Events', description: 'Array — each has date, title, description, icon, tag' },
        formConfig: { visible: true, fieldType: 'json', order: 4 },
    },
};

// ─── Registry ────────────────────────────────────────────────────────────────

/** Admin form field definitions for each section type */
export const SECTION_FIELDS: Record<SectionType, ModelFields> = {
    hero: heroFields,
    features: featuresFields,
    pricing: pricingFields,
    testimonials: testimonialsFields,
    faq: faqFields,
    'logo-cloud': logoCloudFields,
    cta: ctaFields,
    stats: statsFields,
    steps: stepsFields,
    'feature-highlight': featureHighlightFields,
    about: aboutFields,
    contact: contactFields,
    timeline: timelineFields,
};

/** Get admin form fields for a section type */
export function getSectionFields(type: SectionType): ModelFields {
    return SECTION_FIELDS[type];
}
