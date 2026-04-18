import { RenderFn } from 'editorjs-blocks-react-renderer';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types (mirror DisclosureTool)
// ---------------------------------------------------------------------------

export type AIDisclosureLevel = 'none' | 'slight' | 'mid' | 'high' | 'custom';

export interface DisclosureData {
    aiEnabled?: boolean;
    aiLevel?: AIDisclosureLevel;
    aiPercent?: number;
    sponsoredEnabled?: boolean;
    sponsoredType?: 'preset' | 'custom';
    sponsoredText?: string;
}

// ---------------------------------------------------------------------------
// Standard wording (kept in sync with DisclosureTool)
// ---------------------------------------------------------------------------

const AI_LEVEL_WORDING: Record<Exclude<AIDisclosureLevel, 'none' | 'custom'>, string> = {
    slight: 'AI tools were used to assist in light editing and proofreading of this content.',
    mid: 'AI tools were significantly used in drafting and editing this content.',
    high: 'This content was primarily generated with AI assistance and reviewed by a human editor.',
};

const SPONSORED_PRESET_TEXT =
    'This content was created in partnership with a sponsor. Our editorial standards remain independent.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAIText(data: DisclosureData): string {
    if (!data.aiEnabled || !data.aiLevel || data.aiLevel === 'none') return '';
    if (data.aiLevel === 'custom') {
        const rawPercent = data.aiPercent ?? 50;
        const pct = Math.min(100, Math.max(1, Math.round(rawPercent)));
        return `Approximately ${pct}% of this content was created with AI assistance.`;
    }
    return AI_LEVEL_WORDING[data.aiLevel as keyof typeof AI_LEVEL_WORDING] || '';
}

function getSponsoredText(data: DisclosureData): string {
    if (!data.sponsoredEnabled) return '';
    if (data.sponsoredType === 'custom') return data.sponsoredText?.trim() || '';
    return SPONSORED_PRESET_TEXT;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Robot/AI icon (Tabler-style) */
const AIIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
);

/** Tag/sponsored icon (Tabler-style) */
const SponsoredIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M11.5 21l-8.5-8.5 7.5-7.5H20v9.5l-8.5 6.5z" />
        <circle cx="17" cy="7" r="1" />
    </svg>
);

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

const Disclosure: RenderFn<DisclosureData> = ({ data, className = '' }) => {
    const aiText = useMemo(() => getAIText(data || {}), [data]);
    const sponsoredText = useMemo(() => getSponsoredText(data || {}), [data]);

    if (!aiText && !sponsoredText) return null;

    const hasAI = Boolean(aiText);
    const hasSponsored = Boolean(sponsoredText);
    return (
        <aside
            className={`${className} not-prose my-4 rounded-lg border border-border bg-muted/40 overflow-hidden cdc-content-disclosure`}
            aria-label="Content disclosure"
        >
            {/* Header bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/60 border-b border-border">
                {/* Shield icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                    aria-hidden="true"
                >
                    <path d="M12 3l8 4v4c0 5-3.5 9.74-8 11-4.5-1.26-8-6-8-11V7l8-4z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none">
                    {hasAI && hasSponsored ? 'Disclosures' : hasAI ? 'AI Disclosure' : 'Sponsored Disclosure'}
                </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-border">
                {hasAI && (
                    <div className="flex items-start gap-3 px-4 py-3" role="note" aria-label="AI usage disclosure">
                        <span className="mt-0.5 flex-shrink-0 text-primary">
                            <AIIcon />
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-xs font-semibold text-foreground">AI Content Notice</span>
                            <p className="text-xs text-muted-foreground leading-relaxed m-0">{aiText}</p>
                        </div>
                    </div>
                )}

                {hasSponsored && (
                    <div
                        className="flex items-start gap-3 px-4 py-3"
                        role="note"
                        aria-label="Sponsored content disclosure"
                    >
                        <span className="mt-0.5 flex-shrink-0 text-warning">
                            <SponsoredIcon />
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-xs font-semibold text-foreground">Sponsored Content</span>
                            <p className="text-xs text-muted-foreground leading-relaxed m-0">{sponsoredText}</p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Disclosure;
