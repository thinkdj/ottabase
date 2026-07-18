<!--
PRIVATE FOUNDER STRATEGY — ideation catalog, not part of the Ottabase framework.
Do NOT merge into any branch that reaches the public repo.
Source: Opus reasoning (no research fan-out, no market verification). Ideas are hypotheses,
not validated findings. Anything that graduates to "worth building" should get a real
verification pass and move into STARTUP-RESEARCH-LOG.md.
-->

# Ottabase — 2026 Ideation Master Catalog

**Started:** 2026-07-17 · **Mode:** pure reasoning, zero research spend · **Companion docs:**
[`STARTUP-RESEARCH-LOG.md`](./STARTUP-RESEARCH-LOG.md) (verified market findings) ·
[`IDEATION_API_MOCKS_SITE.MD`](./IDEATION_API_MOCKS_SITE.MD) (mock-API deep-dive).

> This file is the vivid-ideas workbench. Newest ideas at the top of the catalog. Each carries a
> one-line picture, the wedge, why **only you** can do it cheaply, the 2026 tailwind, the honest
> kill-risk, and a conviction tier. Nothing here is market-verified — treat as raw ore.

---

## The lens — what makes an idea *yours*

An idea earns a slot here only if it leans on at least one of your genuine unfair advantages:

- **A. Cheap isolated stateful edge tenants** — you can spin up a fully-working, isolated instance
  per customer/demo/PR for near-zero idle cost. Normal infra can't.
- **B. You own the real backend** — the "commodity→real" funnel (below). The one selling the throwaway
  can't graduate it; you can.
- **C. Solo + agents throughput** — you can produce and operate *many* small products/tenants at once.
- **D. Edge-native** — global low latency, cheap idle, provable regional data pinning.
- **E. White-label multi-tenant** — 1→N branded instances is a config change, not a rebuild.

**Buyer rule:** favour ideas whose payer is a **team / agency / AI-app builder**, not a solo
hobbyist dev (dev tooling has brutal free-tier gravity and near-zero WTP).

## Reusable levers (idea generators)

1. **Commodity front-door → promote to a real Ottabase backend.** Anywhere people use a throwaway
   fake, be the one whose fake *graduates* into production. You own the prod side; nobody else
   selling the fake does. This asymmetry regenerates endlessly.
2. **One founder runs N isolated stateful tenants.** Portfolio/instance economics — the *production
   line* is the moat, not any single instance.
3. **Own the boring-reliable organs AI agents lack** — memory, audit, approval, replay. Not another
   agent framework; the spine underneath one.

---

## Catalog

### ★ 0. Real Backend for Vibe-Coded Apps — *the synthesis play*

**Picture:** someone ships a slick frontend from v0 / Bolt / Lovable, then hits the wall — no real
auth, no real DB, no multi-tenant safety, no RLS. They snap in Ottabase as a hosted drop-in backend
and in minutes have production-grade auth + data + row-level security that's *actually* tenant-safe.

- **Why it's the headline:** it fuses the **validated #1 winner** (AI build rescue / vibe-code
  cleanup — see research log) with your *actual product*. Instead of hand-cleaning vibe-coded apps
  as a service, you sell the **backend they graduate onto**. Service → product.
- **Wedge:** "your AI-built app has no real backend — get one that won't leak tenant data, in an
  afternoon." Levers B + A + E.
- **2026 tailwind:** the vibe-coding wave is minting thousands of frontend-only apps with unsafe or
  nonexistent backends, right now.
- **Risk:** Supabase/Convex/Firebase are the reflex answer — you win on *multi-tenant-safe by
  default* + *edge* + *you already wrote the hard parts*, not on brand.
- **Tier:** 🟢 highest conviction — build-adjacent to the one thing already validated.

### 1. Genie Envs — disposable full-stack demo/preview instances

**Picture:** a sales engineer pastes one link in Zoom chat; the prospect clicks and lands inside
their *own* pristine, fully-seeded copy of the product — real login, real data — that self-destructs
in 24h.

- **Wedge:** disposable *full-stack* environments, not just preview URLs. Levers A + C.
- **2026 tailwind:** every SaaS wants friction-free trials; "book a demo" is dying vs. "touch it now."
- **Only you:** per-tenant isolation is your native primitive, not a bolt-on.
- **Risk:** you're selling to other SaaS teams → need one sharp beachhead (sales demos? design-partner
  trials? workshop seats?).
- **Tier:** 🟢 strong infra play.

### 2. Lie Detector — status pages that turn themselves red

**Picture:** 3am, an endpoint starts timing out in Frankfurt; your page flips to *degraded* and fires
the subscriber webhook while the founder's still asleep.

- **Wedge:** status driven by *actual multi-region synthetic checks*, not a human flipping a switch
  (Statuspage/Instatus lie until someone notices). Levers D + own realtime/cron.
- **Only you:** realtime + cron + global edge presence already in your packages.
- **Risk:** status pages are cheap/bundled — wins only if "automatic + honest" is a real buying
  reason (it is for infra-cred-conscious teams).
- **Tier:** 🟡 product-shaped, easy to market solo.

### 3. Nervous System — give your AI agent a spine

**Picture:** "your agent tried to refund $4,200 — approve?" pings a phone; a human taps approve, the
agent continues. Every action it ever took sits in a tamper-proof log.

- **Wedge:** not another agent framework — the boring reliable *organs*: durable memory (DO),
  tamper-proof audit log (audit pkg), human approval inbox (queue + realtime). Lever 3.
- **2026 tailwind:** agents are being put near money and customers faster than anyone's making them
  safe.
- **Risk:** devs-won't-pay gravity → sell to teams putting agents near money/customers.
- **Tier:** 🟢 ties to validated AI theme; coherent with your stack.

