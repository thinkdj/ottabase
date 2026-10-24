/**
 * OttaTagsInput, and OttaSelect's "Create" row: pick or create tags, with an async onCreate that
 * can refuse a tag.
 */
import { OttaSelect, OttaTagsInput, type OttaSelectItem } from '@ottabase/ottaselect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui';
import { useState } from 'react';

const TOPICS = [
    { id: 'edge', name: 'Edge' },
    { id: 'workers', name: 'Workers' },
    { id: 'd1', name: 'D1' },
    { id: 'r2', name: 'R2' },
    { id: 'queues', name: 'Queues' },
    { id: 'durable-objects', name: 'Durable Objects' },
    { id: 'typescript', name: 'TypeScript' },
    { id: 'tailwind', name: 'Tailwind' },
];

/** Stands in for a POST that saves the tag; refuses "spam". */
const saveTag = (label: string) =>
    new Promise<OttaSelectItem | null>((resolve) =>
        setTimeout(
            () => resolve(label.toLowerCase() === 'spam' ? null : { id: `tag-${label.toLowerCase()}`, name: label }),
            500,
        ),
    );

export function TagsInputDemoCard() {
    const [tags, setTags] = useState<OttaSelectItem[]>([TOPICS[0], TOPICS[1]]);
    const [labels, setLabels] = useState<OttaSelectItem[]>([]);
    const [options, setOptions] = useState(TOPICS);
    const [picked, setPicked] = useState<OttaSelectItem | OttaSelectItem[] | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">🏷️ Tags and create</CardTitle>
                <CardDescription>
                    <code className="rounded bg-background px-1 ring-1 ring-border">OttaTagsInput</code> picks from
                    suggestions or creates tags (Enter or a comma, a pasted list adds several, Backspace twice removes
                    the last). OttaSelect gets the same &ldquo;Create&rdquo; row through{' '}
                    <code className="rounded bg-background px-1 ring-1 ring-border">onCreate</code>.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="demo-tags" className="text-sm font-medium">
                        Topics
                    </label>
                    <OttaTagsInput id="demo-tags" items={TOPICS} value={tags} onChange={setTags} maxTags={6} />
                    <p className="text-xs text-muted-foreground">Up to six. Suggestions are filtered as you type.</p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="demo-labels" className="text-sm font-medium">
                        Labels (saved by an async onCreate)
                    </label>
                    <OttaTagsInput
                        id="demo-labels"
                        items={TOPICS}
                        value={labels}
                        onChange={setLabels}
                        onCreate={saveTag}
                        placeholder="Add a label… (try “spam”)"
                    />
                    <p className="text-xs text-muted-foreground">A refused label stays in the field to be edited.</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">OttaSelect, multiple, with onCreate</label>
                    <OttaSelect
                        mode="multiple"
                        items={options}
                        value={picked}
                        onChange={setPicked}
                        placeholder="Pick or create topics…"
                        onCreate={(label) => {
                            const item = { id: `topic-${label.toLowerCase()}`, name: label };
                            setOptions((current) => [...current, item]);
                            return item;
                        }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
