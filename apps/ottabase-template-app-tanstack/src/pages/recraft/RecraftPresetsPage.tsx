import { api } from '@/lib/api';
import { BUILT_IN_PRESETS, type BuiltInPreset } from '@ottabase/recraft/presets';
import { PRESET_CATEGORIES } from '@ottabase/recraft';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@ottabase/ui-shadcn';
import { ArrowLeft, Palette, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

export function RecraftPresetsPage() {
    const [seedStatus, setSeedStatus] = useState<string | null>(null);
    const [seeding, setSeeding] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    // Group presets by category
    const grouped: Record<string, BuiltInPreset[]> = {};
    for (const preset of BUILT_IN_PRESETS) {
        if (!grouped[preset.category]) grouped[preset.category] = [];
        grouped[preset.category].push(preset);
    }

    const filteredPresets =
        activeCategory === 'all'
            ? BUILT_IN_PRESETS
            : BUILT_IN_PRESETS.filter((p) => p.category === activeCategory);

    async function handleSeed() {
        setSeeding(true);
        setSeedStatus(null);
        try {
            const res = await api<{ success: boolean; message: string; created: string[] }>(
                '/api/recraft/presets/seed',
                { method: 'POST' },
            );
            setSeedStatus(res.message);
        } catch {
            setSeedStatus('Failed to seed presets');
        } finally {
            setSeeding(false);
        }
    }

    const categoryColors: Record<string, string> = {
        illustration: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        logo: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        icon: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        pattern: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        photo: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link to="/recraft">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Palette className="w-6 h-6" />
                        Style Presets
                    </h1>
                    <p className="text-muted-foreground">
                        {BUILT_IN_PRESETS.length} built-in styles for brand assets, logos, and illustrations
                    </p>
                </div>
                <Button variant="outline" onClick={handleSeed} disabled={seeding}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {seeding ? 'Seeding...' : 'Seed to DB'}
                </Button>
            </div>

            {seedStatus && (
                <div className="mb-6 p-3 bg-muted rounded-lg text-sm">{seedStatus}</div>
            )}

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
                <Button
                    variant={activeCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveCategory('all')}
                >
                    All ({BUILT_IN_PRESETS.length})
                </Button>
                {Object.entries(grouped).map(([category, presets]) => (
                    <Button
                        key={category}
                        variant={activeCategory === category ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveCategory(category)}
                    >
                        {PRESET_CATEGORIES[category as keyof typeof PRESET_CATEGORIES] || category} (
                        {presets.length})
                    </Button>
                ))}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPresets.map((preset) => (
                    <Card key={preset.slug} className="overflow-hidden">
                        {/* Style Preview Header */}
                        <div className="h-3 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />

                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <CardTitle className="text-base">{preset.name}</CardTitle>
                                <Badge
                                    className={`text-[10px] ${categoryColors[preset.category] || 'bg-gray-100 text-gray-800'}`}
                                    variant="outline"
                                >
                                    {preset.category}
                                </Badge>
                            </div>
                            <CardDescription className="text-xs">{preset.description}</CardDescription>
                        </CardHeader>

                        <CardContent className="pt-0">
                            {/* Style Config Preview */}
                            <div className="space-y-2">
                                <div className="bg-muted/50 rounded p-2">
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                        Prompt Style
                                    </p>
                                    <p className="text-xs text-foreground/80 line-clamp-2">
                                        {preset.styleConfig.promptSuffix}
                                    </p>
                                </div>

                                {preset.styleConfig.negativePrompt && (
                                    <div className="bg-destructive/5 rounded p-2">
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                            Avoids
                                        </p>
                                        <p className="text-xs text-foreground/60 line-clamp-1">
                                            {preset.styleConfig.negativePrompt}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                    {preset.styleConfig.guidanceScale && (
                                        <span>CFG: {preset.styleConfig.guidanceScale}</span>
                                    )}
                                    {preset.styleConfig.steps && (
                                        <span>Steps: {preset.styleConfig.steps}</span>
                                    )}
                                    <Badge variant="outline" className="text-[10px] ml-auto">
                                        {preset.slug}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
