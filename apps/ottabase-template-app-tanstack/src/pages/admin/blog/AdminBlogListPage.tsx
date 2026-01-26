/**
 * Admin Blog List Page
 *
 * Lists all blog posts with filtering, status management, and CRUD operations.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { createModelHooks } from "@ottabase/ottaorm/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@ottabase/ui-shadcn";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Star,
  StarOff,
  FileText,
  Clock,
  Filter,
} from "lucide-react";
import { CONTENT_TYPES, POST_STATUSES, type ContentType, type PostStatus } from "@ottabase/ottablog";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentType: ContentType;
  status: PostStatus;
  authorName: string | null;
  isFeatured: boolean;
  viewCount: number;
  readingTimeMinutes: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const blogPostHooks = createModelHooks<BlogPost>({ entityName: "posts" });

export function AdminBlogListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | "all">("all");

  const {
    data: posts = [],
    isLoading,
    error,
  } = blogPostHooks.useList();

  const deletePost = blogPostHooks.useDelete();

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.slug.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesType = contentTypeFilter === "all" || post.contentType === contentTypeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await deletePost.mutateAsync(id);
      } catch (err) {
        console.error("Failed to delete blog post:", err);
        window.alert(`Failed to delete "${title}". Please try again.`);
      }
    }
  };

  const getStatusBadge = (status: PostStatus) => {
    const variants: Record<PostStatus, "default" | "secondary" | "destructive" | "outline"> = {
      published: "default",
      draft: "secondary",
      scheduled: "outline",
      archived: "destructive",
    };
    return (
      <Badge variant={variants[status]}>
        {POST_STATUSES[status].label}
      </Badge>
    );
  };

  const getContentTypeBadge = (contentType: ContentType) => {
    return (
      <Badge variant="outline" className="text-xs">
        {CONTENT_TYPES[contentType].label}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog Posts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your blog posts, changelogs, and documentation.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/blog/new">
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PostStatus | "all")}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                {Object.entries(POST_STATUSES).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Content Type Filter */}
            <select
              value={contentTypeFilter}
              onChange={(e) => setContentTypeFilter(e.target.value as ContentType | "all")}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Posts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Posts</span>
            {isLoading && (
              <span className="text-sm font-normal text-muted-foreground">
                Loading...
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No posts found</h3>
              <p className="mt-2 text-muted-foreground">
                {posts.length === 0
                  ? "Get started by creating your first post."
                  : "Try adjusting your search or filters."}
              </p>
              {posts.length === 0 && (
                <Button asChild className="mt-4">
                  <Link to="/admin/blog/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Post
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {post.isFeatured && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                      <Link
                        to="/admin/blog/$postId/edit"
                        params={{ postId: post.id }}
                        className="font-semibold hover:underline"
                      >
                        {post.title}
                      </Link>
                      {getStatusBadge(post.status)}
                      {getContentTypeBadge(post.contentType)}
                    </div>

                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readingTimeMinutes
                          ? `${post.readingTimeMinutes} min read`
                          : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.viewCount} views
                      </span>
                      {post.authorName && (
                        <span>by {post.authorName}</span>
                      )}
                      <span>
                        {post.status === "published"
                          ? `Published ${formatDate(post.publishedAt)}`
                          : `Updated ${formatDate(post.updatedAt)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link
                        to="/admin/blog/$postId/edit"
                        params={{ postId: post.id }}
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(post.id, post.title)}
                      disabled={deletePost.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
