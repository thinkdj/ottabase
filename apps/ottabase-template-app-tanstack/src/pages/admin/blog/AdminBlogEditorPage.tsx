/**
 * Admin Blog Editor Page
 *
 * Full-featured blog post editor with OttaEditor integration,
 * hero image upload, SEO settings, and all post fields.
 */
import {
  CONTENT_TYPES,
  POST_STATUSES,
  generateSlug,
  type ContentType,
  type HeroImage,
  type PostStatus,
  type SeoMeta,
} from "@ottabase/ottablog";
import {
  AdvancedImageTool,
  useOttaEditor,
  type BlockToolConstructable,
  type OutputData,
  type ToolSettings,
} from "@ottabase/ottaeditor";
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
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@ottabase/ui-shadcn";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Loader2,
  Save,
  Search,
  Send,
  Settings,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: OutputData | null;
  contentType: ContentType;
  status: PostStatus;
  categoryId: string | null;
  heroImage: HeroImage | null;
  seoMeta: SeoMeta | null;
  privateNotes: OutputData | null;
  footnotes: OutputData | null;
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  isFeatured: boolean;
  allowComments: boolean;
  publishedAt: string | null;
  appId: string | null;
}

const blogPostHooks = createModelHooks<BlogPost>({ entityName: "blog_posts" });

// Editor configuration with image upload
const getEditorConfig = (placeholder: string) => ({
  defaultPlugins: "all" as const,
  placeholder,
  minHeight: 200,
  additionalPlugins: [
    {
      name: "image",
      tool: AdvancedImageTool as unknown as BlockToolConstructable,
      config: {
        provider: "r2",
        uploadEndpoint: "/api/upload",
      } as ToolSettings,
    },
  ],
});

