import type { EmailTemplate } from '@ottabase/email';

export const minimalistTemplate: EmailTemplate = {
    name: 'minimalist',
    subject: '{{subject}}',
    layout: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{subject}}</title>
    <style>
      body { margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
      .email-shell { padding: 56px 16px 72px; }
      .email-wrapper { max-width: 640px; margin: 0 auto; }
      .email-header { font-size: 18px; font-weight: 600; letter-spacing: 0.02em; margin-bottom: 32px; text-transform: uppercase; color: #2563eb; }
      .email-body { font-size: 16px; line-height: 1.8; color: #0f172a; }
      .email-footer { margin-top: 40px; font-size: 12px; color: #64748b; }
      a { color: #2563eb; text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="email-shell">
      <div class="email-wrapper">
        {{#if header}}<div class="email-header">{{{header}}}</div>{{/if}}
        <div class="email-body">{{{body}}}</div>
        {{#if footer}}<div class="email-footer">{{{footer}}}</div>{{/if}}
      </div>
    </div>
  </body>
</html>`,
    header: '{{header}}',
    body: '{{{body}}}',
    footer: '{{footer}}',
    text: '{{header}}\n\n{{body}}\n\n{{footer}}',
};
