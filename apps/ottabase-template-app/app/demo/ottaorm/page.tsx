'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface User {
    id: string;
    name: string;
    email: string;
    createdAt: string;
}

interface Post {
    id: string;
    title: string;
    content: string;
    published: boolean;
    authorId: string;
    createdAt: string;
}

export default function OttaORMDemoPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newPostTitle, setNewPostTitle] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dbReady, setDbReady] = useState(false);

    // Initialize database on mount
    useEffect(() => {
        initializeDb();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initializeDb = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/ottaorm/init', {
                method: 'POST',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to initialize database');
            }

            setDbReady(true);
            loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);

            // Load users
            const usersResponse = await fetch('/api/ottaorm/users');
            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                setUsers(usersData.users);
            }

            // Load posts
            const postsResponse = await fetch('/api/ottaorm/posts');
            if (postsResponse.ok) {
                const postsData = await postsResponse.json();
                setPosts(postsData.posts);
            }

            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserName.trim() || !newUserEmail.trim()) return;

        try {
            setLoading(true);
            const response = await fetch('/api/ottaorm/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newUserName, email: newUserEmail }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add user');
            }

            setNewUserName('');
            setNewUserEmail('');
            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const addPost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostTitle.trim() || !selectedUserId) return;

        try {
            setLoading(true);
            const response = await fetch('/api/ottaorm/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newPostTitle,
                    authorId: selectedUserId,
                    content: 'Sample post content',
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add post');
            }

            setNewPostTitle('');
            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (id: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/ottaorm/users/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete user');
            }

            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const deletePost = async (id: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/ottaorm/posts/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete post');
            }

            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FBFBFA] p-8">
            <div className="mx-auto max-w-4xl">
                <Link href="/demo" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-8">
                    ← Back to Demos
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 text-3xl font-semibold text-gray-900">OttaORM Demo</h1>
                    <p className="text-gray-600">
                        Class-based Drizzle ORM with relationships, fat models, and D1 support
                    </p>
                </div>

                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="mb-2 text-sm font-medium text-blue-900">🚀 OttaORM Features</h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                        <li>
                            <strong>Class-based models</strong> - BaseModel with common methods (find, create, update,
                            paginate)
                        </li>
                        <li>
                            <strong>Relationships</strong> - hasMany, belongsTo, hasOne, belongsToMany
                        </li>
                        <li>
                            <strong>Fat models</strong> - All metadata in one place (schema, validations, relationships)
                        </li>
                        <li>
                            <strong>Drizzle ORM</strong> - First-class D1 support with excellent TypeScript types
                        </li>
                        <li>
                            <strong>Self-contained</strong> - Each model file has everything it needs
                        </li>
                    </ul>
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Users Section */}
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Users</h2>

                            <form onSubmit={addUser} className="mb-6 space-y-2">
                                <input
                                    type="text"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    placeholder="Name..."
                                    disabled={loading}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                />
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    placeholder="Email..."
                                    disabled={loading}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !newUserName.trim() || !newUserEmail.trim()}
                                    className="w-full rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                                >
                                    Add User
                                </button>
                            </form>

                            <div className="space-y-2">
                                {users.length === 0 ? (
                                    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                                        <p className="text-sm text-gray-500">No users yet. Add one above!</p>
                                    </div>
                                ) : (
                                    users.map((user) => (
                                        <div key={user.id} className="rounded-lg border border-gray-200 bg-white p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium text-gray-900">{user.name}</p>
                                                    <p className="text-sm text-gray-600">{user.email}</p>
                                                </div>
                                                <button
                                                    onClick={() => deleteUser(user.id)}
                                                    disabled={loading}
                                                    className="text-sm text-red-600 hover:text-red-700 disabled:text-red-400"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Posts Section */}
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Posts</h2>

                            <form onSubmit={addPost} className="mb-6 space-y-2">
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    disabled={loading || users.length === 0}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                >
                                    <option value="">Select author...</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={newPostTitle}
                                    onChange={(e) => setNewPostTitle(e.target.value)}
                                    placeholder="Post title..."
                                    disabled={loading}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-400 focus:outline-none disabled:bg-gray-100"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !newPostTitle.trim() || !selectedUserId}
                                    className="w-full rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                                >
                                    Add Post
                                </button>
                            </form>

                            <div className="space-y-2">
                                {posts.length === 0 ? (
                                    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                                        <p className="text-sm text-gray-500">
                                            No posts yet. Create users first, then add posts!
                                        </p>
                                    </div>
                                ) : (
                                    posts.map((post) => (
                                        <div key={post.id} className="rounded-lg border border-gray-200 bg-white p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium text-gray-900">{post.title}</p>
                                                    <p className="text-sm text-gray-600">
                                                        By:{' '}
                                                        {users.find((u) => u.id === post.authorId)?.name || 'Unknown'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => deletePost(post.id)}
                                                    disabled={loading}
                                                    className="text-sm text-red-600 hover:text-red-700 disabled:text-red-400"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-3 text-sm font-medium text-gray-900">Implementation Notes</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li>
                            ✅ Uses <strong>OttaORM</strong> - class-based Drizzle models
                        </li>
                        <li>✅ BaseModel provides: find, findOrFail, first, all, create, update, paginate</li>
                        <li>✅ Relationships: User hasMany Posts, Post belongsTo User</li>
                        <li>✅ Fat models with all metadata in one place</li>
                        <li>✅ D1-optimized with driver abstraction layer</li>
                        <li>✅ Self-contained models - each file has schema, validations, relationships</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
