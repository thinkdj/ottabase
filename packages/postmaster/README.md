# @ottabase/postmaster

The half of email that is not sending: inbound mail for Cloudflare Email Routing, a suppression list, signed one-click
unsubscribe, and Resend/SES bounce and complaint webhooks, as one Ottabase package. `@ottabase/email` stays what it is:
templates and senders.

A support inbox needs mail to arrive. A newsletter needs an unsubscribe link that mail clients honour and a list of
addresses that must never be mailed again. Both need to hear about bounces. This is that plumbing.

## Install

```bash
pnpm add @ottabase/postmaster
```

```typescript
// apps/otta-web/ottabase/packages/postmaster.ts
import {
    createPostmasterPackage,
    createSuppressions,
    createUnsubscribe,
    createInboundEmailHandler,
} from '@ottabase/postmaster';

export const suppressions = createSuppressions(); // reads the email_suppressions table
// Secret and public URL live in env, so links are minted per env (memoise in real code).
const unsubscribeFor = (env: CloudflareEnv) =>
    env.EMAIL_UNSUBSCRIBE_SECRET
        ? createUnsubscribe({
              secret: env.EMAIL_UNSUBSCRIBE_SECRET,
              url: `${env.AUTH_URL}/api/email/hooks/unsubscribe`,
          })
        : null;

export const postmasterPackage = createPostmasterPackage<CloudflareEnv>({
    appId: (env) => getOttabaseConfig(env).appId,
    suppressions,
    unsubscribe: unsubscribeFor,
    resend: { webhookSecret: (env) => env.EMAIL_RESEND_WEBHOOK_SECRET },
    ses: { pathSecret: (env) => env.EMAIL_SES_WEBHOOK_SECRET },
    onProviderEvent: (event, env) => events.emit(env, 'email.provider', event),
    onUnsubscribe: (entry, env) => events.emit(env, 'email.unsubscribed', entry),
});

// The Worker's email() export: parsed mail onto the bus, for whichever package wants it.
export const handleInboundEmail = createInboundEmailHandler<CloudflareEnv>({
    accept: ['support@acme.test'],
    onMessage: (mail, env) => events.emit(env, 'email.inbound', mail),
});
```

List `postmasterPackage` in `ottabase/packages.ts`; add `email: handleInboundEmail` to the Worker's default export;
point Email Routing at the Worker. The `email_suppressions` table, its model and policy, and the routes under
`/api/email/hooks` are installed.

## Inbound

`parseInboundEmail(message)` turns what Email Routing streams into plain data: envelope from/to, parsed from/to/cc,
subject, text and HTML bodies, message ids, headers, attachments (as `ArrayBuffer`s) and the `+tag` of a plus address
(`support+t0k3n@…` → `t0k3n`, the natural way to thread replies back to a ticket). `createInboundEmailHandler` wraps it
for the Worker: unknown mailboxes are rejected at SMTP time, oversize or unparseable mail is rejected with a reason, and
your `onMessage` receives the parsed message. Parsing is `postal-mime`.

## Suppression

```typescript
await suppressions.suppress(appId, 'bounced@example.org', 'bounce', { source: 'resend' }); // list '*': never again
await suppressions.suppress(appId, 'tired@example.org', 'unsubscribe', { list: 'newsletter' });
await suppressions.isSuppressed(appId, 'tired@example.org', 'newsletter'); // true; '*' entries apply to every list

const mailer = suppressions.guard(resendMailer, appId, 'newsletter'); // drops suppressed recipients before sending
```

Hard bounces and complaints from the webhooks are recorded as `*` suppressions automatically.

`email_suppressions` is indexed for both lookups a sender makes: `(app_id, list, address)` (unique) for the send-time
check of an address against `*` and one list, and `(app_id, address)` for one address across every list (a person's
timeline).

## Unsubscribe

```typescript
const message = await unsubscribe.withHeaders({ from, to, subject, html }, { appId, address: to, list: 'newsletter' });
// List-Unsubscribe: <mailto:…>, <https://…/unsubscribe?token=…>
// List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Tokens are HMAC-signed and stateless: no table to look up, and a link in a year-old mail still works while the secret
does. `unsubscribe` on the package can be a function of env, since the secret and the public URL live there. The route
accepts `GET` (a person clicking) and `POST` (a mail client's one-click button).

## Webhooks

| Route               | Provider | Verification                                                                                                                   |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `POST /resend`      | Resend   | Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) with the `whsec_` secret, five-minute window                    |
| `POST /ses/:secret` | SES/SNS  | A path secret you choose, plus an optional `verify` hook for the SNS signature; subscription confirmations are visited for you |

Every event reaches `onProviderEvent` after suppression is recorded, so a lifecycle-email package can react to a
delivery and a dashboard can count bounces.

## Design notes

- **One table, three meanings.** `list = '*'` is "never, for anything"; a list name is one unsubscribe. A lookup for a
  list checks both.
- **Soft bounces are reported, not suppressed.** A full mailbox is not a dead address.
- **Verification is where it can be done.** Resend's signature is checked here; SNS needs its certificate fetched, which
  is the host's call, so that route takes a path secret and a `verify` hook.
