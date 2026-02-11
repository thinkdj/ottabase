import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { useTheme } from '@/ottabase/providers/ThemeContext';
import { useTheme as useNextTheme } from 'next-themes';

export function ThemingDemoPage() {
    const { theme, config } = useTheme();
    const { setTheme: setMode, theme: mode, resolvedTheme } = useNextTheme();
    const activeMode = resolvedTheme || mode || 'light';

    return (
        <div className="space-y-theme-section animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Theming Configurator</h1>
                <p className="text-muted-foreground">
                    Theme is set by admin in Brand Engine. You can switch light/dark mode only.
                </p>
            </div>

            <div className="grid gap-theme-card md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Active theme</CardTitle>
                        <CardDescription>App-level preset (admin-configured).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="font-mono text-sm capitalize">{theme || 'default'}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Mode</CardTitle>
                        <CardDescription>Light or Dark mode.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        <Button
                            variant={mode === 'light' ? 'default' : 'outline'}
                            onClick={() => setMode('light')}
                            className="w-full justify-start"
                        >
                            Light Mode
                        </Button>
                        <Button
                            variant={mode === 'dark' ? 'default' : 'outline'}
                            onClick={() => setMode('dark')}
                            className="w-full justify-start"
                        >
                            Dark Mode
                        </Button>
                    </CardContent>
                </Card>

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Typography Check</CardTitle>
                        <CardDescription>View current theme typography and spacing configuration.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-16">Heading:</span>
                                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                    {config?.typography?.heading?.fontFamily ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-16">Body:</span>
                                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                    {config?.typography?.body?.fontFamily ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-16">Cursive:</span>
                                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                    {config?.typography?.handwriting?.fontFamily ?? '—'}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 pt-4 border-t">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-16">Radius:</span>
                                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                    {config?.radius ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-16">Spacing:</span>
                                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                    {config?.spacing?.section || 'N/A'} (Sec) / {config?.spacing?.card || 'N/A'} (Card)
                                </span>
                            </div>
                        </div>
                    </CardContent>
                    <CardContent className="space-y-4">
                        <div>
                            <h1 className="font-heading text-4xl font-extrabold lg:text-5xl">Heading 1</h1>
                            <h2 className="font-heading text-3xl font-semibold first:mt-0">Heading 2</h2>
                            <h3 className="font-heading text-2xl font-semibold">Heading 3</h3>
                            <p className="leading-7 [&:not(:first-child)]:mt-6">
                                The quick brown fox jumps over the lazy dog. This paragraph demonstrates the body font
                                readability and line height settings derived from the base design system.
                            </p>
                            <div className="mt-8 p-6 bg-muted/50 rounded-lg text-center">
                                <p className="font-handwriting text-3xl text-primary">
                                    "Design is intelligence made visible."
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">- Handwriting Font Demo</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="components" className="w-full">
                <TabsList>
                    <TabsTrigger value="components">Components</TabsTrigger>
                    <TabsTrigger value="colors">Color Palette</TabsTrigger>
                </TabsList>
                <TabsContent value="components" className="space-y-theme-element py-4">
                    <div className="grid gap-theme-card md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Form Elements</CardTitle>
                                <CardDescription>Inputs, buttons, and form controls.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid w-full max-w-sm items-center gap-1.5">
                                    <Label htmlFor="email">Email</Label>
                                    <Input type="email" id="email" placeholder="Email" />
                                </div>
                                <div className="flex gap-2">
                                    <Button>Primary</Button>
                                    <Button variant="secondary">Secondary</Button>
                                    <Button variant="destructive">Destructive</Button>
                                    <Button variant="outline">Outline</Button>
                                    <Button variant="ghost">Ghost</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Interactive</CardTitle>
                                <CardDescription>Hover states and focus rings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <div className="h-10 w-10 rounded-full bg-primary animate-pulse" />
                                    <div className="space-y-1">
                                        <div className="h-4 w-[200px] rounded bg-muted animate-pulse" />
                                        <div className="h-3 w-[150px] rounded bg-muted animate-pulse" />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full">Action</Button>
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="colors" className="py-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Color Tokens</CardTitle>
                            <CardDescription>Current theme color variables.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries((config?.colors ?? {})[activeMode as 'light' | 'dark'] ?? {}).map(
                                    ([key, value]) => (
                                        <div key={key} className="space-y-1.5">
                                            <div
                                                className="h-12 w-full rounded border ring-offset-background transition-shadow hover:ring-2 hover:ring-ring hover:ring-offset-2"
                                                style={{ backgroundColor: `hsl(${value})` }}
                                            />
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-medium leading-none">{key}</p>
                                                <p className="text-xs text-muted-foreground">{value as string}</p>
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
