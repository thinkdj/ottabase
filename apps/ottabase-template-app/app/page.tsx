import { APP_META } from '@/ottabase/config/app.config';
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
                    className="mb-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 bg-clip-text text-6xl font-bold text-transparent"
                    style={{
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    {APP_META.appName}
                </h1>

                {/* Description */}
                <p className="mb-8 text-xl leading-relaxed text-muted-foreground">{APP_META.description}</p>

                <p className="text-lg leading-relaxed text-muted-foreground">
                    A modern React app template built with <strong>Next.js</strong>, <strong>TypeScript</strong>, and{' '}
                    <strong>Tailwind CSS</strong>. Features theme switching, state management, and a scalable monorepo
                    architecture with UI Base as the foundation.
                </p>

                {/* Action Buttons */}
                <div className="mt-8 flex flex-wrap gap-2 justify-center">
                    <Button asChild variant="outline" size="lg">
                        <a href="/demo">Demo Page</a>
                    </Button>
                    <Button asChild size="lg" className="bg-gradient-to-r from-cyan-500 to-cyan-600">
                        <Link href="/demo/mantine">Mantine Demo</Link>
                    </Button>

                    <Button asChild variant="outline" size="lg">
                        <Link href="/demo/shadcn">shadcn/ui Demo</Link>
                    </Button>

                    <Button asChild variant="outline" size="lg">
                        <a href="https://github.com/thinkdj/" target="_blank" rel="noopener noreferrer">
                            Homepage
                        </a>
                    </Button>
                </div>

                {/* Footer */}
                <p className="mt-16 text-sm text-muted-foreground">{APP_META.copyrightText}</p>

                <p className="mt-2 text-xs text-muted-foreground">
                    To create a new app from this template, simply delete the{' '}
                    <code className="rounded bg-muted px-1 py-0.5">/demo</code> directory and customize this landing
                    page to match your project needs.
                </p>
            </div>
        </div>
    );
}
