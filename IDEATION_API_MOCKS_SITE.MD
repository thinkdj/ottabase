<!--
PRIVATE FOUNDER STRATEGY — ideation notes, not part of the Ottabase framework.
Do NOT merge into any branch that reaches the public repo.
Sourced from model knowledge (early-2026 cutoff), not a fresh market crawl — competitor
details are directional. No adversarial verification was run on this.
-->

# Ideation — Hosted Custom Mock-API Product

**Date:** 2026-07-17 · **Basis:** Opus reasoning from knowledge (no research fan-out) ·
**Prompt:** "Is there still scope for apps that host custom mock APIs for clients — client
defines a data model (e.g. `GET /names → { id: int, name: <random english name> }`), gets a
hosted mock API back?"

## TL;DR

The **vanilla** version — "define a schema, get hosted fake JSON endpoints" — is a red ocean
**and** partly bundled, which is the Jobber-lesson death combo. Don't build mockapi #14. But the
live wedges have moved, and one of them (**mock → real backend graduation**) is unusually
well-matched to Ottabase and structurally uncopyable by the incumbents.

## Who already owns the plain version

| Incumbent                    | What it does                                                       | Threat |
| ---------------------------- | ----------------------------------------------------------------- | ------ |
| **mockapi.io**               | Almost exactly the example: define resources + field types → hosted REST with fake data | Direct, cheap, established |
| **Beeceptor / Mockaroo / Reqres / Mockend** | Hosted mock endpoints / realistic data generation                  | Crowded field |
| **Postman mock servers**     | Mock servers **bundled free-ish** inside a tool devs already open daily | **Bundling threat** |
| **Prism / Microcks / WireMock** | Contract-testing / mock-from-OpenAPI end of the market            | Adjacent, more enterprise |

Commodity "fake JSON" is worth ~$0 and dev willingness-to-pay for it is famously low.

## Where it's genuinely still open (2025–26 shifts)

1. **Stateful mocks, done properly.** Most hosts are stateless or fake-stateful — POST doesn't
   really persist, relationships don't hold. Ottabase's D1 + Durable Objects + real ORM could do
   *actually* stateful, per-tenant, globally low-latency mocks (POST creates it, GET returns it,
   foreign keys resolve). This is exactly where mockapi.io is thin. **Infra moat, not a feature
   race.**

2. **Mock → real backend graduation. ← the standout.** Everyone else's mock is a throwaway
   dead-end because nobody selling mocks owns the prod side. Ottabase *owns a real ORM/backend
   framework*, so the mock becomes the **on-ramp**: the schema you mock with becomes your
   production schema in one click. "Prototype against a fake API today, promote the same schema to
   a real Ottabase app when you're ready." Structurally uncopyable by the incumbents.

3. **Mocking for AI-app / agent builders.** Fresh, growing pain: agent developers need to mock the
   *tool calls and external APIs* their agent hits — deterministically, with scripted responses,
   latency, and failure injection — to test behavior in CI. Not "fake user data"; "make this flaky
   third-party API behave predictably." Adjacent to the validated AI-build theme.

4. **Failure / chaos injection as a service.** Mocks that simulate rate limits, 500s, timeouts,
   partial outages so teams test resilience. Thin, focused; teams (not solo devs) pay for it.

## Honest kill-risk

Dev tooling here has brutal free-tier gravity and low WTP. The buyers who *pay* are **teams,
agencies, and AI-app builders** — not hobbyist solo devs. Whatever gets built must be positioned at
"team / agency / CI" from day one, not "free playground."

## Recommendation

**Lead with #2 (mock → real).** It turns a commodity feature into a funnel for the actual product
(Ottabase adoption), and it's the one thing incumbents can't structurally copy. Model:

- **Front door (loss-leader):** the pure hosted mock — stateful, edge-fast, realistic data. Free /
  cheap. Wins on quality (#1) vs. mockapi.io.
- **The business:** one-click "promote this schema to a real Ottabase backend." Mock becomes prod.
- **Positioning:** team/agency/CI, plus the AI-agent mocking angle (#3) as a second wedge.

## Open questions for a v1 pass (not yet done)

- Schema format — reuse Ottabase model/field metadata so mock and prod schemas are the *same*
  artifact (no translation), or a lighter JSON DSL for the front door?
- The "promote to real app" flow — how much of the wiring (tables, CRUD routes, RLS, hooks) auto-
  generates vs. needs the user?
- Pricing tiers and where the free/paid line sits given the free-tier gravity.
- Realistic-data engine — build on a faker-style library; how much "believable domain data" (names,
  addresses, relationships) is the actual differentiator vs. raw random.
- Distribution — does this ride Ottabase's public launch as the "try it in 30 seconds" on-ramp?

---

*Ideation only — no market verification run. Promote to the main research log if pursued.*
