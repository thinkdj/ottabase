import type { EmailTemplate } from './types';

export const DEFAULT_EMAIL_LAYOUT = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{subject}}</title>
    <style>
      body { margin: 0; padding: 0; background: #f6f7fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .email-container { max-width: 640px; margin: 0 auto; padding: 32px; }
      .email-card { background: #ffffff; border-radius: 14px; padding: 32px; border: 1px solid #e6e8ef; }
      .email-header { font-size: 20px; font-weight: 600; margin-bottom: 24px; color: #111827; }
      .email-body { font-size: 16px; line-height: 1.7; color: #1f2937; }
      .email-footer { margin-top: 32px; font-size: 12px; color: #6b7280; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-card">
        {{#if header}}<div class="email-header">{{{header}}}</div>{{/if}}
        <div class="email-body">{{{body}}}</div>
        {{#if footer}}<div class="email-footer">{{{footer}}}</div>{{/if}}
      </div>
    </div>
  </body>
</html>`;

const templateRegistry = new Map<string, EmailTemplate>();

export function registerEmailTemplate(template: EmailTemplate) {
    templateRegistry.set(template.name, template);
    return template;
}

export function getEmailTemplate(name: string) {
    return templateRegistry.get(name);
}

export function listEmailTemplates() {
    return Array.from(templateRegistry.keys());
}

export const defaultTemplate = registerEmailTemplate({
    name: 'default',
    subject: '{{subject}}',
    layout: DEFAULT_EMAIL_LAYOUT,
    header: '{{header}}',
    body: '{{{body}}}',
    footer: '{{footer}}',
    text: '{{header}}\n\n{{body}}\n\n{{footer}}',
});
