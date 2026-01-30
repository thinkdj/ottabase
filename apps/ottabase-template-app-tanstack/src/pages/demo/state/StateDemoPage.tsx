/**
 * State Demo Page
 * Demonstrates @ottabase/state global state management
 */
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
    type SidebarState,
} from '@/ottabase/state/appState';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useAtom, useAtomValue } from 'jotai';

export function StateDemoPage() {
    // Full state
    const appState = useAtomValue(appStateAtom);

    // Individual atoms
    const [theme, setTheme] = useAtom(themeAtom);
    const themeInfo = useAtomValue(themeInfoAtom);
    const [user, setUser] = useAtom(userAtom);
    const [isAuthenticated, setIsAuthenticated] = useAtom(isAuthenticatedAtom);
    const [sidebarState, setSidebarState] = useAtom(sidebarStateAtom);
    const [scale, setScale] = useAtom(scaleAtom);
    const zoom = useAtomValue(zoomAtom);
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom);

    // Demo actions
    const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

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
        <div className="mx-auto w-full max-w-5xl space-y-8 pb-16">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/state
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight">Global State Management</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Simple global state management for Ottabase apps using Jotai. All state changes are reactive and
                    persist across components.
                </p>
            </div>

            {/* Current State Display */}
            <Card>
                <CardHeader>
                    <CardTitle>📊 Current Global State</CardTitle>
                    <CardDescription>Full appStateAtom value displayed as JSON</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        {JSON.stringify(appState, null, 2)}
                    </pre>
                </CardContent>
            </Card>

            {/* Theme Control */}
            <Card>
                <CardHeader>
                    <CardTitle>🎨 Theme</CardTitle>
                    <CardDescription>
                        Uses: <code className="bg-muted px-1 rounded">themeAtom</code>
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
            <Card>
                <CardHeader>
                    <CardTitle>🎭 Theme Info</CardTitle>
                    <CardDescription>
                        Uses: <code className="bg-muted px-1 rounded">themeInfoAtom</code> (theme name),{' '}
                        <code className="bg-muted px-1 rounded">themeAtom</code> (mode)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                                Theme Name: <Badge variant="outline">{themeInfo.name}</Badge>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                                Mode: <Badge variant="outline">{theme}</Badge>
                            </span>
                            <span className="text-sm text-muted-foreground">(synced from themeAtom)</span>
                        </div>
                        <div className="bg-muted p-4 rounded-lg text-sm font-mono">
                            {JSON.stringify({ name: themeInfo.name, mode: theme }, null, 2)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User Control */}
            <Card>
                <CardHeader>
                    <CardTitle>👤 User & Authentication</CardTitle>
                    <CardDescription>
                        Uses: <code className="bg-muted px-1 rounded">userAtom</code>,{' '}
                        <code className="bg-muted px-1 rounded">isAuthenticatedAtom</code>
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
                        <div className="bg-muted p-4 rounded-lg">
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
            <Card>
                <CardHeader>
                    <CardTitle>📱 Sidebar State</CardTitle>
                    <CardDescription>
                        Uses: <code className="bg-muted px-1 rounded">sidebarStateAtom</code> - Persisted to
                        localStorage
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

                    <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                        <p className="font-semibold text-foreground">Persistence Info</p>
                        <p className="text-muted-foreground">
                            ✅ Sidebar state is persisted to localStorage under key:{' '}
                            <code className="bg-background px-1 rounded">ottabase.sidebar.state</code>
                        </p>
                        <p className="text-muted-foreground">
                            Single atom with all properties: isOpen, isCollapsed, width. Try changing values and
                            refreshing the page!
                        </p>
                        <pre className="bg-background p-2 rounded text-xs overflow-x-auto mt-2">
                            {JSON.stringify(sidebarState, null, 2)}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            {/* Scale Control */}
            <Card>
                <CardHeader>
                    <CardTitle>🔍 UI Scale</CardTitle>
                    <CardDescription>
                        Uses: <code className="bg-muted px-1 rounded">scaleAtom</code> - UI magnification factor
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
            <Card>
                <CardHeader>
                    <CardTitle>🖥️ Browser Zoom</CardTitle>
                    <CardDescription>
                        Uses: <code className="bg-muted px-1 rounded">zoomAtom</code> - Browser zoom level (detected
                        from window.devicePixelRatio)
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
                        <div className="bg-muted p-4 rounded-lg text-sm font-mono">
                            {JSON.stringify({ zoom, devicePixelRatio: window.devicePixelRatio }, null, 2)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Loading State */}
            <Card>
                <CardHeader>
                    <CardTitle>⏳ Loading State</CardTitle>
                    <CardDescription>
                        Uses: <code className="bg-muted px-1 rounded">isLoadingAtom</code>
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
            <Card>
                <CardHeader>
                    <CardTitle>📖 Usage</CardTitle>
                    <CardDescription>How to use @ottabase/state in your app</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
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