// Wrapper component that handles data loading
export function AdminBlogEditorPage() {
  const params = useParams({ strict: false });
  const postId = (params as { postId?: string }).postId;
  const isEditMode = Boolean(postId);

  // Fetch data in the wrapper
  const { data: existingPost, isLoading: isLoadingPost } =
    blogPostHooks.useDetail(postId || "");

  // Show loading state until data is ready (for edit mode)
  if (isEditMode && (isLoadingPost || !existingPost)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Render the form only when data is ready
  return (
    <BlogEditorForm
      postId={postId}
      isEditMode={isEditMode}
      initialData={existingPost ?? undefined}
    />
  );
}

// Inner component that uses the editor hook - only mounted when data is ready
interface BlogEditorFormProps {
  postId?: string;
  isEditMode: boolean;
  initialData?: BlogPost;
}

function BlogEditorForm({
  postId,
  isEditMode,
  initialData,
}: BlogEditorFormProps) {
  const navigate = useNavigate();

  // Form state - initialized from props
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || "");
  const [contentType, setContentType] = useState<ContentType>(
    initialData?.contentType || "blog",
  );
  const [status, setStatus] = useState<PostStatus>(
    initialData?.status || "draft",
  );
  const [authorName, setAuthorName] = useState(initialData?.authorName || "");
  const [isFeatured, setIsFeatured] = useState(
    initialData?.isFeatured || false,
  );
  const [allowComments, setAllowComments] = useState(
    initialData?.allowComments ?? true,
  );
  const [publishedAt, setPublishedAt] = useState(
    initialData?.publishedAt
      ? new Date(initialData.publishedAt).toISOString().slice(0, 16)
      : "",
  );

  // Hero image state
  const [heroImage, setHeroImage] = useState<HeroImage | null>(
    initialData?.heroImage || null,
  );
  const [isUploadingHero, setIsUploadingHero] = useState(false);

  // SEO state - initialized from props
  const [seoTitle, setSeoTitle] = useState(initialData?.seoMeta?.title || "");
  const [seoDescription, setSeoDescription] = useState(
    initialData?.seoMeta?.description || "",
  );
  const [seoKeywords, setSeoKeywords] = useState(
    initialData?.seoMeta?.keywords?.join(", ") || "",
  );
  const [seoNoIndex, setSeoNoIndex] = useState(
    initialData?.seoMeta?.noIndex || false,
  );

  // API hooks
  const createPost = blogPostHooks.useCreate();
  const updatePost = blogPostHooks.useUpdate();

  const isSaving = createPost.isPending || updatePost.isPending;

  // Active tab
  const [activeTab, setActiveTab] = useState("content");

  // Content editors - initialData is guaranteed to be available in edit mode
  const mainEditor = useOttaEditor({
    ...getEditorConfig("Start writing your post..."),
    data: initialData?.content ?? undefined,
  });

  const notesEditor = useOttaEditor({
    ...getEditorConfig("Private notes (not shown publicly)..."),
    data: initialData?.privateNotes ?? undefined,
  });

  const footnotesEditor = useOttaEditor({
    ...getEditorConfig("Add footnotes and references..."),
    data: initialData?.footnotes ?? undefined,
  });

  // Auto-generate slug from title
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isEditMode || !slug) {
      setSlug(generateSlug(newTitle));
    }
  };

  // Handle hero image upload
  const handleHeroImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHero(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = (await response.json()) as {
        url?: string;
        cfImageId?: string;
      };
      if (data.url) {
        setHeroImage({
          url: data.url,
          alt: heroImage?.alt || file.name,
          cfImageId: data.cfImageId,
        });
      }
    } catch (error) {
      console.error("Hero image upload failed:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingHero(false);
    }
  };

  // Update hero image URL
  const handleHeroUrlChange = (url: string) => {
    setHeroImage(url ? { url, alt: heroImage?.alt || "" } : null);
  };

  // Update hero image alt
  const handleHeroAltChange = (alt: string) => {
    if (heroImage) {
      setHeroImage({ ...heroImage, alt });
    }
  };

  // Save post
  const handleSave = async (publishNow = false) => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    try {
      // Get editor content
      const content = await mainEditor.save();
      const privateNotes = await notesEditor.save();
      const footnotes = await footnotesEditor.save();

      // Build SEO meta
      const seoMeta: SeoMeta = {
        title: seoTitle || undefined,
        description: seoDescription || undefined,
        keywords: seoKeywords
          ? seoKeywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : undefined,
        noIndex: seoNoIndex,
        ogType: "article",
        twitterCard: "summary_large_image",
      };

      const postData: Partial<BlogPost> = {
        title,
        slug: slug || generateSlug(title),
        excerpt: excerpt || undefined,
        content: content || undefined,
        contentType,
        status: publishNow ? "published" : status,
        heroImage: heroImage || undefined,
        seoMeta,
        privateNotes: privateNotes || undefined,
        footnotes: footnotes || undefined,
        authorName: authorName || undefined,
        isFeatured,
        allowComments,
        publishedAt:
          publishNow && !publishedAt
            ? new Date().toISOString()
            : publishedAt || undefined,
      };

      if (isEditMode && postId) {
        await updatePost.mutateAsync({ id: postId, data: postData });
      } else {
        await createPost.mutateAsync(postData);
      }

      navigate({ to: "/admin/blog" });
    } catch (error) {
      console.error("Failed to save post:", error);
      alert("Failed to save post. Please try again.");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/blog">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditMode ? "Edit Post" : "New Post"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? "Update your blog post" : "Create a new blog post"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={status === "published" ? "default" : "secondary"}>
            {POST_STATUSES[status].label}
          </Badge>
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Publish
          </Button>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Slug */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter post title..."
                  className="text-lg font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-friendly-slug"
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="content" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                Notes
              </TabsTrigger>
              <TabsTrigger
                value="footnotes"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Footnotes
              </TabsTrigger>
              <TabsTrigger value="seo" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                SEO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Main Content</CardTitle>
                  <CardDescription>
                    Write your post content using the rich text editor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    ref={mainEditor.editorRef}
                    className="min-h-[400px] prose prose-slate dark:prose-invert max-w-none rounded-lg border p-4"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Private Notes</CardTitle>
                  <CardDescription>
                    Personal notes for the author (not shown publicly)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    ref={notesEditor.editorRef}
                    className="min-h-[300px] prose prose-slate dark:prose-invert max-w-none rounded-lg border p-4 bg-yellow-50/50 dark:bg-yellow-900/10"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="footnotes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Footnotes & References</CardTitle>
                  <CardDescription>
                    Add footnotes, citations, and references (shown at the end
                    of the post)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    ref={footnotesEditor.editorRef}
                    className="min-h-[200px] prose prose-slate dark:prose-invert max-w-none rounded-lg border p-4"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Settings</CardTitle>
                  <CardDescription>
                    Optimize your post for search engines
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seoTitle">SEO Title</Label>
                    <Input
                      id="seoTitle"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      placeholder={title || "Defaults to post title"}
                    />
                    <p className="text-xs text-muted-foreground">
                      {seoTitle.length}/60 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seoDescription">Meta Description</Label>
                    <Textarea
                      id="seoDescription"
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      placeholder="Brief description for search results..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      {seoDescription.length}/160 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seoKeywords">Keywords</Label>
                    <Input
                      id="seoKeywords"
                      value={seoKeywords}
                      onChange={(e) => setSeoKeywords(e.target.value)}
                      placeholder="keyword1, keyword2, keyword3"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="seoNoIndex"
                      checked={seoNoIndex}
                      onChange={(e) => setSeoNoIndex(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="seoNoIndex">
                      Hide from search engines (noindex)
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Excerpt */}
          <Card>
            <CardHeader>
              <CardTitle>Excerpt</CardTitle>
              <CardDescription>
                Short summary shown in listings (auto-generated if empty)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Brief summary of the post..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings */}
        <div className="space-y-6">
          {/* Hero Image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Hero Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {heroImage?.url ? (
                <div className="relative">
                  <img
                    src={heroImage.url}
                    alt={heroImage.alt || "Hero image"}
                    className="w-full rounded-lg object-cover aspect-video"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setHeroImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No hero image set
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Upload Image</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleHeroImageUpload}
                  disabled={isUploadingHero}
                />
                {isUploadingHero && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Or paste URL</Label>
                <Input
                  value={heroImage?.url || ""}
                  onChange={(e) => handleHeroUrlChange(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Alt Text</Label>
                <Input
                  value={heroImage?.alt || ""}
                  onChange={(e) => handleHeroAltChange(e.target.value)}
                  placeholder="Describe the image..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Post Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Content Type</Label>
                <select
                  value={contentType}
                  onChange={(e) =>
                    setContentType(e.target.value as ContentType)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PostStatus)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(POST_STATUSES).map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Author Name</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Author name..."
                />
              </div>

              <div className="space-y-2">
                <Label>Publish Date</Label>
                <Input
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="isFeatured">Featured Post</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowComments"
                    checked={allowComments}
                    onChange={(e) => setAllowComments(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="allowComments">Allow Comments</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          {isEditMode && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this post?",
                      )
                    ) {
                      // Delete and navigate away
                      navigate({ to: "/admin/blog" });
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Post
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
