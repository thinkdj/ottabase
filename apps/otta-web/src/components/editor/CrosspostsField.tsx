import { MAX_CROSSPOSTS, type PostCrosspost } from '@ottabase/ottablog';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@ottabase/ui-shadcn';
import { Link2, Plus, X } from 'lucide-react';
import { useId } from 'react';

/**
 * Drop the blank rows the editor leaves behind, and add the scheme people omit when they paste
 * from a share sheet. The server still validates the result; this only removes the two ways an
 * otherwise fine link would come back as an error.
 */
export function cleanCrossposts(items: PostCrosspost[]): PostCrosspost[] {
    return items
        .map((item) => {
            const url = item.url.trim();
            return { ...item, url: !url || /^https?:\/\//i.test(url) ? url : `https://${url}` };
        })
        .filter((item) => item.url);
}

/** Stable comparison for dirty-tracking: the list is small and ordered, so JSON is the exact check. */
export function crosspostsKey(items: PostCrosspost[] | null | undefined): string {
    return JSON.stringify(cleanCrossposts(items ?? []));
}

export interface CrosspostsFieldProps {
    value: PostCrosspost[];
    onChange: (next: PostCrosspost[]) => void;
    /** What this post is, for the description copy — "thought", "article", "journal". */
    noun?: string;
}

/**
 * Where else this post lives.
 *
 * One field for every content type, because the answer is the same shape whether the post is a
 * thought, an article, or a photo journal: a short list of permalinks, at most one of which is
 * where it actually started. The "Original" column is a native radio GROUP — the browser enforces
 * "at most one" for free, and the extra "This post is the original" radio is what makes the
 * unflagged state selectable rather than a thing you can only reach by never clicking.
 */
export function CrosspostsField({ value, onChange, noun = 'post' }: CrosspostsFieldProps) {
    // Scoped so two of these on one page (never today, cheap insurance) cannot merge radio groups.
    const groupName = useId();
    const hasOrigin = value.some((link) => link.origin);

    return (
        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Also posted at
                </CardTitle>
                <CardDescription>
                    Link the same {noun} on Instagram, X, Facebook. Mark one as the original if it started there —
                    otherwise this {noun} is the original and the rest are copies.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {value.map((link, index) => (
                    // Rows are positional and the URL is the field being typed, so the index is the
                    // only stable identity available here.
                    <div key={index} className="flex flex-wrap items-center gap-2">
                        <Input
                            type="url"
                            inputMode="url"
                            value={link.url}
                            onChange={(event) =>
                                onChange(
                                    value.map((item, i) => (i === index ? { ...item, url: event.target.value } : item)),
                                )
                            }
                            onBlur={() => onChange(cleanCrossposts(value))}
                            placeholder="https://instagram.com/p/..."
                            aria-label={`Link ${index + 1}`}
                            className="min-w-[16rem] flex-1 bg-background"
                        />
                        <Label className="flex items-center gap-2 whitespace-nowrap text-sm font-normal text-muted-foreground">
                            <input
                                type="radio"
                                name={groupName}
                                checked={Boolean(link.origin)}
                                onChange={() =>
                                    onChange(
                                        value.map((item, i) =>
                                            i === index ? { ...item, origin: true } : { url: item.url },
                                        ),
                                    )
                                }
                            />
                            Original
                        </Label>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove link ${index + 1}`}
                            onClick={() => onChange(value.filter((_, i) => i !== index))}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <div className="flex flex-wrap items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={value.length >= MAX_CROSSPOSTS}
                        onClick={() => onChange([...value, { url: '' }])}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add link
                    </Button>
                    {hasOrigin && (
                        <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                            <input
                                type="radio"
                                name={groupName}
                                checked={false}
                                onChange={() => onChange(value.map(({ url }) => ({ url })))}
                            />
                            This {noun} is the original
                        </Label>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