### 4. Time Machine — the webhook layer that never drops

**Picture:** scrub back to 2:14pm Tuesday, see the exact payload that broke, tweak a transform, and
*re-fire* it into your endpoint.

- **Wedge:** durable + replayable + inspectable + transformable webhooks for non-enterprise teams
  (Svix aims up-market). Levers: queues + DO + edge durability are *literally* this shape.
- **Risk:** infra buyers demand a "10-minute wow"; needs a killer first-run.
- **Tier:** 🟢 strong infra play.

### ★ 5. Flight Recorder — *collision of #3 + #4*

**Picture:** scrub back through everything your agent did, see each tool call and its payload, and
*re-run from any step* with a tweak.

- **Wedge:** audit-and-replay for **agent actions** specifically — the black-box problem everyone
  shipping agents is about to hit. Combines Nervous System (audit/approval) + Time Machine
  (durable replay).
- **Tier:** 🟢 possibly the sharpest AI-native one; worth a dedicated deep-dive.

### 6. Mock → Real API Host — *see the dedicated deep-dive*

Hosted custom mock APIs whose schema *graduates* into a real Ottabase backend (lever 1). Vanilla mock
hosting is a red ocean (mockapi.io, Beeceptor, Postman-bundled); the graduation funnel is the
uncopyable wedge. Full write-up: [`IDEATION_API_MOCKS_SITE.MD`](./IDEATION_API_MOCKS_SITE.MD).
**Tier:** 🟡 (front door commodity; value is the funnel to #0).

### 7. Your Own Box — anti-multi-tenant as the pitch

**Picture:** a privacy-anxious buyer gets *their own* fully-isolated instance — data never
co-mingled, their subdomain, their region — because "we can't be in a shared DB" is a real objection.

- **Wedge:** sell isolation as the feature. Levers A + D + E.
- **Risk:** support/ops of many instances — but that's exactly what your framework automates.
- **Tier:** 🟡 needs the right isolation-sensitive niche.

### 8. Micro-Tool Farm — portfolio of tiny edge faucets

**Picture:** 20 tiny paid APIs/tools (realistic-data API, screenshot/OG-image API, webhook-relay,
"turn this into a shareable link"), each dripping $200–500 MRR, all on one edge base.

- **Wedge:** the *production line* (you + agents) is the moat, not any single tool. Levers C + D.
- **Risk:** each tool individually commoditized; only works as a system with cheap idle cost.
- **Tier:** 🟡 portfolio economics; matches solo+agents identity.

### 9. Seed-Data-as-a-Service — the Contoso of any industry

**Picture:** "populate your demo with a believable fake company — 3 years of interlinked history —
in one click."

- **Wedge:** coherent, domain-specific, *relational* fake datasets (not raw random) for demos and
  sales envs. Adjacent to #1 and the mock host.
- **Risk:** commodity faker libraries at the bottom; differentiation is *believable domain coherence*.
- **Tier:** ⚪ feature or companion to #1/#6 more than a standalone.

### 10. Data-Residency SaaS-in-a-Box

**Picture:** "run this app pinned to Germany / India / UAE, provably" — for buyers with hard residency
requirements incumbents fumble.

- **Wedge:** Cloudflare regional isolation as the product. Lever D.
- **Risk:** residency buyers often want enterprise assurances a solo can't easily give.
- **Tier:** ⚪ real but sales-heavy; park unless a specific buyer appears.

---

## Portfolio view

| # | Idea | Primary lever | Payer | Effort | Conviction |
|---|------|---------------|-------|--------|------------|
| 0 | Real Backend for Vibe-Coded Apps | B (own backend) | AI-app builders | Med | 🟢🟢 |
| 5 | Flight Recorder (agent audit+replay) | 3 (agent organs) | AI teams | Med-High | 🟢 |
| 3 | Nervous System (agent spine) | 3 | AI teams | Med | 🟢 |
| 1 | Genie Envs (disposable envs) | A | SaaS teams | Med | 🟢 |
| 4 | Time Machine (webhooks) | queues+DO | Dev teams | Med | 🟢 |
| 2 | Lie Detector (honest status) | D + realtime | Infra teams | Low-Med | 🟡 |
| 6 | Mock → Real host | 1 (funnel) | Devs/teams | Low-Med | 🟡 |
| 7 | Your Own Box (isolation) | A+D+E | Privacy buyers | Med | 🟡 |
| 8 | Micro-Tool Farm | C | Mixed | Low each | 🟡 |
| 9 | Seed-Data-as-a-Service | 1 | Demo/sales | Low | ⚪ |
| 10 | Data-Residency Box | D | Regulated buyers | High | ⚪ |

**If forced to pick two to prototype:** **#0 (Real Backend for vibe-coded apps)** as the flagship —
it monetizes the one validated market with your actual product — and **#5 (Flight Recorder)** as the
AI-native bet with the least crowded field.

## Parking lot (adjacent but weak / already killed)

- Generic white-label client portals — 🔴 crowded, $39 ceiling, adoption problem (research log).
- MCP tool marketplaces — 🔴 killed prior. (Exposing *your own* product over MCP ≠ a marketplace; fine
  as a feature, not a business.)
- Ephemeral collaboration rooms (disposable whiteboard/voting per meeting) — ⚪ consumer-ish, low WTP.
- Edge feature-flag service — ⚪ crowded (LaunchDarkly/Flagsmith); only a low-end wedge.
- EU e-invoicing bridge — tracked in the **research log** as the non-edge "ride the deadline" play.

---

*Append new vivid ideas at the top of the Catalog. When one earns a real build/verify decision,
promote a summary into `STARTUP-RESEARCH-LOG.md` and, if it needs its own depth, spin a dedicated
`IDEATION_<name>.MD` like the mock-API one.*
