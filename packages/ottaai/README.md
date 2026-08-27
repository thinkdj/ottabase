# @ottabase/ottaai

Tenant **BYOK** for AI: a user's key → an org's key → the platform default → no client. Encrypted at rest, resolved
deterministically, gated server-side, and shipped with the settings UI.

The tenant's key pays for the tenant's inference — which is what lets you offer strong AI on a free plan, removes the
per-tenant cost ceiling, and answers "can we use your data" with the tenant's own provider contract.

> **Scope: text chat completion plus embeddings.** Chat uses `AiCallOptions`, whose message `content` is a plain string,
> and normalises to `text` plus token counts. Embeddings use the separate `AiEmbedOptions` / `client.embed()` contract,
> returning ordered numeric vectors and input-token accounting. Images, audio, tool calls and structured provider
> outputs still have **no representation to serialise**, so they are not supported however capable the chosen model is.
> The registry's `capabilities` decide which credential is eligible for a task; they do not widen either call contract.

## Provider support

The gateway transport calls only providers it has a **verified wire contract** for — a transcribed URL, auth scheme,
request body and response parser, each asserted literally in `__tests__/gateway-wire.test.ts`.

| Provider           | Gateway path                                             | Auth                              | Tenant BYOK               |
| ------------------ | -------------------------------------------------------- | --------------------------------- | ------------------------- |
| `openai`           | `/openai/chat/completions`, `/openai/embeddings`         | `Authorization: Bearer`           | ✓                         |
| `anthropic`        | `/anthropic/v1/messages`                                 | `x-api-key` + `anthropic-version` | ✓                         |
| `google-ai-studio` | `/google-ai-studio/v1/models/{model}:generateContent`    | `x-goog-api-key`                  | ✓                         |
| `groq`             | `/groq/chat/completions`                                 | `Authorization: Bearer`           | ✓                         |
| `mistral`          | `/mistral/v1/chat/completions`                           | `Authorization: Bearer`           | ✓                         |
| `deepseek`         | `/deepseek/chat/completions`                             | `Authorization: Bearer`           | ✓                         |
| `perplexity`       | `/perplexity-ai/chat/completions`                        | `Authorization: Bearer`           | ✓                         |
| `azure`            | `/azure-openai/{resource}/{deployment}/chat/completions` | `api-key`                         | ✓ (needs operator config) |
| `workers-ai`       | —                                                        | —                                 | ✗ platform only           |
| `cohere`           | —                                                        | —                                 | ✗ no verified wire        |
| `hugging-face`     | —                                                        | —                                 | ✗ no verified wire        |

**Note the `/v1` is not uniform.** AI Gateway proxies to each provider's own base URL, and those bases already differ in
whether they carry a version segment — so `/openai/v1/chat/completions` resolves upstream to `/v1/v1/…` and 404s, while
`/mistral/chat/completions` 404s for the opposite reason. There is no default that is correct for both; the table in
`src/transports/providers.ts` is the source of truth and carries a doc link per entry.

Providers marked ✗ are registered (so the platform path and the keyless-mismatch guard still work) but carry
`tenantSelectable: false`, which keeps them out of the settings form, the `/providers` endpoint and every tenant write
path. `workers-ai` has no tenant key to bring and is billed to the operator; `cohere` speaks its own `chat_history`
dialect and answers an OpenAI-shaped request with **HTTP 200 and an empty completion**, which is worse than an error.

**Azure is conditional, not unconditional.** Its gateway path carries operator-only `resourceName`, `deploymentName` and
`apiVersion`, supplied through `platform.transportConfig`. On a deployment that never set them, the transport reports
Azure via `unservableProviders()` and composition removes it from tenant selection — so the form does not offer a
provider whose every call would resolve `MERGE_INCOMPLETE`. The boot summary names it (`unservableUnderThisConfig`) so
"why is Azure missing?" is answerable from the log. In otta-web, set `CFAI_AZURE_RESOURCE_NAME`,
`CFAI_AZURE_DEPLOYMENT_NAME` and `CFAI_AZURE_API_VERSION` (all three, or none).

Any transport may implement `unservableProviders(platform)` for the same reason: a provider it supports in principle but
cannot route under _this_ operator's configuration.

### Request metadata

