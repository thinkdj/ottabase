'use client';

import { Button } from '@ottabase/ui-shadcn';
import { ExternalLink, Github } from 'lucide-react';
import type { AboutData } from './types';
import { DEFAULT_GITHUB_URL } from './types';

/**
 * Minimal about page — concise single-section overview with a GitHub CTA.
 */
export function AboutMinimal({ title, description, githubUrl = DEFAULT_GITHUB_URL }: AboutData) {
    return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
            <h1 className="font-heading text-3xl font-bold text-foreground">
                {title ?? (
                    <>
                        <span className="text-primary">About</span> this template
                    </>
                )}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                {description ??
                    'A Next.js homepage template for Cloudflare Workers. Brand Engine themes, dark mode, and edge deployment — all out of the box.'}
            </p>
            <div className="mt-8">
                <Button asChild size="lg">
                    <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                        <Github className="mr-2 h-5 w-5" />
                        View on GitHub
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                    </a>
                </Button>
            </div>
        </div>
    );
}
