import { useApiMutation } from '@ottabase/ottaorm/client';
import { COMMON_BLOG_LANGUAGES, type BlogLanguage, type BlogLanguageConfig } from '@ottabase/ottablog';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    NativeSelect,
    NativeSelectOption,
} from '@ottabase/ui-shadcn';
import { Languages, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    config: BlogLanguageConfig;
    onSaved?: () => void;
}

export function BlogLanguageSettingsCard({ config, onSaved }: Props) {
    const [languages, setLanguages] = useState<BlogLanguage[]>(config.supportedLanguages);
    const [defaultLanguage, setDefaultLanguage] = useState(config.defaultLanguage);
    const [fallbackToDefault, setFallbackToDefault] = useState(config.fallbackToDefault);
    const [quickAddCode, setQuickAddCode] = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const mutation = useApiMutation<
        BlogLanguageConfig,
        { defaultLanguage: string; supportedLanguages: BlogLanguage[]; fallbackToDefault: boolean }
    >({
        endpoint: '/api/blog/studio/languages',
        method: 'POST',
        invalidateEntities: ['blog_studio', 'blog_translations'],
        mutationOptions: {
            onSuccess: () => {
                setSaveError(null);
                onSaved?.();
            },
            onError: (error) =>
                setSaveError(error instanceof Error ? error.message : 'Could not save language settings.'),
        },
    });

    useEffect(() => {
        setLanguages(config.supportedLanguages);
        setDefaultLanguage(config.defaultLanguage);
        setFallbackToDefault(config.fallbackToDefault);
    }, [config]);

    const addLanguage = () => setLanguages((items) => [...items, { code: '', name: '', nativeName: '' }]);
    const addCommonLanguage = (code: string) => {
        setQuickAddCode('');
        const language = COMMON_BLOG_LANGUAGES.find((item) => item.code === code);
        if (!language || languages.some((item) => item.code === language.code)) return;
        setLanguages((items) => [...items, { ...language }]);
    };
    const updateLanguage = (index: number, key: keyof BlogLanguage, value: string) => {
        setLanguages((items) =>
            items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
        );
    };
    const save = () => {
        const enabled = languages.filter((item) => item.code.trim() || item.name.trim());
        const nextDefault = enabled.some((item) => item.code === defaultLanguage)
            ? defaultLanguage
            : enabled[0]?.code || defaultLanguage;
        setDefaultLanguage(nextDefault);
        mutation.mutate({ defaultLanguage: nextDefault, supportedLanguages: enabled, fallbackToDefault });
    };

    return (
        <Card className="rounded-2xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Languages className="h-4 w-4" />
                    Languages
                </CardTitle>
                <CardDescription>
                    Enable languages for this blog. Each post keeps its canonical language and can have one published
                    version per enabled language.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="blog-default-language">Default language</Label>
                    <select
                        id="blog-default-language"
                        value={defaultLanguage}
                        onChange={(event) => setDefaultLanguage(event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                        {languages
                            .filter((item) => item.code)
                            .map((item) => (
                                <option key={item.code} value={item.code}>
                                    {item.name || item.code} ({item.code})
                                </option>
                            ))}
                    </select>
                </div>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>Supported languages</Label>
                        <div className="flex flex-wrap gap-2">
                            <NativeSelect
                                aria-label="Add common language"
                                value={quickAddCode}
                                onChange={(event) => addCommonLanguage(event.target.value)}
                            >
                                <NativeSelectOption value="">Add common language…</NativeSelectOption>
                                {COMMON_BLOG_LANGUAGES.filter(
                                    (item) => !languages.some((current) => current.code === item.code),
                                ).map((item) => (
                                    <NativeSelectOption key={item.code} value={item.code}>
                                        {item.name} ({item.code})
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                            <Button type="button" size="sm" variant="outline" onClick={addLanguage}>
                                <Plus className="mr-1 h-4 w-4" />
                                Custom language
                            </Button>
                        </div>
                    </div>
                    {languages.map((item, index) => (
                        <div key={item.code + '-' + index} className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr_auto]">
                            <Input
                                aria-label={'Language ' + (index + 1) + ' code'}
                                placeholder="en"
                                value={item.code}
                                onChange={(event) => updateLanguage(index, 'code', event.target.value)}
                            />
                            <Input
                                aria-label={'Language ' + (index + 1) + ' name'}
                                placeholder="English"
                                value={item.name}
                                onChange={(event) => updateLanguage(index, 'name', event.target.value)}
                            />
                            <Input
                                aria-label={'Language ' + (index + 1) + ' native name'}
                                placeholder="Native name (optional)"
                                value={item.nativeName ?? ''}
                                onChange={(event) => updateLanguage(index, 'nativeName', event.target.value)}
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={'Remove language ' + (index + 1)}
                                onClick={() =>
                                    setLanguages((items) => items.filter((_, itemIndex) => itemIndex !== index))
                                }
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    Use a BCP-47 code such as <code>en</code> or <code>ml</code>. The code is required for public
                    language negotiation.
                </p>
                {saveError && (
                    <p className="text-sm text-destructive" role="alert">
                        {saveError}
                    </p>
                )}
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={fallbackToDefault}
                        onChange={(event) => setFallbackToDefault(event.target.checked)}
                    />
                    Fall back to the default language when a translation is unavailable
                </label>
                <div className="flex justify-end">
                    <Button type="button" onClick={save} disabled={mutation.isPending || languages.length === 0}>
                        <Save className="mr-2 h-4 w-4" />
                        {mutation.isPending ? 'Saving…' : 'Save languages'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