`cf-aig-metadata` carries `source`, `task` and `app` from the resolution's own provenance, and **trusted values are
written last** so a caller's `options.metadata` cannot overwrite them. That matters because AI Gateway dynamic routing
can branch on metadata: a call site that forwarded a request body could otherwise relabel a platform call as
`source: 'byok'` and take a route — and a budget — it was never entitled to. Caller tags are still forwarded; they just
cannot impersonate provenance.

## Architecture (entry points)

| Import                                | Contains                                                                                                              | Peer deps                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `@ottabase/ottaai`                    | types, error taxonomy, provider registry, model-ref grammar, field metadata, **crypto + keyring**, pure scoring/merge | none                                 |
| `@ottabase/ottaai/resolver`           | `createAiProvisioning`, the resolver, the instrumented client, verify-a-key, store + transport interfaces             | none                                 |
| `@ottabase/ottaai/ottaorm`            | table, model, RLS policy factory, ORM store, route factory, re-wrap job, **the composing factory**                    | `@ottabase/ottaorm`, `drizzle-orm`   |
| `@ottabase/ottaai/schema`             | the Drizzle table only (for `config.migrations.ts`)                                                                   | `drizzle-orm`                        |
| `@ottabase/ottaai/transports/gateway` | the Cloudflare AI Gateway adapter, its provider routing table and its wire dialects                                   | none                                 |
| `@ottabase/ottaai/react`              | status/gate hooks, credential mutations, the settings component                                                       | `react`, `@tanstack/react-query`, UI |
| `@ottabase/ottaai/testing`            | mock transport, in-memory store, deterministic keyring, fixtures, strict mode                                         | dev only                             |

Crypto lives at the **root**, not behind `./ottaorm`: an import tool, a re-wrap job or a CLI must be able to encrypt
without touching the ORM.

## The mental model

**Two planes, different trust.**

| Plane          | Who acts                          | Path                               | Guarded by                                              |
| -------------- | --------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| **Management** | the tenant, via API/UI            | CRUD on the credential table       | RLS + server-set tenancy + intra-tenant RBAC            |
| **Call**       | trusted server code, at call time | resolve → decrypt → merge → client | the caller passing an **already-authenticated** context |

The call plane **bypasses RLS on purpose**. RLS stops tenant A editing tenant B's row; it does not police the server's
own lookup. That is safe only because the context is branded, has no public constructor, and is membership-verified —
see `src/types.ts` and `src/ottaorm/policy.ts`.

**Two dials.** `mode` says _where a key may come from_; `strategy` says _whose key outranks whose_.

| mode               | may use tenant key | may use platform key |
| ------------------ | ------------------ | -------------------- |
| `platform`         | ✗                  | ✓                    |
| `auto` _(default)_ | ✓                  | ✓                    |
| `byok`             | ✓                  | ✗                    |

Layers **intersect**: `effective = packageDefault ∧ appConfig ∧ taskPolicy ∧ perCallOverride`. A layer may only remove a
permission, never grant one — so a call site can never re-enable a platform key the operator switched off. Turning BYOK
off entirely is `byokEnabled: false`, a rewrite rather than an intersection.

`strategy` is `user` · `org` · `user-then-org` _(default, B2C)_ · `org-then-user` _(B2B)_. **A task may narrow `mode`
but may never override `strategy`** — strategy is one half of a decision whose other half is the RLS filter dimension.

## Setup

### 1. Generate a master secret

```bash
openssl rand -base64 48
```

Put it in `.dev.vars` (local) or `wrangler secret put` (deployed):

```
AI_CREDENTIAL_SECRET=<the base64 output>
```

For rotation, use a keyring instead:

```
AI_CREDENTIAL_KEYRING={"k1":"<old secret>","k2":"<new secret>"}
AI_CREDENTIAL_KEY_ID=k2
```

Never type a master secret. `createKeyring` rejects anything below 32 bytes of decoded material, because HKDF-Extract
over a weak secret turns one stolen database backup into an offline break of every tenant's key.

### 2. Register the table

```ts
// ottabase/config.migrations.ts
import { aiProviderCredentialsTable } from '@ottabase/ottaai/schema';

const PACKAGE_REGISTRY = {
    ottaai: { tables: { aiProviderCredentialsTable }, migrations: [] },
    // …
};
```

### 3. Register the model and the policy

```ts
// worker/lib/db-utils.ts
import { AiProviderCredential, createCredentialPolicy } from '@ottabase/ottaai/ottaorm';

registerModels([...coreModels, AiProviderCredential]);
initRLS();
// AFTER initRLS() — the RLS registry is last-write-wins.
registerPolicy(createCredentialPolicy({ strategy: 'user-then-org' }));
```

