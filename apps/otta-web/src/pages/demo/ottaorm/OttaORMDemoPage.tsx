import { useSession } from '@/lib/auth';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { EmptyState } from '@ottabase/ui-components';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Input } from '@ottabase/ui-shadcn';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

/** The app's Todo model, as the client sees it */
interface Todo {
    id: string;
    title: string;
    completed: boolean;
}

// One call per model gives list, get, create, update and delete hooks over /api/ottaorm/todos,
// the generic CRUD route every allow-listed model shares.
const todoHooks = createModelHooks<Todo>({ entityName: 'todos' });

export function OttaORMDemoPage() {
    const { isAuthenticated, isInitialized, isLoading: authLoading } = useSession();
    const [title, setTitle] = useState('');
    // Do not start privileged queries from the persisted browser snapshot. The
    // root session bootstrap must first confirm that snapshot with the server.
    const canUseCrud = isInitialized && isAuthenticated && !authLoading;

    // TanStack Query under the hood: caching, loading state and refetching come for free
    const { data: todos = [], isLoading, error } = todoHooks.useList(undefined, { enabled: canUseCrud });
    const createTodo = todoHooks.useCreate();
    const updateTodo = todoHooks.useUpdate();
    const deleteTodo = todoHooks.useDelete();
    const busy = createTodo.isPending || updateTodo.isPending || deleteTodo.isPending;

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canUseCrud || !title.trim()) return;
        await createTodo.mutateAsync({ title: title.trim() });
        setTitle('');
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="OttaORM"
                description="Class-based models on D1, reached through the generic CRUD route and TanStack Query hooks: caching, loading states and cache updates without any fetch code of your own."
            />

            {error ? <Alert variant="destructive">{error.message}</Alert> : null}

            {!canUseCrud ? (
                <Alert variant="warning">Sign in to read and write the todos table through OttaORM.</Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between text-[0.9375rem] font-semibold">
                            Todos
                            {isLoading && <span className="text-xs font-normal text-muted-foreground">Loading…</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleAdd} className="flex gap-2">
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What needs to be done?"
                                aria-label="New todo"
                                disabled={createTodo.isPending}
                            />
                            <Button type="submit" disabled={createTodo.isPending || !title.trim()} className="shrink-0">
                                {createTodo.isPending ? 'Adding…' : 'Add'}
                            </Button>
                        </form>

                        {todos.length === 0 ? (
                            <EmptyState
                                title="No todos yet"
                                description="Add one above; it lands in D1 through the model."
                                compact
                            />
                        ) : (
                            <ul className="space-y-2">
                                {todos.map((todo) => (
                                    <li
                                        key={todo.id}
                                        className="flex items-center gap-3 rounded-lg bg-background p-3 ring-1 ring-border"
                                    >
                                        <Checkbox
                                            checked={todo.completed}
                                            disabled={busy}
                                            aria-label={`Mark "${todo.title}" as ${todo.completed ? 'open' : 'done'}`}
                                            onCheckedChange={(checked) =>
                                                updateTodo.mutate({
                                                    id: todo.id,
                                                    data: { completed: checked === true },
                                                })
                                            }
                                        />
                                        <span
                                            className={`flex-1 text-sm ${todo.completed ? 'text-muted-foreground line-through' : ''}`}
                                        >
                                            {todo.title}
                                        </span>
                                        <Button
                                            onClick={() => deleteTodo.mutate(todo.id)}
                                            disabled={busy}
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-destructive"
                                        >
                                            Delete
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">What the hooks give you</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        <li>Caching: data is cached and shared across components</li>
                        <li>Background refetching: data stays fresh on its own</li>
                        <li>Loading and error states: no state management of your own</li>
                        <li>Cache updates: a create, update or delete refreshes the list</li>
                        <li>Request deduplication: components asking for the same list share one request</li>
                        <li>DevTools: inspect queries and the cache in the floating panel</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
