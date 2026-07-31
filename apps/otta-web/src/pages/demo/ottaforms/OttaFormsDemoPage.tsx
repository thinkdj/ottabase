// ============================================================
// OttaForms Demo Page
// ============================================================
// Demonstrates auto-generated CRUD forms from OttaORM models
// ============================================================

import type { ModelConfig } from '@ottabase/forms';
import { createModelConfig, defineModelConfig } from '@ottabase/forms';
import { ModelCrud } from '@ottabase/forms/react';
import { Post } from '@ottabase/ottablog';
import { Tag, User } from '@ottabase/ottaorm/models';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

// Create model configs from OttaORM models
// Models now contain all metadata (displayName, defaultSort, etc.) as SSOT
const usersConfig = createModelConfig(User);
const postsConfig = createModelConfig(Post);
const tagsConfig = createModelConfig(Tag);

// Example of defining config manually (for custom entities)
const todosConfig = defineModelConfig({
    entity: 'todos',
    displayName: 'Todo',
    displayNamePlural: 'Todos',
    primaryKey: 'id',
    defaultSort: 'createdAt',
    defaultSortDirection: 'desc',
    fields: {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Title',
                placeholder: 'Enter todo title',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
            },
            validation: {
                rules: 'required',
                messages: { required: 'Title is required' },
            },
        },
        completed: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Completed',
                description: 'Mark as done',
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        createdAt: {
            type: 'datetime',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: {
                visible: true,
                colWidth: 180,
                format: 'datetime',
            },
        },
    },
});

type ModelKey = 'users' | 'posts' | 'tags' | 'todos';

const modelConfigs: Record<ModelKey, ModelConfig> = {
    users: usersConfig,
    posts: postsConfig,
    tags: tagsConfig,
    todos: todosConfig,
};

const modelDescriptions: Record<ModelKey, string> = {
    users: 'Protected model: demonstrates that generated CRUD cannot bypass server authorization',
    posts: 'Blog posts with author relationships and publishing status',
    tags: 'Tags for categorizing content',
    todos: 'Simple todo list with completion tracking',
};

export function OttaFormsDemoPage() {
    const [selectedModel, setSelectedModel] = useState<ModelKey | null>(null);

    return (
        <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-8">
            <DemoPageHeader
                title="OttaForms"
                description="Auto-generated CRUD forms from OttaORM model metadata. Select a model below to see the full CRUD interface with list, detail, create, and edit views."
            />

            {/* Model Selection or CRUD View */}
            {selectedModel ? (
                <div className="space-y-4">
                    {/* Back to model selection */}
                    <Button variant="outline" onClick={() => setSelectedModel(null)}>
                        ← Select Different Model
                    </Button>

                    {/* CRUD Interface */}
                    <Card className="rounded-xl border-border/60 shadow-none">
                        <CardContent className="pt-6">
                            <ModelCrud
                                config={modelConfigs[selectedModel]}
                                apiBasePath="/api/ottaorm"
                                perPage={10}
                                header={selectedModel === 'users' ? <ProtectedUsersNotice /> : undefined}
                                onCreate={(record) => {
                                    console.log('Created:', record);
                                }}
                                onUpdate={(record) => {
                                    console.log('Updated:', record);
                                }}
                                onDelete={(id) => {
                                    console.log('Deleted:', id);
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <>
                    {/* Model Selection Grid */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {(Object.keys(modelConfigs) as ModelKey[]).map((key) => (
                            <Card
                                key={key}
                                className="cursor-pointer rounded-xl border-transparent bg-muted/40 shadow-none transition-colors duration-normal hover:bg-muted/70"
                                onClick={() => setSelectedModel(key)}
                            >
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between gap-3 text-[0.9375rem] font-semibold capitalize">
                                        <span>{modelConfigs[key].displayNamePlural}</span>
                                        {key === 'users' ? (
                                            <Badge
                                                variant="outline"
                                                className="border-warning/40 bg-warning/10 text-warning"
                                            >
                                                Protected
                                            </Badge>
                                        ) : null}
                                    </CardTitle>
                                    <CardDescription>{modelDescriptions[key]}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(modelConfigs[key].fields)
                                            .filter(([_, field]) => field.tableConfig?.visible !== false)
                                            .slice(0, 5)
                                            .map(([fieldKey, field]) => (
                                                <span
                                                    key={fieldKey}
                                                    className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground ring-1 ring-border"
                                                >
                                                    {field.uiConfig?.label || fieldKey}
                                                </span>
                                            ))}
                                        {Object.keys(modelConfigs[key].fields).length > 5 && (
                                            <span className="text-xs text-muted-foreground">
                                                +{Object.keys(modelConfigs[key].fields).length - 5} more
                                            </span>
                                        )}
                                    </div>
                                    <Button className="mt-4 w-full" variant="outline">
                                        {key === 'users' ? 'Test Access Boundary' : 'Open CRUD Interface'}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Features Section */}
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Features</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <FeatureItem
                                    title="Auto-generated Forms"
                                    description="Forms are generated from OttaORM model field metadata"
                                />
                                <FeatureItem
                                    title="Type Detection"
                                    description="Field types (input, textarea, select, date, etc.) are inferred automatically"
                                />
                                <FeatureItem
                                    title="Relationship Fields"
                                    description="Select/multiselect fields fetch options from related models via API"
                                />
                                <FeatureItem
                                    title="Validation"
                                    description="Client-side validation from model validation rules"
                                />
                                <FeatureItem
                                    title="TanStack Query"
                                    description="Built-in data fetching, caching, and mutations"
                                />
                                <FeatureItem
                                    title="Authorization Boundaries"
                                    description="Generated UI enables CRUD where allowed but never bypasses server RBAC or RLS"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Code Example */}
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Usage Example</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="overflow-x-auto rounded-lg bg-background p-4 text-sm text-foreground ring-1 ring-border">
                                <code>{`import { createModelConfig } from "@ottabase/forms";
import { ModelCrud } from "@ottabase/forms/react";
import { Tag } from "@ottabase/ottaorm/models";

// Create config from OttaORM model - metadata comes from model SSOT
const tagsConfig = createModelConfig(Tag);

// Or override specific options if needed:
// const tagsConfig = createModelConfig(Tag, { displayName: "Topic" });

// Use in your component
function TagsPage() {
  return (
    <ModelCrud
      config={tagsConfig}
      apiBasePath="/api/ottaorm"
      onCreate={(record) => console.log("Created:", record)}
    />
  );
}`}</code>
                            </pre>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

function ProtectedUsersNotice() {
    return (
        <div role="note" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Protected model demonstration</p>
                    <Badge variant="outline" className="border-warning/40 text-warning">
                        Expected 403
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    OttaForms can generate this interface from the User model metadata, but metadata never grants API
                    access. The server deliberately blocks generic User CRUD, so the request below should produce one
                    clear access-denied result.
                </p>
                <p className="text-xs text-muted-foreground">
                    Expected flow: <code className="font-mono text-foreground">GET /api/ottaorm/users</code> → 403,
                    shown once as a toast and once as persistent inline context.
                </p>
            </div>
        </div>
    );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
    return (
        <div className="space-y-1">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

export default OttaFormsDemoPage;
