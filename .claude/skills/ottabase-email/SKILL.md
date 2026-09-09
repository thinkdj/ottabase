---
name: ottabase-email
description:
    The Ottabase way to send transactional email (@ottabase/email) — provider-agnostic mailer + templated rendering. Use
    for "send an email", "welcome/verification/notification email", "email template", "configure a mail provider".
    Encodes the resolve-mailer-per-request pattern and the template registry.
---

# Email the Ottabase way

`@ottabase/email` separates a **provider-agnostic `Mailer`** from **template rendering**. There is no global mail
singleton — you resolve a mailer from env, then send.

## Send (server)

```ts
import { resolveAppMailer } from '../lib/email-provider'; // app helper
import { sendTemplatedEmail } from '@ottabase/email';

const { mailer, from, provider, error } = await resolveAppMailer(env); // 'auto' by default
if (!mailer) return errorResponse(error ?? 'No email provider configured', 500);

await sendTemplatedEmail(mailer, {
    from,
    to,
    template: 'welcome', // a registered template NAME, or an inline EmailTemplate object
    subject: 'Welcome',
    variables: { name },
});
```

`resolveAppMailer(env, provider?)` builds a mailer per request from env. `'auto'` resolution order: **dev-trap**
(`DEV_EMAIL_TRAP_ENABLED`+KV) → **nodemailer** (`EMAIL_SERVER`) → **ses** (`AWS_*`) → **resend**
(`EMAIL_RESEND_API_KEY`); returns `{ mailer: null, error }` if none configured.

## Providers

Factories: `createResendMailer`, `createSESMailer`, `createNodemailerMailer` (subpath
`@ottabase/email/providers/nodemailer` — Node-only, kept out of the edge bundle), `createDevEmailTrapMailer` (+
`createKvEmailTrapStore`), `createNoopMailer`. `createCloudflareMailer`/`createMailChannelsMailer` exist in the package
but are **not** wired into `resolveAppMailer` — add a resolver branch if you want them.

## Templates

A module-level registry (`registerEmailTemplate` / `getEmailTemplate` / `listEmailTemplates`). A `'default'` template is
registered at load; the app registers its own via `registerAppEmailTemplates()` (`apps/*/src/email/templates/`).
`template` is `string | EmailTemplate`.

## Gotchas

- **Template name is a bare string, not a typed union.** A string that isn't registered makes `renderEmail` **throw
  `Email template not found: <name>`** at runtime — there is no compile-time check. Register the template (add it to the
  app's `APP_TEMPLATES` array) before you reference it, and keep names as shared constants. (Typed template names are a
  roadmap item.)
- No `email.defaults` / configured singleton — every send passes a `mailer`.
- Keep provider secrets in env; never hardcode. Read env via `getOttabaseConfig(env)`, not `process.env`.

## Authoritative sources

`packages/email/README.md`, `packages/email/src/{mailer,templates,types}.ts`,
`apps/otta-web/worker/lib/email-provider.ts`. Full docs: `/llms-full.txt`.
