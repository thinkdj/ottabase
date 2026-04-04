import { siteConfig } from '@/config';

export function philosophyTheme() {
    const s = siteConfig.theme === 'signalHorizon';
    return {
        wrap: s ? 'ob-hp-container' : 'container',
        article: s ? 'ob-hp-prose' : 'prose-section',
        block: s ? 'ob-hp-reveal' : 'animate',
        quote: s ? 'ob-hp-prose-blockquote ob-hp-reveal' : 'prose-blockquote animate',
        divider: s ? 'ob-hp-prose-divider' : 'prose-divider',
        codeWrap: s ? 'ob-hp-window ob-hp-reveal' : 'code-window animate',
        codeBar: s ? 'ob-hp-window-bar' : 'code-window-bar',
        codeDot: s ? 'ob-hp-window-dot' : 'code-window-dot',
        codeTitle: s ? 'ob-hp-window-name' : 'code-window-filename',
        codePre: s ? 'ob-hp-code-block' : 'code-block',
        btnP: s ? 'ob-hp-btn ob-hp-btn--primary ob-hp-btn--lg' : 'btn btn-primary btn-lg',
        btnG: s ? 'ob-hp-btn ob-hp-btn--ghost ob-hp-btn--lg' : 'btn btn-ghost btn-lg',
        muted: s ? 'var(--ob-muted)' : 'var(--text-muted)',
    };
}
