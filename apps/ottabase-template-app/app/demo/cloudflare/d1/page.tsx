'use client';

import { useState, useEffect } from 'react';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  created_at: string;
}

export default function D1DemoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    initializeDb();
  }, []);

  const initializeDb = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cloudflare/d1/init', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initialize database');
      }

      setDbReady(true);
      loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadTodos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cloudflare/d1/todos');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load todos');
      }

      const data = await response.json();
      setTodos(data.todos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    try {
      setLoading(true);
      const response = await fetch('/api/cloudflare/d1/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add todo');
      }

      setNewTodo('');
      await loadTodos();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleTodo = async (id: number, completed: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cloudflare/d1/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update todo');
      }

      await loadTodos();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const deleteTodo = async (id: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cloudflare/d1/todos/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete todo');
      }

      await loadTodos();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            D1 Database Demo
          </h1>
          <p className="text-gray-600">
            Full CRUD operations with Cloudflare D1 SQLite database
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!dbReady && !error && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-700">Initializing database...</p>
          </div>
        )}

        {dbReady && (
          <>
            <form onSubmit={addTodo} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  placeholder="Add a new todo..."
                  disabled={loading}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                />
                <button
                  type="submit"
                  disabled={loading || !newTodo.trim()}
                  className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                >
                  Add
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {todos.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">
                    No todos yet. Add one above!
                  </p>
                </div>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id, todo.completed)}
                      disabled={loading}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        todo.completed
                          ? 'text-gray-400 line-through'
                          : 'text-gray-900'
                      }`}
                    >
                      {todo.title}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      disabled={loading}
                      className="text-sm text-red-600 hover:text-red-700 disabled:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Implementation Notes
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Uses @ottabase/cf D1 wrapper for type-safe queries</li>
            <li>• Auto-creates table if not exists on initialization</li>
            <li>• Full CRUD: Create, Read, Update, Delete operations</li>
            <li>• Error handling with user-friendly messages</li>
            <li>
              • Works locally with wrangler (no Cloudflare account needed)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
