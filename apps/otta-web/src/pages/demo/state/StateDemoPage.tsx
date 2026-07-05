/**
 * State Demo Page
 * Demonstrates @ottabase/state global state management
 */
import { useTheme as useBrandTheme } from '@/ottabase/providers/ThemeContext';
import {
    appStateAtom,
    isAuthenticatedAtom,
    isLoadingAtom,
    scaleAtom,
    sidebarStateAtom,
    themeAtom,
    themeInfoAtom,
    userAtom,
    zoomAtom,
    type AppUser,
} from '@/ottabase/state/appState';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { useAtom, useAtomValue } from 'jotai';
import { useTheme as useNextTheme } from 'next-themes';
import { DemoPageHeader } from '../DemoPageHeader';

export function StateDemoPage() {
    // Full state
    const appState = useAtomValue(appStateAtom);

    // Individual atoms
    const theme = useAtomValue(themeAtom);
    const themeInfo = useAtomValue(themeInfoAtom);
    const [user, setUser] = useAtom(userAtom);
    const [isAuthenticated, setIsAuthenticated] = useAtom(isAuthenticatedAtom);
    const [sidebarState, setSidebarState] = useAtom(sidebarStateAtom);
    const [scale, setScale] = useAtom(scaleAtom);
    const zoom = useAtomValue(zoomAtom);
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom);

    // next-themes is the source of truth for light/dark mode
    const { setTheme: setMode } = useNextTheme();
    const toggleTheme = () => setMode(theme === 'light' ? 'dark' : 'light');

    // BrandEngine theme (admin-configured; users cannot switch)
    const { theme: brandThemeName } = useBrandTheme();

    const simulateLogin = () => {
        const mockUser: AppUser = {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
            image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
            role: 'admin',
        };
        setUser(mockUser);
        setIsAuthenticated(true);
    };

    const simulateLogout = () => {
        setUser(null);
        setIsAuthenticated(false);
    };

    const simulateLoading = () => {
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Global State Management"
                description="Simple global state management for Ottabase apps using Jotai. All state changes are reactive and persist across components."
            />

            {/* Current State Display */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">📊 Current Global State</CardTitle>
                    <CardDescription>Full appStateAtom value displayed as JSON</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-sm ring-1 ring-border">
                        {JSON.stringify(appState, null, 2)}
                    </pre>
                </CardContent>
            </Card>

            {/* Theme Control */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">🎨 Theme</CardTitle>
                    <CardDescription>
                        Uses: <code className="rounded bg-background px-1 ring-1 ring-border">themeAtom</code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                            Current: <Badge variant="outline">{theme}</Badge>
                        </span>
                        <Button onClick={toggleTheme}>Toggle Theme</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Theme Info */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">🎭 Theme Info</CardTitle>
                    <CardDescription>
                        Uses: <code className="rounded bg-background px-1 ring-1 ring-border">themeInfoAtom</code>{' '}
                        (theme name), <code className="rounded bg-background px-1 ring-1 ring-border">themeAtom</code>{' '}
                        (mode). Theme name is managed by BrandEngine, mode by next-themes. Both sync to Jotai atoms.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                                Theme: <Badge variant="outline">{themeInfo.name}</Badge>
                                <span className="ml-2 text-xs">(admin-configured in Brand Engine)</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                                Mode: <Badge variant="outline">{theme}</Badge>
                            </span>
                            <span className="text-sm text-muted-foreground">(synced via useThemeManager)</span>
                        </div>
                        <div className="rounded-lg bg-background p-4 text-sm font-mono ring-1 ring-border">
                            {JSON.stringify({ name: themeInfo.name, mode: theme }, null, 2)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User Control */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">👤 User & Authentication</CardTitle>
                    <CardDescription>
                        Uses: <code className="rounded bg-background px-1 ring-1 ring-border">userAtom</code>,{' '}
                        <code className="rounded bg-background px-1 ring-1 ring-border">isAuthenticatedAtom</code>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                            Authenticated:{' '}
                            <Badge variant={isAuthenticated ? 'default' : 'secondary'}>
                                {isAuthenticated ? 'Yes' : 'No'}
                            </Badge>
                        </span>
                        {isAuthenticated ? (
                            <Button variant="destructive" onClick={simulateLogout}>
                                Logout
                            </Button>
                        ) : (
                            <Button onClick={simulateLogin}>Simulate Login</Button>
                        )}
                    </div>
                    {user && (
                        <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                            <div className="flex items-center gap-4">
                                {user.image && (
                                    <img src={user.image} alt={user.name || ''} className="w-12 h-12 rounded-full" />
                                )}
                                <div>
                                    <p className="font-medium">{user.name}</p>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                    <p className="text-xs text-muted-foreground">Role: {user.role}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Sidebar Control */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">📱 Sidebar State</CardTitle>
                    <CardDescription>
                        Uses: <code className="rounded bg-background px-1 ring-1 ring-border">sidebarStateAtom</code> -
                        Persisted to localStorage
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sidebarState.isOpen}
                                onChange={(e) => setSidebarState({ ...sidebarState, isOpen: e.target.checked })}
                                className="w-4 h-4 rounded"
                            />
                            <span>Sidebar Open</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sidebarState.isCollapsed}
                                onChange={(e) =>
                                    setSidebarState({
                                        ...sidebarState,
                                        isCollapsed: e.target.checked,
                                    })
                                }
                                className="w-4 h-4 rounded"
                            />
                            <span>Sidebar Collapsed</span>
                        </label>
                    </div>

                    <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                                Width: <Badge variant="outline">{sidebarState.width}px</Badge>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="50"
                                max="350"
                                step="10"
                                value={sidebarState.width}
                                onChange={(e) =>
                                    setSidebarState({
                                        ...sidebarState,
                                        width: parseInt(e.target.value),
                                    })
                                }
                                className="w-full max-w-xs"
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSidebarState({ ...sidebarState, width: 60 })}
                                >
                                    Collapsed
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSidebarState({ ...sidebarState, width: 250 })}
                                >
                                    Default
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSidebarState({ ...sidebarState, width: 300 })}
                                >
                                    Wide
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 rounded-lg bg-background p-4 text-sm ring-1 ring-border">
                        <p className="font-semibold text-foreground">Persistence Info</p>
                        <p className="text-muted-foreground">
                            ✅ Sidebar state is persisted to localStorage under key:{' '}
                            <code className="rounded bg-muted/60 px-1 ring-1 ring-border">ottabase.sidebar.state</code>
                        </p>
                        <p className="text-muted-foreground">
                            Single atom with all properties: isOpen, isCollapsed, width. Try changing values and
                            refreshing the page!
                        </p>
                        <pre className="mt-2 overflow-x-auto rounded bg-muted/60 p-2 text-xs ring-1 ring-border">
                            {JSON.stringify(sidebarState, null, 2)}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            {/* Scale Control */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">🔍 UI Scale</CardTitle>
                    <CardDescription>
                        Uses: <code className="rounded bg-background px-1 ring-1 ring-border">scaleAtom</code> - Sets{' '}
                        <code className="rounded bg-background px-1 ring-1 ring-border">
                            document.documentElement.style.fontSize
                        </code>{' '}
                        so all rem-based sizing scales proportionally. Persisted to localStorage.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                                Scale: <Badge variant="outline">{scale}x</Badge>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                className="w-full max-w-xs"
                            />
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setScale(0.75)}>
                                    75%
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setScale(1.0)}>
                                    100%
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setScale(1.25)}>
                                    125%
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setScale(1.5)}>
                                    150%
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Browser Zoom */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">🖥️ Browser Zoom</CardTitle>
                    <CardDescription>
                        Uses: <code className="rounded bg-background px-1 ring-1 ring-border">zoomAtom</code> - Browser
                        zoom level (detected from window.devicePixelRatio)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                                Zoom: <Badge variant="outline">{(zoom * 100).toFixed(0)}%</Badge>
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Try using your browser's zoom controls (Ctrl+, Ctrl-, or Cmd+, Cmd-) to change the zoom
                            level. The value will update automatically.
                        </p>
                        <div className="rounded-lg bg-background p-4 text-sm font-mono ring-1 ring-border">
                            {JSON.stringify({ zoom, devicePixelRatio: window.devicePixelRatio }, null, 2)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Loading State */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">⏳ Loading State</CardTitle>
                    <CardDescription>
                        Uses: <code className="rounded bg-background px-1 ring-1 ring-border">isLoadingAtom</code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                            Is Loading:{' '}
                            <Badge variant={isLoading ? 'default' : 'secondary'}>{isLoading ? 'Yes' : 'No'}</Badge>
                        </span>
                        <Button onClick={simulateLoading} disabled={isLoading}>
                            {isLoading ? 'Loading...' : 'Simulate Loading (2s)'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Usage Example */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">📖 Usage</CardTitle>
                    <CardDescription>How to use @ottabase/state in your app</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-sm ring-1 ring-border">
                        {`// 1. Create state in src/ottabase/state/appState.ts
import { createAppState } from "@ottabase/state";

const { appStateAtom, atoms } = createAppState({
  appName: "My App",
});

export const { themeAtom, themeInfoAtom, userAtom, sidebarStateAtom } = atoms;

// 2. Use in components
import { useAtom, useAtomValue } from "jotai";
import { themeAtom, themeInfoAtom, userAtom, sidebarStateAtom } from "@/ottabase/state/appState";

function MyComponent() {
  const theme = useAtomValue(themeAtom);
  const themeInfo = useAtomValue(themeInfoAtom);
  const [sidebarState, setSidebarState] = useAtom(sidebarStateAtom);

  return (
    <div>
      Theme: {theme}
      ThemeName: {themeInfo.name}
      SidebarWidth: {sidebarState.width}px
    </div>
  );
}`}
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}
