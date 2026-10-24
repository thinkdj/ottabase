import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { useState } from 'react';
import type { OttaSelectItem } from './items';
import { OttaSelect } from './OttaSelect';
import { OttaTagsInput } from './OttaTagsInput';

const TOPICS = [
    { id: 'edge', name: 'Edge' },
    { id: 'workers', name: 'Workers' },
    { id: 'd1', name: 'D1' },
    { id: 'r2', name: 'R2' },
    { id: 'queues', name: 'Queues' },
    { id: 'durable-objects', name: 'Durable Objects' },
    { id: 'typescript', name: 'TypeScript' },
    { id: 'tailwind', name: 'Tailwind' },
    { id: 'auth', name: 'Auth' },
    { id: 'rbac', name: 'RBAC' },
];

const meta: Meta<typeof OttaTagsInput> = {
    title: 'OttaTagsInput',
    component: OttaTagsInput,
    parameters: { layout: 'centered' },
    decorators: [
        (Story) => (
            <div className="w-[420px] min-h-[340px]">
                <Story />
            </div>
        ),
    ],
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof OttaTagsInput>;

const Label = ({ htmlFor, children }: { htmlFor: string; children: string }) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {children}
    </label>
);

/** Pick from suggestions or type a new tag; Enter or a comma adds it, Backspace twice removes the last. */
export const Default: Story = {
    render: function Render() {
        const [tags, setTags] = useState<OttaSelectItem[]>([TOPICS[0], TOPICS[1]]);
        return (
            <div>
                <Label htmlFor="topics">Topics</Label>
                <OttaTagsInput id="topics" items={TOPICS} value={tags} onChange={setTags} />
                <p className="mt-1.5 text-xs text-muted-foreground">Paste a list to add several at once.</p>
            </div>
        );
    },
};

/** onCreate can save the tag first (here a fake 600ms POST) and refuse what it should not keep. */
export const AsyncCreate: Story = {
    render: function Render() {
        const [tags, setTags] = useState<OttaSelectItem[]>([]);
        return (
            <div>
                <Label htmlFor="labels">Labels</Label>
                <OttaTagsInput
                    id="labels"
                    items={TOPICS}
                    value={tags}
                    onChange={setTags}
                    placeholder="Add a label… (try “spam”)"
                    onCreate={(label) =>
                        new Promise((resolve) =>
                            setTimeout(
                                () =>
                                    resolve(
                                        label.toLowerCase() === 'spam'
                                            ? null
                                            : { id: `new-${label.toLowerCase()}`, name: label },
                                    ),
                                600,
                            ),
                        )
                    }
                />
            </div>
        );
    },
};

/** creatable={false}: only the suggestions can become tags. */
export const SuggestionsOnly: Story = {
    render: () => (
        <div>
            <Label htmlFor="stack">Stack</Label>
            <OttaTagsInput id="stack" items={TOPICS} creatable={false} placeholder="Choose from the list…" />
        </div>
    ),
};

export const MaxTags: Story = {
    render: () => (
        <div>
            <Label htmlFor="max">Up to three</Label>
            <OttaTagsInput id="max" items={TOPICS} maxTags={3} defaultValue={[TOPICS[2]]} />
        </div>
    ),
};

export const Invalid: Story = {
    render: () => (
        <div>
            <Label htmlFor="invalid">Topics</Label>
            <OttaTagsInput id="invalid" items={TOPICS} aria-invalid aria-describedby="invalid-error" />
            <p id="invalid-error" className="mt-1.5 text-xs text-destructive-text">
                Add at least one topic.
            </p>
        </div>
    ),
};

export const Disabled: Story = {
    render: () => (
        <div>
            <Label htmlFor="disabled">Topics</Label>
            <OttaTagsInput id="disabled" disabled defaultValue={[TOPICS[0], TOPICS[3]]} />
        </div>
    ),
};

/** The same "Create" row on OttaSelect's multi-select, via onCreate. */
export const SelectWithCreate: Story = {
    render: function Render() {
        const [items, setItems] = useState(TOPICS);
        const [value, setValue] = useState<OttaSelectItem | OttaSelectItem[] | null>([TOPICS[4]]);
        return (
            <OttaSelect
                mode="multiple"
                items={items}
                value={value}
                onChange={setValue}
                placeholder="Topics"
                onCreate={(label) => {
                    const item = { id: `new-${label.toLowerCase()}`, name: label };
                    setItems((current) => [...current, item]);
                    return item;
                }}
            />
        );
    },
};
