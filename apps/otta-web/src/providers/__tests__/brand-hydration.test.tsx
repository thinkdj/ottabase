// ---------------------------------------------------------------------------
// Edge → client brand hydration handoff contract test.
// Round-trips a realistic config through the REAL buildInitialConfigScriptTag
// (what the worker injects) into the DOM and back through the REAL
// readInjectedBrandConfig (what Providers.tsx hydrates from) — the two halves
// are otherwise only linked by an unchecked type cast.
// ---------------------------------------------------------------------------

import { INITIAL_CONFIG_ELEMENT_ID, buildInitialConfigScriptTag } from '@ottabase/brand-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { readInjectedBrandConfig } from '../Providers';

const REALISTIC_CONFIG = {
    appId: 'otta-web',
    routeMappings: [
        {
            pathPattern: '/**',
            layoutTemplateId: 'app-shell',
            brandKitId: 'default',
            priority: 0,
            tokenOverridesJson: null,
        },
        {
            pathPattern: '/blog/**',
            layoutTemplateId: 'homepage',
            brandKitId: 'default',
            priority: 10,
            tokenOverridesJson: '{"colors":{"primary":"#ff0000"}}',
        },
    ],
    layoutTemplatesMap: {
        'app-shell': { componentKey: 'app-shell', config: { header: 'topbar' } },
    },
    menuSlots: {},
    brandKitsMap: {
        default: {
            brandName: 'Acme & Sons <Ltd>',
            tagline: "only $' left </script>",
            logos: { primary: '/logo.svg' },
            theme: { colors: { primary: '#111111' } },
            darkTheme: { colors: { primary: '#ffffff' } },
            defaultColorScheme: 'system',
            allowDarkModeToggle: true,
            customCss: '.price::before { content: "$"; }',
            hideOttabaseBranding: false,
        },
    },
    r2PublicUrl: 'https://cdn.example.com',
};

function injectTag(config: unknown) {
    // Insert the worker-built tag the way a browser would end up with it:
    // parsed into the head as a real element.
    document.head.insertAdjacentHTML('beforeend', buildInitialConfigScriptTag(config));
}

afterEach(() => {
    document.getElementById(INITIAL_CONFIG_ELEMENT_ID)?.remove();
});

describe('brand hydration handoff (worker tag → client reader)', () => {
    it('round-trips a realistic config, including hostile free-text values, unchanged', () => {
        injectTag(REALISTIC_CONFIG);
        expect(readInjectedBrandConfig()).toEqual(REALISTIC_CONFIG);
    });

    it('survives </script> sequences in values without truncating the tag', () => {
        injectTag(REALISTIC_CONFIG);
        // Exactly one script tag must exist — a breakout would orphan trailing content.
        expect(document.querySelectorAll(`#${INITIAL_CONFIG_ELEMENT_ID}`)).toHaveLength(1);
        expect(readInjectedBrandConfig()?.brandKitsMap.default.tagline).toBe("only $' left </script>");
    });

    it('returns undefined when the tag is absent (dev mode / worker skipped injection)', () => {
        expect(readInjectedBrandConfig()).toBeUndefined();
    });

    it('returns undefined for malformed JSON instead of throwing', () => {
        const el = document.createElement('script');
        el.type = 'application/json';
        el.id = INITIAL_CONFIG_ELEMENT_ID;
        el.textContent = '{"truncated":';
        document.head.appendChild(el);
        expect(readInjectedBrandConfig()).toBeUndefined();
    });
});
