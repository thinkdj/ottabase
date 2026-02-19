'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import {
    Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
    Input, Label, Switch, Textarea,
} from '@ottabase/ui-shadcn';
import { ArrowLeft, Save } from 'lucide-react';
import { getSectionFields, type SectionType } from '@ottabase/ottalanding';
import { landingSectionHooks, type LandingSectionItem } from '@/hooks/landingHooks';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get a nested value from an object using dot-separated path */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

/** Set a nested value in an object using dot-separated path, returns new object */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const keys = path.split('.');
    const result = { ...obj };
    let current: Record<string, unknown> = result;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current[key] = { ...(current[key] as Record<string, unknown>) };
        current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    return result;
}

// ─── Section type labels ────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
    hero: 'Hero',
    features: 'Features',
    pricing: 'Pricing',
    testimonials: 'Testimonials',
    faq: 'FAQ',
    'logo-cloud': 'Logo Cloud',
    cta: 'Call to Action',
    stats: 'Stats',
    steps: 'Steps',
    'feature-highlight': 'Feature Highlight',
    about: 'About',
    contact: 'Contact',
    timeline: 'Timeline',
};

// ─── Section Content Form ───────────────────────────────────────────────────

function SectionContentForm({
    sectionType,
    content,
    onSave,
    isSaving,
}: {
    sectionType: string;
    content: Record<string, unknown>;
    onSave: (updated: Record<string, unknown>) => void;
    isSaving: boolean;
}) {
    const [formData, setFormData] = useState<Record<string, unknown>>(content);

    // Get field definitions for this section type
    const fields = useMemo(() => {
        try {
            return getSectionFields(sectionType as SectionType);
        } catch {
            return null;
        }
    }, [sectionType]);

    if (!fields) {
        // Fallback: raw JSON editor
        return <RawJsonEditor content={content} onSave={onSave} isSaving={isSaving} />;
    }

    // Sort fields by order
    const sortedFields = Object.entries(fields)
        .filter(([, f]) => f.formConfig?.visible !== false)
        .sort((a, b) => ((a[1].formConfig?.order ?? 99) - (b[1].formConfig?.order ?? 99)));

    const handleFieldChange = (path: string, value: unknown) => {
        setFormData((prev) => setNestedValue(prev, path, value));
    };

    return (
        <div className="space-y-5">
            {sortedFields.map(([fieldPath, fieldDef]) => {
                const fieldType = fieldDef.formConfig?.fieldType ?? 'input';
                const label = fieldDef.uiConfig?.label ?? fieldPath;
                const description = fieldDef.uiConfig?.description;
                const placeholder = fieldDef.uiConfig?.placeholder as string | undefined;
                const currentValue = getNestedValue(formData, fieldPath);

                return (
                    <div key={fieldPath} className="space-y-1.5">
                        <Label htmlFor={fieldPath} className="text-sm font-medium">
                            {label}
                        </Label>
                        {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                        )}

                        {fieldType === 'textarea' ? (
                            <Textarea
                                id={fieldPath}
                                rows={3}
                                value={(currentValue as string) ?? ''}
                                onChange={(e) => handleFieldChange(fieldPath, e.target.value)}
                                placeholder={placeholder}
                            />
                        ) : fieldType === 'select' ? (
                            <select
                                id={fieldPath}
                                value={(currentValue as string) ?? ''}
                                onChange={(e) => handleFieldChange(fieldPath, e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {(fieldDef.formConfig?.options as Array<{ label: string; value: string }>)?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        ) : fieldType === 'boolean' ? (
                            <div className="flex items-center gap-2">
                                <Switch
                                    id={fieldPath}
                                    checked={!!currentValue}
                                    onCheckedChange={(v) => handleFieldChange(fieldPath, v)}
                                />
                                <Label htmlFor={fieldPath} className="text-sm text-muted-foreground">{label}</Label>
                            </div>
                        ) : fieldType === 'json' ? (
                            <Textarea
                                id={fieldPath}
                                rows={8}
                                value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue ?? '', null, 2)}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        handleFieldChange(fieldPath, parsed);
                                    } catch {
                                        // Store raw string until valid JSON
                                        handleFieldChange(fieldPath, e.target.value);
                                    }
                                }}
                                placeholder={placeholder}
                                className="font-mono text-xs"
                            />
                        ) : (
                            <Input
                                id={fieldPath}
                                value={(currentValue as string) ?? ''}
                                onChange={(e) => handleFieldChange(fieldPath, e.target.value)}
                                placeholder={placeholder}
                            />
                        )}
                    </div>
                );
            })}

            <div className="flex justify-end pt-4">
                <Button onClick={() => onSave(formData)} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Content
                </Button>
            </div>
        </div>
    );
}

// ─── Raw JSON Editor (fallback) ─────────────────────────────────────────────

function RawJsonEditor({
    content,
    onSave,
    isSaving,
}: {
    content: Record<string, unknown>;
    onSave: (updated: Record<string, unknown>) => void;
    isSaving: boolean;
}) {
    const [json, setJson] = useState(JSON.stringify(content, null, 2));
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => {
        try {
            const parsed = JSON.parse(json);
            setError(null);
            onSave(parsed);
        } catch (e) {
            setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
                No structured fields defined for this section type. Editing raw JSON content.
            </p>
            <Textarea
                rows={20}
                value={json}
                onChange={(e) => setJson(e.target.value)}
                className="font-mono text-xs"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Content
                </Button>
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function AdminLandingSectionEditorPage() {
    const { sectionId } = useParams({ from: '/admin/landing/sections/$sectionId' as any });
    const { data: sectionData, isLoading, refetch } = landingSectionHooks.useDetail(sectionId);
    const updateMutation = landingSectionHooks.useUpdate();

    const section = sectionData as LandingSectionItem | undefined;

    const handleSave = async (updatedContent: Record<string, unknown>) => {
        if (!section) return;
        try {
            await updateMutation.mutateAsync({
                id: section.id,
                data: { content: updatedContent },
            });
            refetch();
        } catch {
            // handled
        }
    };

    if (isLoading) {
        return <p className="text-sm text-muted-foreground py-12 text-center">Loading section...</p>;
    }

    if (!section) {
        return <p className="text-sm text-destructive py-12 text-center">Section not found.</p>;
    }

    const sectionLabel = SECTION_LABELS[section.sectionType] ?? section.sectionType;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/admin/landing/pages/$pageId" params={{ pageId: section.pageId }}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{sectionLabel}</h1>
                    <p className="text-sm text-muted-foreground">Edit section content.</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Badge variant="outline">{section.sectionType}</Badge>
                    <Badge variant={section.visible ? 'default' : 'secondary'}>
                        {section.visible ? 'Visible' : 'Hidden'}
                    </Badge>
                </div>
            </div>

            {/* Content form */}
            <Card>
                <CardHeader>
                    <CardTitle>Content</CardTitle>
                    <CardDescription>
                        Edit the content for this {sectionLabel.toLowerCase()} section.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SectionContentForm
                        sectionType={section.sectionType}
                        content={(section.content ?? {}) as Record<string, unknown>}
                        onSave={handleSave}
                        isSaving={updateMutation.isPending}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
