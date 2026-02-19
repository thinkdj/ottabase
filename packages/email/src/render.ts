import Handlebars from 'handlebars';
import { DEFAULT_EMAIL_LAYOUT, getEmailTemplate } from './templates';
import type { EmailTemplate, RenderEmailOptions, RenderedEmail, TemplateVariables } from './types';

const templateCache = new Map<string, Handlebars.TemplateDelegate>();

function resolvePath(source: Record<string, unknown>, path: string) {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (acc && typeof acc === 'object' && key in (acc as object)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, source);
}

function renderSimpleTemplate(source: string, variables: Record<string, unknown>) {
    const withConditionals = source.replace(/{{#if\s+([\w.-]+)\s*}}([\s\S]*?){{\/if}}/g, (_match, key, inner) => {
        const value = resolvePath(variables, key);
        if (value === null || value === undefined || value === false) {
            return '';
        }
        return inner;
    });

    return withConditionals.replace(/{{{?\s*([\w.-]+)\s*}?}}/g, (_match, key) => {
        const value = resolvePath(variables, key);
        if (value === null || value === undefined) return '';
        return String(value);
    });
}

function compileTemplate(source: string) {
    const cached = templateCache.get(source);
    if (cached) return cached;

    const compiled = Handlebars.compile(source);
    templateCache.set(source, compiled);
    return compiled;
}

function renderSection(source: string, variables: TemplateVariables) {
    if (!source) return '';
    try {
        return compileTemplate(source)(variables);
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (
            message.includes('Code generation from strings disallowed') ||
            message.includes('Parse error') ||
            message.includes('Expected either a number, string, keyword or identifier')
        ) {
            return renderSimpleTemplate(source, variables);
        }
        throw error;
    }
}

function stripHtml(input: string) {
    return input
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function resolveTemplate(template: string | EmailTemplate) {
    if (typeof template === 'string') {
        const resolved = getEmailTemplate(template);
        if (!resolved) {
            throw new Error(`Email template not found: ${template}`);
        }
        return resolved;
    }

    return template;
}

export function renderEmail(options: RenderEmailOptions): RenderedEmail {
    const template = resolveTemplate(options.template);
    const variables = options.variables ?? {};
    const content = options.content ?? { body: '' };

    const headerSource = content.header ?? template.header ?? '';
    const bodySource = content.body ?? template.body;
    const footerSource = content.footer ?? template.footer ?? '';

    if (!bodySource) {
        throw new Error('Email template requires body content.');
    }

    const header = renderSection(headerSource, variables);
    const body = renderSection(bodySource, variables);
    const footer = renderSection(footerSource, variables);

    const layout = template.layout ?? DEFAULT_EMAIL_LAYOUT;
    const html = renderSection(layout, {
        ...variables,
        header,
        body,
        footer,
    });

    const subjectTemplate = options.subject ?? template.subject ?? 'Notification';
    const subject = renderSection(subjectTemplate, {
        ...variables,
        header,
        body,
        footer,
    });

    const textTemplate = template.text;
    const text = textTemplate
        ? renderSection(textTemplate, {
              ...variables,
              header,
              body,
              footer,
          })
        : stripHtml([header, body, footer].filter(Boolean).join('\n\n'));

    return { subject, html, text };
}
