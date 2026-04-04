import { siteConfig } from '@/config';

export function philosophyTheme() {
    const s = siteConfig.theme === 'signalHorizon';
    return {
        wrap: s ? 'hp-container' : 'container',
        article: s ? 'hp-prose' : 'prose-section',
        block: s ? 'hp-reveal' : 'animate',
        quote: s ? 'hp-prose-blockquote hp-reveal' : 'prose-blockquote animate',
        divider: s ? 'hp-prose-divider' : 'prose-divider',
        codeWrap: s ? 'hp-window hp-reveal' : 'code-window animate',
        codeBar: s ? 'hp-window-bar' : 'code-window-bar',
        codeDot: s ? 'hp-window-dot' : 'code-window-dot',
        codeTitle: s ? 'hp-window-name' : 'code-window-filename',
        codePre: s ? 'hp-code-block' : 'code-block',
        btnP: s ? 'hp-btn hp-btn--primary hp-btn--lg' : 'btn btn-primary btn-lg',
        btnG: s ? 'hp-btn hp-btn--ghost hp-btn--lg' : 'btn btn-ghost btn-lg',
        muted: s ? 'var(--hp-muted)' : 'var(--text-muted)',
    };
}
