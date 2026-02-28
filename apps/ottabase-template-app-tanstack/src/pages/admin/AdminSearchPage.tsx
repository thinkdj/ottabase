import { api } from '@/lib/api';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Switch,
} from '@ottabase/ui-shadcn';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type SearchModelConfig = {
    entityName: string;
    modelName: string;
    tableName: string;
    enabled: boolean;
    fields: string[];
    lastIndexedAt: number | null;
};

type SearchStatus = {
    ftsReady: boolean;
    indexedDocuments: number;
    enabledModels: number;
    hasVectorize: boolean;
    pending: string[];
};

async function loadSearchConfig() {
    return api<{ models: SearchModelConfig[] }>('/api/ottasearch/config');
}

async function loadSearchStatus() {
    return api<SearchStatus>('/api/ottasearch/status');
}

export function AdminSearchPage() {
    const [models, setModels] = useState<SearchModelConfig[]>([]);
    const [status, setStatus] = useState<SearchStatus | null>(null);
    const [busyEntity, setBusyEntity] = useState<string | null>(null);
    const [reindexing, setReindexing] = useState(false);

    const refresh = async () => {
        const [configData, statusData] = await Promise.all([loadSearchConfig(), loadSearchStatus()]);
        setModels(configData.models);
        setStatus(statusData);
    };

    useEffect(() => {
        void refresh();
    }, []);

    const pending = useMemo(() => status?.pending ?? [], [status]);

    const toggleModel = async (model: SearchModelConfig, enabled: boolean) => {
        setBusyEntity(model.entityName);
        try {
            await api('/api/ottasearch/config', {
                method: 'PUT',
                body: {
                    entityName: model.entityName,
                    enabled,
                    fields: model.fields,
                },
            });
            await refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update searchable model');
        } finally {
            setBusyEntity(null);
        }
    };

    const updateFields = async (model: SearchModelConfig, rawFields: string) => {
        const fields = rawFields
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        await api('/api/ottasearch/config', {
            method: 'PUT',
            body: {
                entityName: model.entityName,
                enabled: model.enabled,
                fields,
            },
        });
        await refresh();
    };

    const runReindex = async (entityName?: string) => {
        setReindexing(true);
        try {
            await api('/api/ottasearch/reindex', {
                method: 'POST',
                body: {
                    entityName,
                },
            });
            await refresh();
            toast.success(entityName ? `Reindexed ${entityName}` : 'Search index refreshed');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Reindex failed');
        } finally {
            setReindexing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Search Admin</h1>
                <p className="text-muted-foreground mt-2">
                    Configure searchable models and run in-house indexing (D1 FTS + optional Vectorize semantic
                    ranking).
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">FTS Index</CardTitle>
                        <CardDescription>{status?.ftsReady ? 'Ready' : 'Pending setup'}</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Indexed Documents</CardTitle>
                        <CardDescription>{status?.indexedDocuments ?? 0}</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Enabled Models</CardTitle>
                        <CardDescription>{status?.enabledModels ?? 0}</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Semantic (Vectorize)</CardTitle>
                        <CardDescription>{status?.hasVectorize ? 'Enabled' : 'Not configured'}</CardDescription>
                    </CardHeader>
                </Card>
            </div>

            {pending.length > 0 && (
                <Card className="border-amber-500/50">
                    <CardHeader>
                        <CardTitle>Pending setup</CardTitle>
                        <CardDescription>Complete these from admin to fully activate in-house search.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {pending.map((item) => (
                            <div key={item} className="text-sm text-amber-700 dark:text-amber-300">
                                • {item}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Searchable models</CardTitle>
                        <CardDescription>Choose models and fields to index into D1 FTS.</CardDescription>
                    </div>
                    <Button onClick={() => runReindex()} disabled={reindexing}>
                        {reindexing ? 'Reindexing…' : 'Reindex all'}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {models.map((model) => (
                        <div key={model.entityName} className="rounded border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium flex items-center gap-2">
                                        {model.entityName}
                                        <Badge variant="outline">{model.tableName}</Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">{model.modelName}</div>
                                </div>
                                <Switch
                                    checked={model.enabled}
                                    disabled={busyEntity === model.entityName}
                                    onCheckedChange={(checked) => toggleModel(model, checked)}
                                />
                            </div>
                            <Input
                                defaultValue={model.fields.join(', ')}
                                placeholder="title, description, content"
                                onBlur={(event) => updateFields(model, event.target.value)}
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                    Last indexed:{' '}
                                    {model.lastIndexedAt ? new Date(model.lastIndexedAt).toLocaleString() : 'Never'}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={reindexing}
                                    onClick={() => runReindex(model.entityName)}
                                >
                                    Reindex model
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
