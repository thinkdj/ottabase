import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
} from "@ottabase/ui-shadcn";

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

export function OttaORMDemoPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newPostTitle, setNewPostTitle] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dbReady, setDbReady] = useState(false);

    useEffect(() => {
        void initializeDb();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initializeDb = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/ottaorm/init", { method: "POST" });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || "Failed to initialize database");
            }

            setDbReady(true);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);

            const usersResponse = await fetch("/api/ottaorm/users");
            if (usersResponse.ok) {
                const usersData = (await usersResponse.json()) as { users: User[] };
                setUsers(usersData.users);
            }

            const postsResponse = await fetch("/api/ottaorm/posts");
            if (postsResponse.ok) {
                const postsData = (await postsResponse.json()) as { posts: Post[] };
                setPosts(postsData.posts);
            }

            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserName.trim() || !newUserEmail.trim()) return;

        try {
            setLoading(true);
            const response = await fetch("/api/ottaorm/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newUserName, email: newUserEmail }),
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || "Failed to add user");
            }

            setNewUserName("");
            setNewUserEmail("");
            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const addPost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostTitle.trim() || !selectedUserId) return;

        try {
            setLoading(true);
            const response = await fetch("/api/ottaorm/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newPostTitle,
                    authorId: selectedUserId,
                    content: "Sample post content",
                }),
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || "Failed to add post");
            }

            setNewPostTitle("");
            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (id: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/ottaorm/users/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || "Failed to delete user");
            }

            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const deletePost = async (id: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/ottaorm/posts/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = (await response.json()) as { error?: string };
                throw new Error(data.error || "Failed to delete post");
            }

            await loadData();
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-12">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div>
                <h1 className="mb-2 text-3xl font-semibold">OttaORM Demo</h1>
                <p className="text-muted-foreground">
                    Class-based Drizzle models with relationships and D1 support
                </p>
            </div>

            {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            ) : null}

            {!dbReady && !error ? (
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Initializing database...</p>
                </div>
            ) : null}

            {dbReady ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Users</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={addUser} className="space-y-2">
                                <Input
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    placeholder="Name..."
                                    disabled={loading}
                                />
                                <Input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    placeholder="Email..."
                                    disabled={loading}
                                />
                                <Button
                                    type="submit"
                                    disabled={loading || !newUserName.trim() || !newUserEmail.trim()}
                                    className="w-full"
                                >
                                    Add User
                                </Button>
                            </form>

                            <div className="space-y-2">
                                {users.length === 0 ? (
                                    <div className="rounded-lg border bg-muted/50 p-8 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            No users yet. Add one above!
                                        </p>
                                    </div>
                                ) : (
                                    users.map((user) => (
                                        <div key={user.id} className="rounded-lg border p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-medium">{user.name}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                                <Button
                                                    onClick={() => deleteUser(user.id)}
                                                    disabled={loading}
                                                    variant="destructive"
                                                    size="sm"
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Posts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={addPost} className="space-y-2">
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    disabled={loading || users.length === 0}
                                    aria-label="Select post author"
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="">Select author...</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    value={newPostTitle}
                                    onChange={(e) => setNewPostTitle(e.target.value)}
                                    placeholder="Post title..."
                                    disabled={loading}
                                />
                                <Button
                                    type="submit"
                                    disabled={loading || !newPostTitle.trim() || !selectedUserId}
                                    className="w-full"
                                >
                                    Add Post
                                </Button>
                            </form>

                            <div className="space-y-2">
                                {posts.length === 0 ? (
                                    <div className="rounded-lg border bg-muted/50 p-8 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            No posts yet. Create users first, then add posts!
                                        </p>
                                    </div>
                                ) : (
                                    posts.map((post) => (
                                        <div key={post.id} className="rounded-lg border p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-medium">{post.title}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        By: {users.find((u) => u.id === post.authorId)?.name || "Unknown"}
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() => deletePost(post.id)}
                                                    disabled={loading}
                                                    variant="destructive"
                                                    size="sm"
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : null}
        </div>
    );
}
