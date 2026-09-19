/**
 * ShareButton — single share icon that opens a dropdown with sharing options.
 *
 * Renders: Copy link, X/Twitter, Facebook, LinkedIn, Email.
 * When the browser supports Web Share API, a native "Share…" option appears first.
 */
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import { Check, Copy, ExternalLink, Mail, Share2 } from 'lucide-react';
import { useCallback, useState } from 'react';

export interface ShareButtonProps {
    /** Full URL to share */
    url: string;
    /** Post title */
    title: string;
    /** Optional description for email/native share */
    description?: string;
}

const SOCIAL_LINKS = [
    {
        label: 'X / Twitter',
        href: (url: string, title: string) =>
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
        label: 'Facebook',
        href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
        label: 'LinkedIn',
        href: (url: string, title: string) =>
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    },
] as const;

export function ShareButton({ url, title, description }: ShareButtonProps) {
    const [copied, setCopied] = useState(false);
    const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

    const handleCopy = useCallback(() => {
        try {
            navigator.clipboard.writeText(url).then(
                () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                },
                () => {
                    /* clipboard denied — silent, button stays unchanged */
                },
            );
        } catch {
            /* clipboard API unavailable (HTTP, older browser) */
        }
    }, [url]);

    const handleNativeShare = useCallback(() => {
        navigator.share({ url, title, text: description || title }).catch(() => {
            // User cancelled — not an error
        });
    }, [url, title, description]);

    const handleEmail = useCallback(() => {
        const subject = encodeURIComponent(title);
        const body = encodeURIComponent(`${description || title}\n\n${url}`);
        window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    }, [url, title, description]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0 text-muted-foreground"
                    aria-label="Share this post"
                >
                    <Share2 className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {supportsNativeShare && (
                    <>
                        <DropdownMenuItem onClick={handleNativeShare}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Share…
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}

                <DropdownMenuItem onClick={handleCopy}>
                    {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy link'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {SOCIAL_LINKS.map(({ label, href }) => (
                    <DropdownMenuItem key={label} asChild>
                        <a href={href(url, title)} target="_blank" rel="noopener noreferrer">
                            {label}
                        </a>
                    </DropdownMenuItem>
                ))}

                <DropdownMenuItem onClick={handleEmail}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
