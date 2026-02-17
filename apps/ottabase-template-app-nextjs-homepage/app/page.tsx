import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Button } from '@ottabase/ui-shadcn';
import Link from 'next/link';

export default function HomePage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex max-w-3xl flex-col items-center gap-8 px-4 text-center">
                {/* Dark Mode Toggle in corner */}
                <div className="absolute right-5 top-5">
                    <DarkModeToggle type="button" title="Toggle dark/light mode" />
                </div>

                {/* Main Heading */}
                <h1
                    className="mb-4 mt-32 bg-gradient-to-r from-cyan-500 to-fuchsia-500 bg-clip-text text-6xl font-bold text-transparent"
                    style={{
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    Ottabase Next.js Homepage Template
                </h1>

                {/* Description */}
                <p className="mb-8 text-xl leading-relaxed text-muted-foreground">
                    A barebone Next.js homepage template with OpenNext and Cloudflare Workers deployment
                </p>

                <p className="text-lg leading-relaxed text-muted-foreground">
                    Built with <strong>Next.js 16</strong>, <strong>TypeScript</strong>, <strong>Tailwind CSS</strong>,
                    and <strong>Brand Engine</strong>. Perfect for creating beautiful, dynamic homepages deployed to
                    Cloudflare Workers.
                </p>

                {/* Action Buttons */}
                <div className="mt-8 flex flex-wrap gap-4 justify-center">
                    <Button asChild size="lg">
                        <Link href="/about">About</Link>
                    </Button>

                    <Button asChild size="lg" variant="secondary">
                        <Link href="/theme-demo">🎨 Theme Demo</Link>
                    </Button>

                    <Button asChild variant="outline" size="lg">
                        <a href="https://github.com/thinkdj/ottabase" target="_blank" rel="noopener noreferrer">
                            View on GitHub
                        </a>
                    </Button>
                </div>

                {/* Features Grid */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                    <div className="p-6 rounded-lg border border-border bg-card">
                        <h3 className="text-lg font-semibold mb-2">🚀 Dynamic Workers</h3>
                        <p className="text-sm text-muted-foreground">
                            Deploy to Cloudflare Workers with OpenNext for edge-optimized performance
                        </p>
                    </div>
                    <div className="p-6 rounded-lg border border-border bg-card">
                        <h3 className="text-lg font-semibold mb-2">🎨 Brand Engine</h3>
                        <p className="text-sm text-muted-foreground">
                            Built-in theme system with 8+ presets and full customization support
                        </p>
                    </div>
                    <div className="p-6 rounded-lg border border-border bg-card">
                        <h3 className="text-lg font-semibold mb-2">⚡ Next.js 16</h3>
                        <p className="text-sm text-muted-foreground">
                            Latest Next.js with App Router and React Server Components
                        </p>
                    </div>
                    <div className="p-6 rounded-lg border border-border bg-card">
                        <h3 className="text-lg font-semibold mb-2">🎯 Type Safe</h3>
                        <p className="text-sm text-muted-foreground">
                            Full TypeScript support for better developer experience
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-16 text-sm text-muted-foreground">
                    © {new Date().getFullYear()} Ottabase. Open Source.
                </p>
            </div>
        </div>
    );
}
