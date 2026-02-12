import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Button } from '@ottabase/ui-shadcn';
import { Github, Home, Rocket } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex max-w-4xl flex-col gap-8 px-4 py-16">
                {/* Dark Mode Toggle */}
                <div className="absolute right-5 top-5">
                    <DarkModeToggle type="button" title="Toggle dark/light mode" />
                </div>

                {/* Back Button */}
                <div className="mb-4">
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/">
                            <Home className="mr-2 h-4 w-4" />
                            Back to Home
                        </Link>
                    </Button>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                    <div>
                        <h1 className="mb-4 text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            About This Template
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            A modern, production-ready Next.js homepage template for Cloudflare Workers
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
                            <li>Brand Engine integration for customizable theming</li>
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
                                <code className="bg-muted px-2 py-1 rounded">pnpm install</code>
                            </li>
                            <li>
                                Run the dev server with <code className="bg-muted px-2 py-1 rounded">pnpm dev</code>
                            </li>
                            <li>Customize the homepage and brand configuration</li>
                            <li>Build and deploy to Cloudflare Workers</li>
                        </ol>

                        <h2 className="text-2xl font-semibold mb-4 mt-8">Brand Customization</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            The template includes Brand Engine integration, allowing you to easily customize colors,
                            typography, and theming. Edit{' '}
                            <code className="bg-muted px-2 py-1 rounded">config/brand.config.ts</code> to configure your
                            brand settings. Choose from 8 built-in theme presets or create your own custom theme.
                        </p>

                        <h2 className="text-2xl font-semibold mb-4 mt-8">Deployment</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Deploy to Cloudflare Workers with a single command:
                        </p>
                        <pre className="bg-muted p-4 rounded mt-4 overflow-x-auto">
                            <code>pnpm deploy</code>
                        </pre>
                        <p className="text-muted-foreground leading-relaxed mt-4">
                            Make sure you have configured your Cloudflare credentials before deploying.
                        </p>
                    </div>

                    {/* CTA Section */}
                    <div className="mt-12 flex flex-wrap gap-4">
                        <Button asChild size="lg">
                            <a href="https://github.com/thinkdj/ottabase" target="_blank" rel="noopener noreferrer">
                                <Github className="mr-2 h-5 w-5" />
                                View on GitHub
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

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-border text-center">
                    <p className="text-sm text-muted-foreground">Built with ❤️ by the Ottabase team</p>
                </div>
            </div>
        </div>
    );
}