Model registration makes the table resolvable; it does not itself authorize an HTTP surface. Prefer the package's
credential handlers below, which own permission checks, tenancy stamping, and secret-column filter/sort denial. If a
host deliberately allow-lists this model in its secure generic CRUD route, updates still pass through the model's
`prepareUpdateMutation` hook. That hook consumes OttaORM's already RLS-authorized complete snapshot, preserves immutable
tenancy and secret AAD, and returns the encrypted mutation to the same atomic RLS-constrained write. Direct model
updates use the same hook and load their own current row.

### 4. Compose the instance (per request)

```ts
// worker/lib/ai.ts
import { createKeyring } from '@ottabase/ottaai';
import { createAiProvisioningWithStorage, createRbacAuthorize } from '@ottabase/ottaai/ottaorm';
import { createKvVerifyLimiter } from '@ottabase/ottaai/resolver';
import { createGatewayTransport } from '@ottabase/ottaai/transports/gateway';

const ai = createAiProvisioningWithStorage({
    keyring: createKeyring({ keys: { k1: env.AI_CREDENTIAL_SECRET }, currentKeyId: 'k1' }),
    transport: createGatewayTransport(),
    platform: {
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        gateway: env.CFAI_GATEWAY_NAME,
        provider: 'openai',
        providerKey: env.CFAI_OPENAI_API_KEY,
        model: 'gpt-4o-mini',
    },
    strategy: 'user-then-org',
    tasks: [{ key: 'assist' }, { key: 'extract', mode: 'byok', gate: 'required' }],
    contextFrom: () => ({
        userId: security.userId ?? null,
        organizationId: security.organizationId ?? null,
        appId: config.appId,
        impersonated: false,
    }),
    verifyMembership: ({ userId, organizationId }) => OrganizationMember.isMember(userId!, organizationId),
    authorize: createRbacAuthorize(security),
    defer: (promise) => ctx.waitUntil(promise),
    handlers: {
        contextFromRequest: () => (security.userId ? { authenticated: true } : null),
        // A DURABLE verification budget. The in-memory fallback is module-scoped, which
        // survives a request but not isolate churn — an attacker rotating connections gets a
        // fresh budget on each. Back it with KV in production.
        verifyLimiter: createKvVerifyLimiter(env.OBCF_KV),
    },
});
```

`verifyMembership` and `authorize` are **required** whenever the strategy has an org dimension; composition throws
without them.

- **`verifyMembership` is CALLED on every resolution**, before any query runs — not merely required at boot. The brand
  on `AiContext` enforces provenance, not verification, so if the host hands over an org id it did not verify, the
  resolver drops the org dimension rather than reading that org's credential.
- **`authorize` gates org-scoped mutations _and_ privileged reads.** RLS isolates tenants, not members: without it any
  org member could replace the shared key with one they control and harvest colleagues' prompts. `testSavedCredential`
  counts as privileged — it decrypts the org key and sends it outbound on a member's command.

**Your inference route must gate on an authenticated session itself.** The credential routes 401 through the factory; an
inference route you write does not. That matters because a host's security context typically only membership-verifies an
org id when a user id is present, so an anonymous request can otherwise carry a client-supplied org header straight into
the RLS-bypassing resolver.

### 5. Mount the routes

```ts
const aiRouter = new Router();
aiRouter.get('/status', (c) => ai.handlers.status(c.req));
aiRouter.get('/providers', (c) => ai.handlers.providers(c.req));
aiRouter.get('/credentials', (c) => ai.handlers.list(c.req));
aiRouter.post('/credentials', (c) => ai.handlers.create(c.req));
aiRouter.post('/credentials/test', (c) => ai.handlers.test(c.req));
aiRouter.post('/credentials/:id/activate', (c) => ai.handlers.activate(c.req, c.params.id));
aiRouter.patch('/credentials/:id', (c) => ai.handlers.update(c.req, c.params.id));
aiRouter.delete('/credentials/:id', (c) => ai.handlers.remove(c.req, c.params.id));
apiRouter.mount('/api/ai', aiRouter);
```

### 6. Drop in the settings UI

```tsx
import { AiProviderSettings, AiProvisioningProvider } from '@ottabase/ottaai/react';

const aiRequest = async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> =>
    (await api<{ data: T }>(path, { method: init?.method ?? 'GET', body: init?.body })).data;

<AiProvisioningProvider basePath="/api/ai" request={aiRequest}>
    <AiProviderSettings allowOrgScope />
</AiProvisioningProvider>;
```

