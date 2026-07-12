# Copilot instructions — Ottabase monorepo

Canonical agent instructions live in the root `AGENTS.md` (always read it first). Each package and
app has its own `AGENTS.md` with verified imports and canonical usage — read it before writing code
in that directory. Deep runbooks: `docs/agents/`.

Hard rules (summary):

1. OttaORM first: models inherit `BaseModel`; no raw SQL/vanilla Drizzle unless necessary. Business
   logic lives in fat models, never controllers/services.
2. Cloudflare edge runtime: no Node-only APIs (fs, child_process) in app/worker code.
3. Multi-tenant isolation and RLS context (`organizationId`, `userId`, `appId`) are mandatory;
   never bypass RLS.
4. Internal deps `workspace:*`; shared external deps `catalog:`; pnpm only (never npm/yarn).
5. Sanitize all user-provided HTML/URLs via `@ottabase/utils/sanitize`; no raw
   `dangerouslySetInnerHTML`.
6. API failures use `errorResponse(...)` from `@ottabase/utils/http-errors`.
7. Check `@ottabase/utils` and `@ottabase/ui-shadcn` before writing new helpers/components; always
   add dark-mode classes to new UI.
8. When Cloudflare bindings change, keep `wrangler.jsonc` and `cloudflare-env.d.ts` in sync.
9. Build/test scoped: `pnpm build:pkg --filter=<pkg>`, `pnpm test --filter=<pkg>`. TypeScript only.
10. Update the relevant `README.md` and tests with every meaningful change; never create stray
    summary files.
