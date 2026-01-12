import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from "@ottabase/ui-shadcn";
import { api, isApiError } from "@/lib/api";
import { Plus, ExternalLink, Copy, Trash2, Edit, Link2 } from "lucide-react";
import { ShortlinkForm } from "./components/ShortlinkForm";
import type { Shortlink } from "@ottabase/shortlinks";

interface ShortlinksResponse {
  success: boolean;
  data: Shortlink[];
  total: number;
}

export function ShortlinksPage() {
  const [shortlinks, setShortlinks] = useState<Shortlink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShortlink, setEditingShortlink] = useState<Shortlink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchShortlinks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<ShortlinksResponse>("/api/shortlinks");
      if (data.success && data.data) {
        setShortlinks(data.data);
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load shortlinks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShortlinks();
  }, []);

  const handleCreate = () => {
    setEditingShortlink(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (shortlink: Shortlink) => {
    setEditingShortlink(shortlink);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shortlink?")) return;

    try {
      await api(`/api/shortlinks/${id}`, { method: "DELETE" });
      await fetchShortlinks();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to delete shortlink");
    }
  };

  const handleSuccess = async () => {
    setIsDialogOpen(false);
    setEditingShortlink(null);
    await fetchShortlinks();
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getShortUrl = (shortCode: string) => {
    return `${window.location.origin}/${shortCode}`;
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpired = (expiryDate: string | Date | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link2 className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-semibold tracking-tight">Shortlinks</h1>
          </div>
          <p className="text-muted-foreground">
            Create and manage short URLs for easy sharing
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingShortlink ? "Edit Shortlink" : "Create Shortlink"}
              </DialogTitle>
              <DialogDescription>
                {editingShortlink
                  ? "Update your shortlink details"
                  : "Create a new shortlink to share with others"}
              </DialogDescription>
            </DialogHeader>
            <ShortlinkForm
              shortlink={editingShortlink}
              onSuccess={handleSuccess}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shortlinks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shortlinks.reduce((sum, link) => sum + (link.clicks || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shortlinks.filter((link) => !isExpired(link.expiryDate)).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shortlinks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Links</CardTitle>
          <CardDescription>
            Manage and track your shortlinks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : shortlinks.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <Link2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No shortlinks yet</p>
              <Button onClick={handleCreate} variant="outline" size="sm">
                Create your first link
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Short Code</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortlinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{link.shortCode}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(getShortUrl(link.shortCode), link.id)}
                          >
                            {copiedId === link.id ? (
                              <span className="text-xs text-green-600">✓</span>
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        <a
                          href={link.fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <span className="truncate">{link.fullUrl}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {link.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{link.appName}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {link.clicks || 0}
                      </TableCell>
                      <TableCell>
                        {isExpired(link.expiryDate) ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : link.expiryDate ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDate(link.expiryDate)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(link)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(link.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