Add the package source glob to the app's Tailwind `content` array, or the components render structurally correct and
completely unstyled with no error:

```js
'../../packages/ottaai/src/**/*.{js,ts,jsx,tsx}',
```

`allowOrgScope` is ANDed with server truth (`status.orgScopeManageable`), which carries **both** the operator's
`allowOrgCredentials` dial and the strategy. Under `strategy: 'user'` an org-scoped row scores 0 and is permanently
unselectable, so the option is hidden and the create handler refuses it — offering it there would produce a credential
that is written, listed, and never used, with nothing erroring. Pass `allowOrgScope` and let the server decide; do not
re-read the app config in the page to compute the same answer twice.

### 7. Call it

An inference route wants **the gate and the client together** — `resolveWithGate` does both from one resolution:

```ts
const { gate, resolution } = await ai.resolveWithGate(ai.contextFrom(hostAuth), 'extract');
if (!gate.allowed) return errorResponse('Connect your own key to use this', 402, { code: gate.code });
if (!resolution.client) {
    // Absence of a client IS the signal — resolution never throws for this.
    return errorResponse('AI unavailable', 501, { code: resolution.reason });
}
const result = await resolution.client.complete({ messages: [{ role: 'user', content: prompt }] });
```

### 8. Generate embeddings

Embeddings use the exact same resolution, credential custody, source-aware quota and outcome pipeline as chat. Give the
task an embedding model and capability requirement; otherwise a normal chat task may resolve to a chat model and is
correctly refused before any provider request is sent.

```ts
const { resolution } = await ai.resolveWithGate(ai.contextFrom(hostAuth), 'search-index');
if (!resolution.client) return errorResponse('AI unavailable', 501, { code: resolution.reason });

const embedded = await resolution.client.embed({ input: ['first document', 'second document'] });
if (!embedded.ok) return errorResponse(embedded.message, embedded.status ?? 502, { code: embedded.code });

// `vectors[0]` belongs to "first document"; input order is preserved.
await vectorIndex.upsert(embedded.result.vectors);
```

```ts
tasks: [
    {
        key: 'search-index',
        defaultModel: 'openai/text-embedding-3-small',
        requiredCapabilities: ['embedding'],
    },
];
```

The shipped Gateway transport supports **OpenAI embeddings only** at `/openai/embeddings`. Other providers are refused
locally until they have an individually verified request and response wire contract; the package never guesses at a
provider's embedding dialect. `dimensions` is available for compatible OpenAI `text-embedding-3` models. Embeddings are
non-streaming and report input tokens only.

Do **not** write `requireByok(...)` then `resolve(...)`. It reads better and does the whole job twice — two candidate
fan-outs (two D1 queries each under a mixed strategy) and two envelope decryptions, per inference, on the hot path. The
two runs can also legitimately disagree if a credential changes between them, which surfaces as an allowed gate followed
by `NOT_CONFIGURED`.

`requireByok` remains for callers that want **only** the verdict — a middleware, a feature flag — and builds no client:

```ts
const gate = await ai.requireByok(context, 'extract');
```

Both are the **same resolver** as the runtime path, so the guard and the call cannot drift.

### Spend controls (required before enabling a platform floor)

**A usable platform route with no `quota` hook is unbounded operator spend.** Authentication is not a spend control: any
signed-in user can loop the inference route on the operator's account. The package refuses to be quiet about it —
composition logs `platformSpendUnbounded: true` in the boot summary and emits a `console.warn`.

**"Usable" is asked of the TRANSPORT, not inferred from `platform.providerKey`**, and the distinction is load-bearing.
Gateway-billed inference has no provider key: a gateway holding the credential (a BYOK alias, unified billing) still
yields a complete platform config, so a key-based predicate reports "nothing to protect" on a deployment that can very
much spend the operator's money — staying silent on exactly the shape that needed the warning. Composition therefore
builds the platform path's own merged config once and asks `transport.isComplete()`, exposing the answer as
`platformRouteUsable` both on the instance and in the boot summary. **Host-side spend warnings should key on that.**

It warns rather than throws on purpose. A missing `authorize` hook is a **security** hole (any org member can take the
shared key) and hard-fails at composition; this is a **cost** hole — recoverable, visible on an invoice, and
hard-failing it would brick every deployment that already has a platform route.

