'use client';

import { Button } from '@ottabase/ui-shadcn';
import { ExternalLink, Github, Rocket } from 'lucide-react';
import Link from 'next/link';
import type { AboutData } from './types';
import { DEFAULT_GITHUB_URL } from './types';

/**
 * Detailed about page — card-based layout with feature highlights,
 * tech-stack badges, and a prominent CTA section.
 */
export function AboutDetailed({ title, description, githubUrl = DEFAULT_GITHUB_URL }: AboutData) {
    const features = [
        {
            heading: 'Edge-First',
            body: 'Deployed on Cloudflare Workers via OpenNext — sub-50 ms TTFB worldwide.',
        },
        {
            heading: 'Themeable',
            body: '8 built-in Brand Engine presets with live switching and dark mode support.',
        },
        {
            heading: 'Modern Stack',
            body: 'Next.js 16 App Router, React Server Components, and streaming out of the box.',
        },
        {
            heading: 'Type-Safe',
            body: 'End-to-end TypeScript across client, server, and configuration.',
        },
        {
            heading: 'Responsive',
            body: 'Mobile-first Tailwind CSS layout that looks great on any device.',
        },
        {
            heading: 'Configurable',
            body: 'Slot-based component system — swap hero, features, CTA, navbar, and footer variants at runtime.',
        },
    ];

    const techStack = ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Cloudflare Workers', 'OpenNext'];

    return (
        <div className="mx-auto max-w-5xl px-4 py-16">
            <div className="space-y-12">
                {/* Header */}
                <div className="text-center">
                    <h1 className="font-heading text-4xl font-bold text-foreground">
                        {title ?? (
                            <>
                                <span className="text-primary">About</span> this template
                            </>
                        )}
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        {description ??
                            'A modern, production-ready Next.js homepage template designed for Cloudflare Workers.'}
                    </p>
                </div>

                {/* Feature cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((f) => (
                        <div
                            key={f.heading}
                            className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
                        >
                            <h3 className="font-heading text-lg font-semibold text-card-foreground">{f.heading}</h3>
                            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                        </div>
                    ))}
                </div>

                {/* Tech stack badges */}
                <div className="text-center">
                    <h2 className="font-heading text-2xl font-semibold text-foreground">Tech Stack</h2>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {techStack.map((tech) => (
                            <span
                                key={tech}
                                className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                            >
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild size="lg">
                        <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                            <Github className="mr-2 h-5 w-5" />
                            View on GitHub
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                        </a>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <Link href="/">
                            <Rocket className="mr-2 h-5 w-5" />
                            Back to Home
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
