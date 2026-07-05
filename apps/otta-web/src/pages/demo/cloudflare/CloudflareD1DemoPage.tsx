import { api, isApiError } from '@/lib/api';
import { ConfirmDialog } from '@ottabase/ui-components';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { useEffect, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

interface Todo {
    id: string;
    title: string;
    completed: boolean;
    created_at?: string;
    createdAt?: string;
}

export function CloudflareD1DemoPage() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTodo, setNewTodo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dbReady, setDbReady] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<Todo | null>(null);

    useEffect(() => {
        void initializeDb();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initializeDb = async () => {
        try {
            setLoading(true);
            await api('/api/cloudflare/d1/init', { method: 'POST' });
            setDbReady(true);
            await loadTodos();
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const loadTodos = async () => {
        try {
            setLoading(true);
            const data = await api<{ todos: Todo[] }>('/api/cloudflare/d1/todos');
            const list = Array.isArray(data.todos) ? data.todos : [];
            setTodos(list.filter((t): t is Todo => t != null && typeof t === 'object' && 'id' in t));
            setError(null);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const addTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodo.trim()) return;

        try {
            setLoading(true);
            await api('/api/cloudflare/d1/todos', {
                method: 'POST',
                body: { title: newTodo },
            });
            setNewTodo('');
            await loadTodos();
            setError(null);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const toggleTodo = async (id: string, completed: boolean) => {
        try {
            setLoading(true);
            await api(`/api/cloudflare/d1/todos/${id}`, {
                method: 'PATCH',
                body: { completed: !completed },
            });
            await loadTodos();
            setError(null);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const deleteTodo = async (id: string) => {
        try {
            setLoading(true);
            await api(`/api/cloudflare/d1/todos/${id}`, { method: 'DELETE' });
            await loadTodos();
            setError(null);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;
        await deleteTodo(deleteDialog.id);
        setDeleteDialog(null);
    };

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="D1 Database"
                description="Full CRUD operations with Cloudflare D1 SQLite database"
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare"
            />

            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {!dbReady && !error ? (
                <div className="rounded-xl bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Initializing database...</p>
                </div>
            ) : null}

            {dbReady ? (
                <>
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Add Todo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={addTodo} className="flex gap-2">
                                <Input
                                    value={newTodo}
                                    onChange={(e) => setNewTodo(e.target.value)}
                                    placeholder="Add a new todo..."
                                    disabled={loading}
                                    className="flex-1"
                                />
                                <Button type="submit" disabled={loading || !newTodo.trim()}>
                                    Add
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="space-y-2">
                        {todos.length === 0 ? (
                            <div className="rounded-xl bg-muted/40 p-8 text-center">
                                <p className="text-sm text-muted-foreground">No todos yet. Add one above!</p>
                            </div>
                        ) : (
                            todos.map((todo) => (
                                <div
                                    key={todo.id}
                                    className="flex items-center gap-3 rounded-lg bg-muted/40 p-4 transition-colors duration-normal hover:bg-muted/70"
                                >
                                    <input
                                        type="checkbox"
                                        checked={todo.completed}
                                        onChange={() => toggleTodo(todo.id, todo.completed)}
                                        disabled={loading}
                                        aria-label={`Mark todo ${todo.title} as ${todo.completed ? 'incomplete' : 'complete'}`}
                                        className="h-4 w-4 cursor-pointer"
                                    />
                                    <span
                                        className={`flex-1 text-sm ${
                                            todo.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                                        }`}
                                    >
                                        {todo.title}
                                    </span>
                                    <Button
                                        onClick={() => setDeleteDialog(todo)}
                                        disabled={loading}
                                        variant="ghost"
                                        size="sm"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>

                    <ConfirmDialog
                        open={deleteDialog !== null}
                        onOpenChange={(open) => !open && setDeleteDialog(null)}
                        title="Delete Todo?"
                        description={`Are you sure you want to delete "${deleteDialog?.title}"? This cannot be undone.`}
                        tone="destructive"
                        secondaryActionText="Cancel"
                        primaryActionText="Delete"
                        onConfirm={handleConfirmDelete}
                        confirmProps={{ disabled: loading }}
                        cancelProps={{ disabled: loading }}
                    />
                </>
            ) : null}
        </div>
    );
}