`quota` is called after resolution and **before** the outbound call, and it receives `source`:

```ts
quota: async ({ source, taskKey, organizationId, userId }) => {
    // `source` is why this belongs here and not in route middleware: only after resolution
    // do you know whether this call spends the OPERATOR'S money or the TENANT'S.
    if (source !== 'platform') return true; // BYOK — their key, their provider's limits
    return underLimit(organizationId, userId);
},
```

Returning `false` produces a classified `RATE_LIMITED` result and a `quota.exceeded` event, so the refusal is attributed
and observable rather than a bare 429 thrown from a route. It covers `stream()` and every call site, not just one
endpoint.

otta-web ships a reference implementation in `worker/lib/ai-rate-limit.ts`: a KV fixed-window limiter over **three
dimensions** — per user, per organization, and an app-wide ceiling — with limits in `features.ottaai.rateLimit`,
env-overridable so a live deployment can be tightened without a redeploy. Three rules in it are worth copying into any
other implementation.

**Fail closed for platform spend, open for BYOK** — when the store is missing or erroring. The operator's money must not
become unlimited because a binding was forgotten; the tenant's own paid feature must not be bricked for the same reason.

**Check every dimension before charging any.** Charging each bucket as it passes turns a narrow rejection into a wide
denial of service: with `perUser: 20` and `perApp: 600`, a single user's 21st call increments the app bucket and only
then fails on the user bucket — so 580 further rejected calls, free to that user and spending no provider tokens, drain
the app-wide budget and deny AI to every other account for the rest of the window. Reordering the checks does not fix it
(a caller under their own limit but over their org's poisons the aggregate the same way); only preflighting does.

**The aggregate ceiling is mandatory; the per-actor ones are not.** `perUser` and `perOrganization` each bound one actor
and say nothing about the total, so `perApp` is the only limit on what an operator can spend. A deployment that can bill
the operator and sets `perApp <= 0` has its platform calls refused rather than left uncapped — same asymmetry as a
missing store, and the same escape hatch: use a large number, not zero. Env overrides are normalised through the same
rule as the config path, so an invalid value falls back instead of silently uncapping.

It is a **best-effort burst control, not a billing quota**. The counters are eventually consistent, so the effective
ceiling is roughly the configured limit plus the in-flight concurrency count — a hard global budget needs a strongly
consistent coordinator such as a Durable Object. (Cloudflare's own rate-limit binding is likewise location-local and
eventually consistent.) Token accounting against a commercial policy — free tier, reset period, retries, refunds,
per-model pricing, admin overrides — is deliberately out of scope here.

### Organization-scoped keys

`allowOrgCredentials` is a **server dial**, passed to `createAiProvisioning`. It gates `handlers.create` and is ANDed
into `status().orgScopeManageable`, which is what the settings component reads. Passing it only to the React component
hides a radio button and leaves `POST /credentials {"scope":"organization"}` working for every authorized admin with a
`fetch` call.

## Resolution, in one table

| stage | exit condition                               | source     | reason                     |
| ----- | -------------------------------------------- | ---------- | -------------------------- |
| 1     | mode forbids a tenant key                    | → platform | `MODE_PLATFORM_ONLY`       |
| 1i    | impersonated actor                           | → platform | `IMPERSONATED_ACTOR`       |
| 2     | neither org nor user in context              | → platform | `NO_TENANT_CONTEXT`        |
| 4     | no rows                                      | → platform | `NO_CREDENTIAL`            |
| 4a    | rows exist, none eligible                    | → platform | aggregated verdict         |
| 5     | decrypt failed                               | **stop**   | `CREDENTIAL_UNREADABLE`    |
| 6     | keyless credential vs a platform key         | → platform | `SKIPPED_KEYLESS_MISMATCH` |
| 6b    | `byok` and the winner carries no secret      | → platform | `NO_TENANT_SECRET`         |
| 7     | adapter says the merged config is incomplete | → platform | `MERGE_INCOMPLETE`         |
| 7✓    | merged                                       | `byok`     | `SELECTED`                 |
| 9     | platform fallback built                      | `platform` | `PLATFORM_FALLBACK`        |

Every resolution returns **both** `reason` and `tenantReason`. Without the second, `auto` flattens every distinct cause
into `PLATFORM_FALLBACK` and "why am I not on my own key?" becomes unanswerable.

**Selection, not cascade.** The resolver makes one pass and returns one credential. If the selected key is revoked or
rate-limited, the call **fails** — it does not silently fall back to the platform, because spending your credits on a
tenant's expired key hides the problem from the person who must fix it. The optional
`degradation: 'platform-on-auth-error'` policy allows exactly one retry, on 401/403 only, never on 429.

**Decrypt failure fails closed, in every mode.** A wrong master secret in a deploy would otherwise move every tenant's
spend onto the operator's bill while traffic looked completely normal — an incident discovered by invoice.

## Rotation

```ts
import { canRetireKey, rewrapCredentials } from '@ottabase/ottaai/ottaorm';

const progress = await rewrapCredentials({ keyring, decryptors: ai.decryptors, store: ai.store, fromKeyId: 'k1' });
const { safe, remaining } = await canRetireKey(ai.store, 'k1');
```

`canRetireKey` scans **envelopes**, not the `key_id` index column. A partial restore makes the index read zero while
old-key rows remain; retiring on that makes those credentials permanently undecryptable. Keep the retired secret in cold
escrow for one full backup-retention period.

## Testing

```ts
import { createMemoryStore, createMockTransport, createTestKeyring, strictModeSink } from '@ottabase/ottaai/testing';
```

**Strict mode** fails a test when resolution falls through to the platform unexpectedly. In development the platform
fallback is always configured, so a broken BYOK-required path resolves successfully and every test passes — right up
until production, where it presents as a billing inversion or a gate that never engages.

```bash
pnpm test --filter=@ottabase/ottaai
```

The suite runs in `node` (Web Crypto fidelity for the envelope tests) with one file opting into jsdom via
`// @vitest-environment jsdom` for the React surface. It covers, deliberately:

| File                         | What would otherwise fail silently                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `crypto.test.ts`             | AAD row-binding, sniffer false-positives (a plaintext key stored unencrypted), hint encoding         |
| `pure.test.ts`               | every cell of the score matrix, the conflict/app-scope tables, the merge rows, all three guard terms |
| `resolver.test.ts`           | every stage and reason of the state machine, fail-closed decrypt, dry-run vs force-platform          |
| `model-write-path.test.ts`   | the four secret rules through direct and RLS-constrained model writes, plus every scope rung         |
| `review-regressions.test.ts` | defects found by adversarial review — wrong cost attribution, inert dials, lost metering             |
| `gateway-wire.test.ts`       | the literal URL, headers, body and SSE framing per provider — see below                              |
| `gateway-smoke.test.ts`      | **opt-in**: a real call to a real gateway. Skipped unless `OTTAAI_SMOKE_*` is set                    |
| `react/…`                    | "leave blank keeps the key", the fail-closed gate, org-scope following server truth                  |

`gateway-wire.test.ts` exists because of what its absence cost. The transport shipped with a green suite and four
separate wire faults — `/openai/v1/chat/completions`, a missing `anthropic-version`, dynamic routes built as a URL
segment, and the BYOK alias sent as `cf-aig-provider-key` instead of `cf-aig-byok-alias`. Every one is a claim about a
**string**, and no amount of scoring, crypto or resolution testing can catch a fact that nothing asserts. When you add a
provider, add its row there first.

`gateway-smoke.test.ts` covers what the wire tests structurally cannot: the wire tests prove we send what Cloudflare's
docs **say**; only a real call proves Cloudflare still **accepts** it. Two surfaces make that a live risk rather than a
hypothetical one — the OpenAI-compatible endpoint that dynamic routing depends on is documented as deprecated in favour
of the AI Gateway REST API, and Dynamic Routing itself is Beta. Run it before a release and after any AI Gateway
announcement:

```bash
OTTAAI_SMOKE_ACCOUNT_ID=… OTTAAI_SMOKE_GATEWAY=… OTTAAI_SMOKE_PROVIDER=openai OTTAAI_SMOKE_MODEL=gpt-4o-mini OTTAAI_SMOKE_KEY=sk-… pnpm --filter @ottabase/ottaai exec vitest run gateway-smoke
```

## Custody

There is **no reveal-key affordance**. Not for support, not for the tenant, not behind an approval workflow. A reveal
path converts one compromised admin session into full credential exfiltration across every tenant. A tenant who lost
their key obtains a new one from their provider.

`buildCustodyDisclosure()` ships the exact factual paragraph to place next to the connect form and in your DPA — a
gateway processes tenant prompts and must be disclosed as a sub-processor.
