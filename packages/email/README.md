# @ottabase/email

Edge-friendly email templating + mailer helpers for Ottabase.

## Features

- Handlebars templates (header/body/footer layout)
- Template registry + rendering helpers
- Mailer abstraction for providers
- Resend provider (fetch-based, edge-safe)
- AWS SES provider (HTTP API, edge-safe)
- Dev email trap provider for local workflows
- Cloudflare provider stub (pluggable transport)

## Install

```bash
pnpm add @ottabase/email
```

## Quick Start

```ts
import { createResendMailer } from '@ottabase/email/providers/resend';
import { sendTemplatedEmail } from '@ottabase/email/mailer';

const mailer = createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY });
```

### App-level Templates

Apps can define templates under app/email/templates and register them at runtime.

Example (Vite app):

```ts
// src/email/templates/spacious.ts
import type { EmailTemplate } from '@ottabase/email';

export const spaciousTemplate: EmailTemplate = {
    name: 'spacious',
    subject: '{{subject}}',
    layout: '...',
    header: '{{header}}',
    body: '{{{body}}}',
    footer: '{{footer}}',
};

// src/email/templates/index.ts
import { registerEmailTemplate } from '@ottabase/email';
import { spaciousTemplate } from './spacious';

export function registerAppEmailTemplates() {
    registerEmailTemplate(spaciousTemplate);
}
```

Then call `registerAppEmailTemplates()` before rendering or sending emails (for example in your Cloudflare worker or
demo page).

```ts
import { createResendMailer } from '@ottabase/email/providers/resend';
import { sendTemplatedEmail } from '@ottabase/email/mailer';

const mailer = createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY });

await sendTemplatedEmail(mailer, {
    from: 'Acme <hello@acme.com>',
    to: 'user@example.com',
    template: 'default',
    subject: 'Welcome, {{name}}',
    variables: { name: 'Ada' },
    content: {
        header: 'Welcome to Acme',
        body: '<p>Hi {{name}}, thanks for joining!</p>',
        footer: '<p>— The Acme Team</p>',
    },
});
```

## Templates

The default template uses a simple header/body/footer layout. You can register custom templates:

```ts
import { registerEmailTemplate } from '@ottabase/email/templates';

registerEmailTemplate({
    name: 'login',
    subject: 'Your login link',
    body: '<p>Click <a href="{{url}}">here</a> to sign in.</p>',
    footer: '<p>This link expires in {{minutes}} minutes.</p>',
});
```

## Cloudflare Provider

### MailChannels (recommended for Workers)

Use MailChannels transactional API for zero-dependency email from Cloudflare Workers:

```ts
import { createMailChannelsMailer } from '@ottabase/email/providers/cloudflare';

const mailer = createMailChannelsMailer({
    dkimDomain: 'example.com',
    dkimSelector: 'mailchannels',
    dkimPrivateKey: env.DKIM_PRIVATE_KEY,
});
```

### Custom transport

For other providers, use the pluggable wrapper:

```ts
import { createCloudflareMailer } from '@ottabase/email/providers/cloudflare';

const mailer = createCloudflareMailer({
    send: async (message) => {
        await myProvider.send(message);
        return { id: 'sent' };
    },
});
```

## AWS SES

Use AWS SES HTTP API (works in Cloudflare Workers):

```ts
import { createSESMailer } from '@ottabase/email/providers/ses';
import { sendTemplatedEmail } from '@ottabase/email/mailer';

const mailer = createSESMailer({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1', // optional, defaults to us-east-1
});

await sendTemplatedEmail(mailer, {
    from: 'noreply@example.com',
    to: 'user@example.com',
    template: 'default',
    subject: 'Welcome',
    variables: { name: 'User' },
    content: {
        header: 'Welcome',
        body: '<p>Hello {{name}}!</p>',
    },
});
```

**Setup:**

1. Create AWS IAM user with `ses:SendEmail` permission
2. Add credentials to your Cloudflare Worker environment:
    - `AWS_ACCESS_KEY_ID`
    - `AWS_SECRET_ACCESS_KEY`
    - `AWS_REGION` (optional, defaults to us-east-1)
3. Verify your sending domain/email in SES console

**Note:** SES uses HTTP API (not SMTP), so it works perfectly in Cloudflare Workers without any Node.js dependencies.

## Nodemailer (SMTP)

Use SMTP in Node environments:

```ts
import { createNodemailerMailer } from '@ottabase/email/providers/nodemailer';
import { sendTemplatedEmail } from '@ottabase/email/mailer';

const mailer = createNodemailerMailer({
    server: 'smtp://localhost:2525',
});

await sendTemplatedEmail(mailer, {
    from: 'Local <hello@local.test>',
    to: 'test@example.com',
    template: 'default',
    subject: 'SMTP test',
    variables: { name: 'Local' },
    content: {
        header: 'SMTP delivery',
        body: '<p>Sent via local SMTP.</p>',
    },
});
```

## Dev Email Trap

Use the built-in dev trap to capture emails in KV during local development without forwarding them to a real SMTP or API
provider.

```ts
import { createDevEmailTrapMailer, createKvEmailTrapStore } from '@ottabase/email/providers/dev-trap';

const store = createKvEmailTrapStore(env.OBCF_KV, {
    prefix: 'dev-email-trap:',
    maxEntries: 50,
});

const mailer = createDevEmailTrapMailer({ store });

await mailer.send({
    from: 'noreply@example.com',
    to: 'user@example.com',
    subject: 'Local sign-in link',
    html: '<p>Use this magic link in local development.</p>',
});
```

The captured messages include subject, recipients, rendered HTML/text, and a short preview so an admin UI can list and
inspect them.
