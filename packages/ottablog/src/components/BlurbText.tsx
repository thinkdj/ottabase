import { sanitizeUrl } from '@ottabase/utils/sanitize';
import React from 'react';

export interface BlurbTextProps {
    text: string;
    className?: string;
}

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const TRAILING_PUNCTUATION = /[),.!?;:]+$/;

/**
 * Whether BlurbText may emit anchors. Timeline cards are made clickable by their CALLER — the
 * app wraps them in a router `<Link>`, and BlogExcerptCard in `LinkComponent` — so an auto-linked
 * URL inside one would be an `<a>` nested in an `<a>`: invalid DOM for assistive tech, and a click
 * that both opens the URL and navigates the card. `BlurbRenderer`/`PhotoJournalRenderer` publish
 * their variant here so the text degrades to plain, and no theme (present or future) has to
 * remember to opt out.
 */
export const BlurbTextLinksAllowed = React.createContext(true);

/** Render escaped plain text with safe, clickable HTTP(S) URLs. */
export function BlurbText({ text, className = '' }: BlurbTextProps) {
    const linksAllowed = React.useContext(BlurbTextLinksAllowed);
    const paragraphClassName = `whitespace-pre-wrap break-words ${className}`.trim();

    if (!linksAllowed) return <p className={paragraphClassName}>{text}</p>;

    const parts = text.split(URL_PATTERN);
    return (
        <p className={paragraphClassName}>
            {parts.map((part, index) => {
                if (!/^https?:\/\//.test(part)) return <React.Fragment key={index}>{part}</React.Fragment>;

                const punctuation = part.match(TRAILING_PUNCTUATION)?.[0] ?? '';
                const rawUrl = punctuation ? part.slice(0, -punctuation.length) : part;
                const href = sanitizeUrl(rawUrl);
                if (href === '#') return <React.Fragment key={index}>{part}</React.Fragment>;

                return (
                    <React.Fragment key={index}>
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                        >
                            {rawUrl}
                        </a>
                        {punctuation}
                    </React.Fragment>
                );
            })}
        </p>
    );
}
