import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ottabase/ui-shadcn";
import { api, isApiError } from "@/lib/api";
import { ShortlinkTypes } from "@ottabase/shortlinks";
import type { Shortlink } from "@ottabase/shortlinks";

interface ShortlinkFormProps {
  shortlink?: Shortlink | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ShortlinkForm({ shortlink, onSuccess, onCancel }: ShortlinkFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullUrl: "",
    shortCode: "",
    type: "redirect",
    appName: "default",
    expiryDate: "",
  });

  useEffect(() => {
    if (shortlink) {
      setFormData({
        fullUrl: shortlink.fullUrl,
        shortCode: shortlink.shortCode,
        type: shortlink.type,
        appName: shortlink.appName,
        expiryDate: shortlink.expiryDate
          ? new Date(shortlink.expiryDate).toISOString().slice(0, 16)
          : "",
      });
    }
  }, [shortlink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        fullUrl: formData.fullUrl.trim(),
        shortCode: formData.shortCode.trim(),
        type: formData.type,
        appName: formData.appName.trim(),
        expiryDate: formData.expiryDate ? formData.expiryDate : null,
      };

      if (shortlink) {
        // Update existing shortlink
        await api(`/api/shortlinks/${shortlink.id}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        // Create new shortlink
        await api("/api/shortlinks", {
          method: "POST",
          body: payload,
        });
      }

      onSuccess();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to save shortlink");
    } finally {
      setLoading(false);
    }
  };

  const generateRandomCode = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setFormData({ ...formData, shortCode: code });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullUrl">
          Destination URL <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fullUrl"
          type="url"
          placeholder="https://example.com/very/long/url"
          value={formData.fullUrl}
          onChange={(e) => setFormData({ ...formData, fullUrl: e.target.value })}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          The full URL where this shortlink will redirect
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shortCode">
          Short Code <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="shortCode"
            placeholder="my-link"
            value={formData.shortCode}
            onChange={(e) => setFormData({ ...formData, shortCode: e.target.value })}
            required
            disabled={loading}
            className="flex-1"
            pattern="[a-zA-Z0-9_\-]+"
            title="Only letters, numbers, hyphens, and underscores"
          />
          <Button
            type="button"
            variant="outline"
            onClick={generateRandomCode}
            disabled={loading}
          >
            Random
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Unique identifier for your link (e.g., "gh" for github)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
            disabled={loading}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ShortlinkTypes).map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appName">App Name</Label>
          <Input
            id="appName"
            placeholder="default"
            value={formData.appName}
            onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
        <Input
          id="expiryDate"
          type="datetime-local"
          value={formData.expiryDate}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty for links that never expire
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : shortlink ? "Update Link" : "Create Link"}
        </Button>
      </div>
    </form>
  );
}
