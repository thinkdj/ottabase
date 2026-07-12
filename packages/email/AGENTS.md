# @ottabase/email — agent notes

Edge-friendly Handlebars email templating + multi-provider mailer abstraction. Full docs: ./README.md

## Use when

- Rendering Handlebars email templates and sending mail from Workers or Node (Resend, SES, MailChannels/Cloudflare, SMTP, KV dev trap).
- NOT for in-app/push notifications — use @ottabase/notifications (it consumes this package for its email channel).

## Imports

```ts
import { sendTemplatedEmail, createNoopMailer, renderEmail, registerEmailTemplate, getEmailTemplate, listEmailTemplates, defaultTemplate, DEFAULT_EMAIL_LAYOUT } from '@ottabase/email';
import type { Mailer, EmailTemplate, SendEmailInput, SendEmailResult, TemplatedEmailInput, RenderedEmail } from '@ottabase/email';
import { createResendMailer } from '@ottabase/email/providers/resend';
import { createSESMailer } from '@ottabase/email/providers/ses';
import { createCloudflareMailer, createMailChannelsMailer } from '@ottabase/email/providers/cloudflare';
import { createDevEmailTrapMailer, createKvEmailTrapStore } from '@ottabase/email/providers/dev-trap';
import { createNodemailerMailer } from '@ottabase/email/providers/nodemailer'; // Node-only, not in root index
```

## Canonical usage

```ts
// Register once at startup (overwrites by name); 'default' template ships built in.
registerEmailTemplate({
    name: 'welcome',
    subject: 'Welcome, {{name}}!',
    body: '<p>Hi {{name}}, thanks for joining.</p>',
});

const mailer = createResendMailer({ apiKey: env.RESEND_API_KEY });
const result = await sendTemplatedEmail(mailer, {
    from: 'noreply@example.com',
    to: { email: 'user@example.com', name: 'User' },
    template: 'welcome', // or an inline EmailTemplate object
    variables: { name: 'User' },
});
```

```ts
// Dev trap: store mail in KV instead of sending (default cap 100 entries, 7d TTL).
const store = createKvEmailTrapStore(env.OBCF_KV, { maxEntries: 50 });
const mailer = createDevEmailTrapMailer({ store });
```

## Gotchas

- Providers resend/ses/cloudflare/dev-trap are re-exported from the root index; nodemailer is NOT — import `@ottabase/email/providers/nodemailer` (Node-only, breaks edge).
- Template registry is module-global mutable state; `registerEmailTemplate` overwrites by name, `renderEmail` throws on unknown template names.
- `renderEmail` falls back to a regex-based simple renderer when Handlebars can't compile (e.g. Workers' "Code generation from strings disallowed"); only plain `{{var}}` / `{{#if var}}` survive that path.
- Template body/header can carry raw HTML via `{{{triple-stache}}}` — sanitize user-supplied HTML/URLs with @ottabase/utils/sanitize before interpolating.
