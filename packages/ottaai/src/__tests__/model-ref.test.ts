import { describe, expect, it } from 'vitest';
import { isDynamicModelRef, modelProviderMismatch, parseModelRef, qualifyModelRef } from '../model-ref';
import { createProviderRegistry } from '../registry';

const registry = createProviderRegistry();

describe('model-ref grammar — three forms, one column', () => {
    it('parses a bare id to a NULL provider, never an empty string or a default', () => {
        const parsed = parseModelRef('gpt-4o-mini', registry);
        expect(parsed).toMatchObject({ form: 'bare', provider: null, model: 'gpt-4o-mini' });
    });

    it('parses a registered head as a provider and keeps the whole multi-slash tail', () => {
        const parsed = parseModelRef('openai/some/nested/id', registry);
        expect(parsed).toMatchObject({ form: 'qualified', provider: 'openai', model: 'some/nested/id' });
    });

    it('TRAP 1 — a head beginning with `@` is NEVER a provider', () => {
        // Cloudflare edge-inference ids are slash paths that begin with `@`; naive splitting
        // turns `@cf` into a provider and corrupts the id silently. It affects only one
        // provider family, so it survives testing until someone picks that family.
        const parsed = parseModelRef('@cf/meta/llama-3.1-8b-instruct', registry);
        expect(parsed.form).toBe('bare');
        expect(parsed.model).toBe('@cf/meta/llama-3.1-8b-instruct');
    });

    it('TRAP 2 — an UNREGISTERED lowercase head is part of the model id, not a provider', () => {
        // Open-weights registries publish `<org>/<Model-Name>`; treating any
        // lowercase-alnum-hyphen head as a provider discards the credential's real provider.
        const parsed = parseModelRef('meta-llama/Llama-3.3-70B-Instruct', registry);
        expect(parsed.form).toBe('bare');
        expect(parsed.model).toBe('meta-llama/Llama-3.3-70B-Instruct');
    });

    it('parses a dynamic route as a DISTINCT form, not a provider literally named "dynamic"', () => {
        const parsed = parseModelRef('dynamic/default-chat', registry);
        expect(parsed).toMatchObject({ form: 'dynamic', dynamic: true, route: 'default-chat', provider: null });
        expect(isDynamicModelRef('dynamic/default-chat')).toBe(true);
    });
});

describe('qualification is IDEMPOTENT — that is what lets one column hold three forms', () => {
    it('qualifies a bare id with the credential provider', () => {
        expect(qualifyModelRef('openai', 'gpt-4o', registry)).toBe('openai/gpt-4o');
    });

    it('returns an already-qualified ref unchanged, even for a DIFFERENT provider', () => {
        expect(qualifyModelRef('openai', 'anthropic/claude-sonnet-4-5', registry)).toBe('anthropic/claude-sonnet-4-5');
        // No doubled prefixes.
        expect(qualifyModelRef('openai', qualifyModelRef('openai', 'gpt-4o', registry)!, registry)).toBe(
            'openai/gpt-4o',
        );
    });

    it('returns a dynamic ref verbatim', () => {
        expect(qualifyModelRef('openai', 'dynamic/route-a', registry)).toBe('dynamic/route-a');
    });

    it('leaves an `@`-prefixed id alone rather than mangling it', () => {
        expect(qualifyModelRef('workers-ai', '@cf/meta/llama-3.1-8b-instruct', registry)).toBe(
            'workers-ai/@cf/meta/llama-3.1-8b-instruct',
        );
    });
});

describe('a qualified model ref may not cross providers', () => {
    it('reports a mismatch when a stored model targets a different provider than the credential', () => {
        const message = modelProviderMismatch('openai', 'anthropic/claude-sonnet-4-5', registry);
        expect(message).toMatch(/anthropic/);
    });

    it('is silent for a bare id or a matching provider', () => {
        expect(modelProviderMismatch('openai', 'gpt-4o', registry)).toBeNull();
        expect(modelProviderMismatch('openai', 'openai/gpt-4o', registry)).toBeNull();
    });
});

describe('provider registry is per-instance and composable', () => {
    it('SUBSETS as well as extends — the half that gets forgotten', () => {
        const restricted = createProviderRegistry({ only: ['openai', 'anthropic'] });
        expect(
            restricted
                .list()
                .map((entry) => entry.id)
                .sort(),
        ).toEqual(['anthropic', 'openai']);
        expect(restricted.has('groq')).toBe(false);
    });

    it('defaults requiresKey to TRUE for an unregistered provider', () => {
        expect(createProviderRegistry().requiresKeyFor('never-heard-of-it')).toBe(true);
        expect(createProviderRegistry().requiresKeyFor(null)).toBe(true);
    });

    it('lets an operator override a built-in field', () => {
        const custom = createProviderRegistry({ extend: [{ id: 'workers-ai', requiresKey: true }] });
        expect(custom.requiresKeyFor('workers-ai')).toBe(true);
    });
});
