// ============================================================
// /.well-known/otta.json: the product's facts in the otta-context shape
// ============================================================
// The same document Ottabuzz serves for a project as `context.json`, version 2, written and
// read by @ottabase/context so every tool agrees on the shape. Served from the product's own
// site, it lets a tool read the facts the maker wrote instead of guessing them from the page.
// The public file has the owner's lines (neverClaim, the brief) empty; the same document with
// them in is served only behind the owner key (manifest.ts).
// ============================================================

export {
    contextHash,
    OTTA_CONTEXT_KIND,
    OTTA_CONTEXT_VERSION,
    OTTA_JSON_PATH,
    ottaJson,
    parseOttaJson,
    type OttaContext,
    type OttaContextProduct,
    type Scope,
} from '@ottabase/context';
