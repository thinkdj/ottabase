/**
 * Admin Blog Extensibility Page
 *
 * Manage hooks, themes, and plugins for ottablog (reads/writes from DB via API)
 */
import type { PostContentPluginConfig } from '@ottabase/ottablog';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
} from '@ottabase/ui-shadcn';
import { api } from '@/lib/api';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2, Code, Palette, Plug, Power, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/** Theme record from DB (API response) */
interface DbTheme {
    id: string;
    themeId: string;
    name: string;
    description?: string | null;
    version?: string | null;
    author?: string | null;
    url?: string | null;
    screenshot?: string | null;
    isActive: boolean;
    config?: Record<string, unknown> | null;
}

/** Plugin record from DB (API response) */
interface DbPlugin {
    id: string;
    pluginId: string;
    name: string;
    description?: string | null;
    version?: string | null;
    author?: string | null;
    url?: string | null;
    enabled: boolean;
    config?: Record<string, unknown> | null;
}

export function AdminBlogExtensibilityPage() {
    const [themes, setThemes] = useState<DbTheme[]>([]);
    const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
    const [plugins, setPlugins] = useState<DbPlugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [configuringPlugin, setConfiguringPlugin] = useState<DbPlugin | null>(null);
    const [pluginConfig, setPluginConfig] = useState<Partial<PostContentPluginConfig>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api<{ themes: DbTheme[]; plugins: DbPlugin[]; activeThemeId: string | null }>(
                '/api/blog/extensibility',
            );
            setThemes(data.themes ?? []);
            setPlugins(data.plugins ?? []);
            setActiveThemeId(data.activeThemeId ?? null);
        } catch (error) {
            console.error('Error loading extensibility data:', error);
            toast.error('Failed to load extensibility data');
        } finally {
            setLoading(false);
        }
    };

    const handleThemeActivate = async (themeId: string) => {
        try {
            await api('/api/blog/extensibility/theme/activate', {
                method: 'POST',
                body: { themeId },
            });
            setActiveThemeId(themeId);
            toast.success(`Theme "${themeId}" activated`);
        } catch (error) {
            console.error('Error activating theme:', error);
            toast.error('Failed to activate theme');
        }
    };

    const handlePluginToggle = async (pluginId: string) => {
        const plugin = plugins.find((p) => p.pluginId === pluginId);
        const isEnabled = plugin?.enabled ?? false;
        try {
            if (isEnabled) {
                await api('/api/blog/extensibility/plugin/disable', {
                    method: 'POST',
                    body: { pluginId },
                });
                toast.success(`Plugin "${pluginId}" deactivated`);
            } else {
                await api('/api/blog/extensibility/plugin/enable', {
                    method: 'POST',
                    body: { pluginId },
                });
                toast.success(`Plugin "${pluginId}" activated`);
            }
            await loadData();
        } catch (error) {
            console.error('Error toggling plugin:', error);
            toast.error(`Failed to ${isEnabled ? 'deactivate' : 'activate'} plugin`);
        }
    };

    const handleConfigurePlugin = (plugin: DbPlugin) => {
        if (plugin.pluginId === 'post-content-plugin') {
            const cfg = (plugin.config || {}) as Partial<PostContentPluginConfig>;
            setPluginConfig({
                content: (cfg.content as string) || '',
                position: cfg.position || 'end',
                contentTypes: Array.isArray(cfg.contentTypes) ? cfg.contentTypes : [],
                postIds: Array.isArray(cfg.postIds) ? cfg.postIds : [],
                priority: cfg.priority ?? 10,
                enabled: cfg.enabled !== false,
            });
            setConfiguringPlugin(plugin);
            setConfigDialogOpen(true);
        }
    };

    const handleSavePluginConfig = async () => {
        if (!configuringPlugin || configuringPlugin.pluginId !== 'post-content-plugin') return;

        try {
            await api(`/api/blog/extensibility/plugin/${encodeURIComponent(configuringPlugin.pluginId)}/config`, {
                method: 'PUT',
                body: pluginConfig as Record<string, unknown>,
            });
            setConfigDialogOpen(false);
            setConfiguringPlugin(null);
            await loadData();
            toast.success('Plugin configuration saved');
        } catch (error) {
            console.error('Error saving plugin config:', error);
            toast.error('Failed to save plugin configuration');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/admin/blog">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Blog
                            </Link>
                        </Button>
                    </div>
                    <h1 className="text-3xl font-bold mt-4">Blog Extensibility</h1>
                    <p className="text-muted-foreground mt-2">Manage themes, plugins, and hooks for your blog system</p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="themes" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="themes" className="flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Themes ({themes.length})
                    </TabsTrigger>
                    <TabsTrigger value="plugins" className="flex items-center gap-2">
                        <Plug className="h-4 w-4" />
                        Plugins ({plugins.length})
                    </TabsTrigger>
                    <TabsTrigger value="hooks" className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Hooks
                    </TabsTrigger>
                </TabsList>

                {/* Themes Tab */}
                <TabsContent value="themes" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {themes.map((theme) => {
                            const isActive = activeThemeId === theme.themeId;
                            return (
                                <Card key={theme.themeId} className={isActive ? 'border-primary' : ''}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <CardTitle className="flex items-center gap-2">
                                                    {theme.name}
                                                    {isActive && (
                                                        <Badge variant="default" className="text-xs">
                                                            Active
                                                        </Badge>
                                                    )}
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    {theme.description || 'No description'}
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="text-sm text-muted-foreground">
                                                <div>
                                                    <strong>ID:</strong> {theme.themeId}
                                                </div>
                                                {theme.version && (
                                                    <div>
                                                        <strong>Version:</strong> {theme.version}
                                                    </div>
                                                )}
                                                {theme.author && (
                                                    <div>
                                                        <strong>Author:</strong> {theme.author}
                                                    </div>
                                                )}
                                            </div>

                                            {!isActive && (
                                                <Button
                                                    onClick={() => handleThemeActivate(theme.themeId)}
                                                    className="w-full"
                                                    size="sm"
                                                >
                                                    <Power className="mr-2 h-4 w-4" />
                                                    Activate Theme
                                                </Button>
                                            )}
                                            {isActive && (
                                                <Button disabled className="w-full" size="sm" variant="outline">
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                    Currently Active
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {themes.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No themes registered</p>
                        </div>
                    )}
                </TabsContent>

                {/* Plugins Tab */}
                <TabsContent value="plugins" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {plugins.map((plugin) => {
                            const isActive = plugin.enabled;
                            return (
                                <Card key={plugin.pluginId} className={isActive ? 'border-primary' : ''}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <CardTitle className="flex items-center gap-2">
                                                    {plugin.name}
                                                    {isActive && (
                                                        <Badge variant="default" className="text-xs">
                                                            Active
                                                        </Badge>
                                                    )}
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    {plugin.description || 'No description'}
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="text-sm text-muted-foreground">
                                                <div>
                                                    <strong>ID:</strong> {plugin.pluginId}
                                                </div>
                                                {plugin.version && (
                                                    <div>
                                                        <strong>Version:</strong> {plugin.version}
                                                    </div>
                                                )}
                                                {plugin.author && (
                                                    <div>
                                                        <strong>Author:</strong> {plugin.author}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {plugin.pluginId === 'post-content-plugin' && (
                                                    <Button
                                                        onClick={() => handleConfigurePlugin(plugin)}
                                                        className="flex-1"
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        <Settings className="mr-2 h-4 w-4" />
                                                        Configure
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={() => handlePluginToggle(plugin.pluginId)}
                                                    className={
                                                        plugin.pluginId === 'post-content-plugin' ? 'flex-1' : 'w-full'
                                                    }
                                                    size="sm"
                                                    variant={isActive ? 'destructive' : 'default'}
                                                >
                                                    {isActive ? (
                                                        <>
                                                            <Power className="mr-2 h-4 w-4" />
                                                            Deactivate
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Power className="mr-2 h-4 w-4" />
                                                            Activate
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {plugins.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No plugins registered</p>
                        </div>
                    )}
                </TabsContent>

                {/* Hooks Tab */}
                <TabsContent value="hooks" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Registered Hooks</CardTitle>
                            <CardDescription>
                                View all registered hooks and their callbacks. Hooks allow plugins to modify blog
                                rendering behavior.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="rounded-lg border p-4">
                                    <h3 className="font-semibold mb-2">Content Hooks</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <code className="text-muted-foreground">post.content.filter</code>
                                            <Badge variant="outline">Filter</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <code className="text-muted-foreground">post.excerpt.filter</code>
                                            <Badge variant="outline">Filter</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <code className="text-muted-foreground">post.title.filter</code>
                                            <Badge variant="outline">Filter</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg border p-4">
                                    <h3 className="font-semibold mb-2">Render Hooks</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <code className="text-muted-foreground">post.render.before</code>
                                            <Badge variant="secondary">Action</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <code className="text-muted-foreground">post.render.after</code>
                                            <Badge variant="secondary">Action</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <code className="text-muted-foreground">post.content.before</code>
                                            <Badge variant="secondary">Action</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <code className="text-muted-foreground">post.content.after</code>
                                            <Badge variant="secondary">Action</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg border p-4 bg-muted/50">
                                    <h3 className="font-semibold mb-2">Hook Types</h3>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p>
                                            <strong>Filters:</strong> Transform data (content, title, excerpt). Return
                                            modified value.
                                        </p>
                                        <p>
                                            <strong>Actions:</strong> Perform side effects (logging, analytics). No
                                            return value.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Plugin Configuration Dialog */}
            <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Configure Post Content Plugin</DialogTitle>
                        <DialogDescription>
                            Configure how and where content is injected into blog posts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Enabled Toggle */}
                        <div className="flex items-center justify-between">
                            <Label htmlFor="enabled">Enabled</Label>
                            <Switch
                                id="enabled"
                                checked={pluginConfig.enabled !== false}
                                onCheckedChange={(checked) => setPluginConfig({ ...pluginConfig, enabled: checked })}
                            />
                        </div>

                        {/* Position */}
                        <div className="space-y-2">
                            <Label htmlFor="position">Injection Position</Label>
                            <Select
                                value={pluginConfig.position || 'end'}
                                onValueChange={(value: 'beginning' | 'end' | 'random') =>
                                    setPluginConfig({ ...pluginConfig, position: value })
                                }
                            >
                                <SelectTrigger id="position">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="beginning">Beginning</SelectItem>
                                    <SelectItem value="end">End</SelectItem>
                                    <SelectItem value="random">Random</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Where to inject the content: at the beginning, end, or a random position in the post.
                            </p>
                        </div>

                        {/* Content */}
                        <div className="space-y-2">
                            <Label htmlFor="content">Content to Inject (HTML)</Label>
                            <Textarea
                                id="content"
                                value={pluginConfig.content || ''}
                                onChange={(e) => setPluginConfig({ ...pluginConfig, content: e.target.value })}
                                placeholder="<div>Your HTML content here</div>"
                                className="font-mono text-sm"
                                rows={6}
                            />
                            <p className="text-xs text-muted-foreground">
                                HTML content that will be injected into posts. Supports any valid HTML.
                            </p>
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Input
                                id="priority"
                                type="number"
                                value={pluginConfig.priority || 10}
                                onChange={(e) =>
                                    setPluginConfig({ ...pluginConfig, priority: parseInt(e.target.value) || 10 })
                                }
                                min={1}
                                max={100}
                            />
                            <p className="text-xs text-muted-foreground">
                                Hook priority (1-100). Lower numbers execute earlier. Default: 10.
                            </p>
                        </div>

                        {/* Content Types Filter */}
                        <div className="space-y-2">
                            <Label htmlFor="contentTypes">Content Types Filter (comma-separated)</Label>
                            <Input
                                id="contentTypes"
                                value={(pluginConfig.contentTypes || []).join(', ')}
                                onChange={(e) => {
                                    const types = e.target.value
                                        .split(',')
                                        .map((t) => t.trim())
                                        .filter(Boolean);
                                    setPluginConfig({ ...pluginConfig, contentTypes: types });
                                }}
                                placeholder="blog, changelog (leave empty for all types)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Only inject content for these content types. Leave empty to apply to all types.
                            </p>
                        </div>

                        {/* Post IDs Filter */}
                        <div className="space-y-2">
                            <Label htmlFor="postIds">Post IDs Filter (comma-separated)</Label>
                            <Input
                                id="postIds"
                                value={(pluginConfig.postIds || []).join(', ')}
                                onChange={(e) => {
                                    const ids = e.target.value
                                        .split(',')
                                        .map((id) => id.trim())
                                        .filter(Boolean);
                                    setPluginConfig({ ...pluginConfig, postIds: ids });
                                }}
                                placeholder="post-id-1, post-id-2 (leave empty for all posts)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Only inject content for these specific post IDs. Leave empty to apply to all posts.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSavePluginConfig}>Save Configuration</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default AdminBlogExtensibilityPage;
