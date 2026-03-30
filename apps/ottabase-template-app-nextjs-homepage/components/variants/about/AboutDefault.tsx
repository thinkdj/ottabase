'use client';

import { Button } from '@ottabase/ui-shadcn';
import { ExternalLink, Github, Rocket } from 'lucide-react';
import Link from 'next/link';
import type { AboutData } from './types';
import { DEFAULT_GITHUB_URL } from './types';

/**
 * Default about page — full-length content with features list, getting-started steps,
 * brand customisation section, deployment info, and CTA buttons.
 */
export function AboutDefault({ title, description, githubUrl = DEFAULT_GITHUB_URL }: AboutData) {
    return (
        <div className="mx-auto max-w-4xl px-4 py-16">
            <div className="space-y-8">
                <div>
                    <h1 className="font-heading text-4xl font-bold text-foreground pb-2.5">
                        {title ?? (
                            <>
                                <span className="text-primary">About</span> this template
                            </>
                        )}
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        {description ?? 'A modern, production-ready Next.js homepage template for Cloudflare Workers.'}
                    </p>
                </div>

                <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <h2 className="text-2xl font-semibold mb-4">What is this?</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        This is a barebone Next.js homepage template designed to be easily deployed to Cloudflare
                        Workers using OpenNext. It provides a solid foundation for building beautiful, performant
                        homepages with modern web technologies.
                    </p>

                    <h2 className="text-2xl font-semibold mb-4 mt-8">Key Features</h2>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        <li>Next.js 16 with App Router and React Server Components</li>
                        <li>OpenNext for seamless Cloudflare Workers deployment</li>
                        <li>Brand Engine integration with 8 theme presets</li>
                        <li>TypeScript for type safety</li>
                        <li>Tailwind CSS for rapid styling</li>
                        <li>Dark mode support out of the box</li>
                        <li>Fully responsive design</li>
                        <li>Production-ready configuration</li>
                    </ul>

                    <h2 className="text-2xl font-semibold mb-4 mt-8">Getting Started</h2>
                    <p className="text-muted-foreground leading-relaxed">To get started with this template:</p>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground mt-4">
                        <li>Clone the repository</li>
                        <li>
                            Install dependencies with{' '}
                            <code className="bg-muted text-foreground px-2 py-0.5 rounded text-sm font-mono">
                                pnpm install
                            </code>
                        </li>
                        <li>
                            Run the dev server with{' '}
                            <code className="bg-muted text-foreground px-2 py-0.5 rounded text-sm font-mono">
                                pnpm dev
                            </code>
                        </li>
                        <li>Customize the homepage and brand configuration</li>
                        <li>Build and deploy to Cloudflare Workers</li>
                    </ol>

                    <h2 className="text-2xl font-semibold mb-4 mt-8">Brand Customization</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        The template includes Brand Engine integration, allowing you to easily customize colors,
                        typography, and theming. Edit{' '}
                        <code className="bg-muted text-foreground px-2 py-0.5 rounded text-sm font-mono">
                            config/brand.config.ts
                        </code>{' '}
                        to configure your brand settings. Choose from 8 built-in theme presets or create your own custom
                        theme.
                    </p>

                    <h2 className="text-2xl font-semibold mb-4 mt-8">Deployment</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Deploy to Cloudflare Workers with a single command:
                    </p>
                    <pre className="bg-muted text-foreground p-4 rounded-lg mt-4 overflow-x-auto border border-border">
                        <code className="text-sm font-mono">pnpm deploy</code>
                    </pre>
                    <p className="text-muted-foreground leading-relaxed mt-4">
                        Make sure you have configured your Cloudflare credentials before deploying.
                    </p>
                </div>

                <div className="mt-12 flex flex-wrap gap-4">
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
                            Get Started
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
