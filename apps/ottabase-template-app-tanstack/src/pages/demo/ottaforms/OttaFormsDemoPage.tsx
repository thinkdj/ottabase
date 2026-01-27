// ============================================================
// OttaForms Demo Page
// ============================================================
// Demonstrates auto-generated CRUD forms from OttaORM models
// ============================================================

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ottabase/ui-shadcn";
import { ModelCrud, createModelConfig, defineModelConfig } from "@ottabase/forms";
import { User, Tag } from "@ottabase/ottaorm/models";
import { Post } from "@ottabase/ottablog";
import type { ModelConfig } from "@ottabase/forms";

// Create model configs from OttaORM models
// Models now contain all metadata (displayName, defaultSort, etc.) as SSOT
const usersConfig = createModelConfig(User);
const postsConfig = createModelConfig(Post);
const tagsConfig = createModelConfig(Tag);

// Example of defining config manually (for custom entities)
const todosConfig = defineModelConfig({
  entity: "todos",
  displayName: "Todo",
  displayNamePlural: "Todos",
  primaryKey: "id",
  defaultSort: "createdAt",
  defaultSortDirection: "desc",
  fields: {
    id: {
      type: "id",
      primaryKey: true,
      editable: false,
      uiConfig: { label: "ID" },
    },
    title: {
      type: "string",
      editable: true,
      searchable: true,
      sortable: true,
      uiConfig: {
        label: "Title",
        placeholder: "Enter todo title",
      },
      formConfig: {
        visible: true,
        fieldType: "input",
      },
      tableConfig: {
        visible: true,
      },
      validation: {
        rules: "required",
        messages: { required: "Title is required" },
      },
    },
    completed: {
      type: "boolean",
      editable: true,
      filterable: true,
      sortable: true,
      uiConfig: {
        label: "Completed",
        description: "Mark as done",
      },
      formConfig: {
        visible: true,
        fieldType: "boolean",
      },
      tableConfig: {
        visible: true,
        colWidth: 100,
      },
    },
    userId: {
      type: "string",
      editable: true,
      filterable: true,
      uiConfig: {
        label: "Assigned To",
      },
      formConfig: {
        visible: true,
        fieldType: "select",
        relationship: {
          entity: "users",
          labelField: "name",
          valueField: "id",
        },
      },
      tableConfig: {
        visible: true,
        colWidth: 150,
      },
    },
    createdAt: {
      type: "datetime",
      editable: false,
      sortable: true,
      uiConfig: { label: "Created" },
      tableConfig: {
        visible: true,
        colWidth: 180,
        format: "datetime",
      },
    },
  },
});

type ModelKey = "users" | "posts" | "tags" | "todos";

const modelConfigs: Record<ModelKey, ModelConfig> = {
  users: usersConfig,
  posts: postsConfig,
  tags: tagsConfig,
  todos: todosConfig,
};

const modelDescriptions: Record<ModelKey, string> = {
  users: "Manage user accounts with profile information",
  posts: "Blog posts with author relationships and publishing status",
  tags: "Tags for categorizing content",
  todos: "Simple todo list with user assignment",
};

export function OttaFormsDemoPage() {
  const [selectedModel, setSelectedModel] = useState<ModelKey | null>(null);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-6xl flex-col gap-8 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link to="/demo">← Back to Demo Gallery</Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">OttaForms Demo</h1>
          <p className="mt-2 text-muted-foreground">
            Auto-generated CRUD forms from OttaORM model metadata. Select a model below to see
            the full CRUD interface with list, detail, create, and edit views.
          </p>
        </div>
      </div>

      {/* Model Selection or CRUD View */}
      {selectedModel ? (
        <div className="space-y-4">
          {/* Back to model selection */}
          <Button variant="outline" onClick={() => setSelectedModel(null)}>
            ← Select Different Model
          </Button>

          {/* CRUD Interface */}
          <Card>
            <CardContent className="pt-6">
              <ModelCrud
                config={modelConfigs[selectedModel]}
                apiBasePath="/api/ottaorm"
                perPage={10}
                onCreate={(record) => {
                  console.log("Created:", record);
                }}
                onUpdate={(record) => {
                  console.log("Updated:", record);
                }}
                onDelete={(id) => {
                  console.log("Deleted:", id);
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
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setSelectedModel(key)}
              >
                <CardHeader>
                  <CardTitle className="capitalize">{modelConfigs[key].displayNamePlural}</CardTitle>
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
                          className="rounded-full bg-muted px-2 py-1 text-xs"
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
                    Open CRUD Interface
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Features Section */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Features</CardTitle>
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
                  title="Full CRUD"
                  description="List, detail, create, and edit views in one component"
                />
              </div>
            </CardContent>
          </Card>

          {/* Code Example */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Example</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                <code>{`import { ModelCrud, createModelConfig } from "@ottabase/forms";
import { User } from "@ottabase/ottaorm/models";

// Create config from OttaORM model - metadata comes from model SSOT
const usersConfig = createModelConfig(User);

// Or override specific options if needed:
// const usersConfig = createModelConfig(User, { displayName: "Member" });

// Use in your component
function UsersPage() {
  return (
    <ModelCrud
      config={usersConfig}
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

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default OttaFormsDemoPage;
