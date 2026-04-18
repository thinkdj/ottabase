import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Spotlight, useSpotlight, type SpotlightResult } from '@ottabase/spotlight';
import { IconBolt, IconCommand, IconSearch, IconSparkles } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

const DEMO_COMMANDS: SpotlightResult[] = [
    { id: 'goto-docs', label: 'Open docs', description: 'Navigate to docs section', keywords: ['docs', 'help'] },
    { id: 'goto-blog', label: 'Open blog', description: 'Navigate to public blog', keywords: ['blog', 'posts'] },
    {
        id: 'toggle-theme',
        label: 'Toggle theme',
        description: 'Switch between light and dark mode',
        keywords: ['theme', 'dark', 'light'],
    },
    {
        id: 'open-admin',
        label: 'Open admin',
        description: 'Jump to admin dashboard',
        keywords: ['admin', 'dashboard'],
    },
];

export function SpotlightDemoPage() {
    const globalSpotlight = useSpotlight();
    const [openLocal, setOpenLocal] = useState(false);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string>('Nothing selected yet');

    const sampleResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return DEMO_COMMANDS;
        return DEMO_COMMANDS.filter(
            (item) =>
                item.label.toLowerCase().includes(q) ||
                item.description?.toLowerCase().includes(q) ||
                item.keywords?.some((k) => k.toLowerCase().includes(q)),
        );
    }, [query]);

    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Spotlight Demo</h1>
                <p className="text-muted-foreground">
                    Keyboard-first command palette demo for <code>@ottabase/spotlight</code>, fully usable while logged
                    out.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IconSearch className="h-5 w-5" />
                            Local Spotlight
                        </CardTitle>
                        <CardDescription>
                            Self-contained palette with custom search handler and result selection.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex gap-2">
                            <Button onClick={() => setOpenLocal(true)}>
                                <IconSparkles className="mr-2 h-4 w-4" />
                                Open local palette
                            </Button>
                            <Button variant="outline" onClick={() => setQuery('')}>
                                Clear query
                            </Button>
                        </div>
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Type to filter local command examples..."
                        />
                        <p className="text-sm text-muted-foreground">Selected command: {selected}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <IconCommand className="h-5 w-5" />
                            App Spotlight Provider
                        </CardTitle>
                        <CardDescription>
                            The app already mounts <code>SpotlightProvider</code>. Default shortcut is <code>/</code> on
                            non-input areas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button variant="outline" onClick={() => globalSpotlight.toggle()}>
                            <IconBolt className="mr-2 h-4 w-4" />
                            Toggle global spotlight
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            Try pressing <code>/</code> anywhere on this page (outside input fields).
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Spotlight
                open={openLocal}
                onOpenChange={setOpenLocal}
                placeholder="Search demo commands..."
                defaultResults={sampleResults}
                onSearch={(q) => {
                    setQuery(q);
                    return sampleResults;
                }}
                onResultSelect={(result) => {
                    setSelected(result.label);
                }}
            />
        </div>
    );
}
