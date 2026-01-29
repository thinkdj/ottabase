import { createModelHooks, useApiMutation } from "@ottabase/ottaorm/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@ottabase/ui-shadcn";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

// ============================================================
// App-specific model types (defined per-app)
// ============================================================

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  authorId: string;
}

// ============================================================
// Create query hooks for this app's models
// Uses /api/ottaorm/{entityName} automatically via generic CRUD handler
// ============================================================

const userHooks = createModelHooks<User>({ entityName: "users" });
const postHooks = createModelHooks<Post>({ entityName: "posts" });

// ============================================================
// Component
// ============================================================

export function OttaORMDemoPage() {
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // TanStack Query hooks - automatic caching, loading states, and refetching
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
  } = userHooks.useList();

  const {
    data: posts = [],
    isLoading: postsLoading,
    error: postsError,
  } = postHooks.useList();

  // Database initialization mutation
  const initDb = useApiMutation<{ success: boolean }>({
    endpoint: "/api/ottaorm/init",
    method: "POST",
    invalidateKeys: [["users"], ["posts"]],
  });

  // User mutations with automatic cache invalidation
  const createUser = userHooks.useCreate();
  const deleteUser = userHooks.useDelete();

  // Post mutations with automatic cache invalidation
  const createPost = postHooks.useCreate();
  const deletePost = postHooks.useDelete();

  // Combined loading/error states
  const error =
    usersError?.message || postsError?.message || initDb.error?.message;

  // Check if DB is initialized (has any data or init succeeded)
  const dbReady = initDb.isSuccess || users.length > 0 || posts.length > 0;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    await createUser.mutateAsync({
      name: newUserName,
      email: newUserEmail,
    });
    setNewUserName("");
    setNewUserEmail("");
  };

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !selectedUserId) return;

    await createPost.mutateAsync({
      title: newPostTitle,
      authorId: selectedUserId,
      content: "Sample post content",
    });
    setNewPostTitle("");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12">
      <Button asChild variant="ghost" className="w-fit">
        <Link to="/demo">← Back to Demos</Link>
      </Button>

      <div>
        <h1 className="mb-2 text-3xl font-semibold">OttaORM Demo</h1>
        <p className="text-muted-foreground">
          Class-based Drizzle models with TanStack Query - automatic caching,
          loading states, and optimistic updates
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {!dbReady && !error ? (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Database not initialized. Click below to set up tables.
          </p>
          <Button
            onClick={() => {
              const searchParams = new URLSearchParams(window.location.search);
              const secret = searchParams.get("secret");
              initDb.mutate(secret ? { secret } : {});
            }}
            disabled={initDb.isPending}
          >
            {initDb.isPending ? "Initializing..." : "Initialize Database"}
          </Button>
        </div>
      ) : null}

      {dbReady ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Users
                {usersLoading && (
                  <span className="text-xs font-normal text-muted-foreground">
                    Loading...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddUser} className="space-y-2">
                <Input
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Name..."
                  disabled={createUser.isPending}
                />
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Email..."
                  disabled={createUser.isPending}
                />
                <Button
                  type="submit"
                  disabled={
                    createUser.isPending ||
                    !newUserName.trim() ||
                    !newUserEmail.trim()
                  }
                  className="w-full"
                >
                  {createUser.isPending ? "Adding..." : "Add User"}
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
                  users.map((user, index) => (
                    <div
                      key={user.id || `user-${index}`}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {user.name || "(No name)"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {user.email || "(No email)"}
                          </p>
                        </div>
                        <Button
                          onClick={() => deleteUser.mutate(user.id)}
                          disabled={deleteUser.isPending}
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
              <CardTitle className="flex items-center justify-between text-base">
                Posts
                {postsLoading && (
                  <span className="text-xs font-normal text-muted-foreground">
                    Loading...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddPost} className="space-y-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={createPost.isPending || users.length === 0}
                  aria-label="Select post author"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {[
                    <option key="_placeholder" value="">
                      Select author...
                    </option>,
                    ...users.map((user, index) => (
                      <option key={user.id || `opt-${index}`} value={user.id}>
                        {user.name ||
                          user.email ||
                          (user.id
                            ? `User ${user.id.substring(0, 8)}`
                            : "Unknown User")}
                      </option>
                    )),
                  ]}
                </select>
                <Input
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="Post title..."
                  disabled={createPost.isPending}
                />
                <Button
                  type="submit"
                  disabled={
                    createPost.isPending ||
                    !newPostTitle.trim() ||
                    !selectedUserId
                  }
                  className="w-full"
                >
                  {createPost.isPending ? "Adding..." : "Add Post"}
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
                  posts.map((post, index) => (
                    <div
                      key={post.id || `post-${index}`}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{post.title}</p>
                          <p className="text-sm text-muted-foreground">
                            By:{" "}
                            {users.find((u) => u.id === post.authorId)?.name ||
                              "Unknown"}
                          </p>
                        </div>
                        <Button
                          onClick={() => deletePost.mutate(post.id)}
                          disabled={deletePost.isPending}
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

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">TanStack Query Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              Automatic caching - data is cached and reused across components
            </li>
            <li>Background refetching - data stays fresh automatically</li>
            <li>Loading states - no manual loading state management</li>
            <li>Error handling - built-in error boundaries support</li>
            <li>Optimistic updates - instant UI feedback (configurable)</li>
            <li>
              Request deduplication - multiple components share the same request
            </li>
            <li>
              DevTools - inspect queries and cache in the floating panel
              (bottom-left)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
