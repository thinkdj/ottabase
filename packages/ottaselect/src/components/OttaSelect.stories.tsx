import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { OttaSelect, OttaSelectInputItem, OttaSelectItem } from './OttaSelect';

// Sample data - flexible input format with various properties
const sampleItemsWithName: OttaSelectInputItem[] = [
    { id: '1', name: 'Apple', category: 'Fruit', color: 'Red', price: 2.99 },
    { id: '2', name: 'Banana', category: 'Fruit', color: 'Yellow', price: 1.99 },
    { id: '3', name: 'Carrot', category: 'Vegetable', color: 'Orange', price: 0.99 },
    { id: '4', name: 'Durian', category: 'Fruit', color: 'Green', price: 12.99 },
    { id: '5', name: 'Eggplant', category: 'Vegetable', color: 'Purple', price: 3.49 },
];

// Sample data using 'label' property instead of 'name'
const sampleItemsWithLabel: OttaSelectInputItem[] = [
    { id: 'user-1', label: 'John Doe', email: 'john@example.com', role: 'Admin' },
    { id: 'user-2', label: 'Jane Smith', email: 'jane@example.com', role: 'User' },
    { id: 'user-3', label: 'Bob Johnson', email: 'bob@example.com', role: 'User' },
];

// Sample data using 'title' property
const sampleItemsWithTitle: OttaSelectInputItem[] = [
    { id: 'doc-1', title: 'Getting Started', type: 'Tutorial', pages: 12 },
    { id: 'doc-2', title: 'API Reference', type: 'Reference', pages: 45 },
    { id: 'doc-3', title: 'Best Practices', type: 'Guide', pages: 23 },
];

const largeItemsList: OttaSelectInputItem[] = Array.from({ length: 100 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
    index: i + 1,
    category: i % 2 === 0 ? 'Even' : 'Odd',
}));

// Simulated async fetch function - returns flexible format
const mockFetchCollection = async (searchQuery: string): Promise<OttaSelectInputItem[]> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const items: OttaSelectInputItem[] = [
        { id: '1', name: 'React', type: 'Library', language: 'JavaScript', stars: 220000 },
        { id: '2', name: 'Vue', type: 'Framework', language: 'JavaScript', stars: 210000 },
        { id: '3', name: 'Angular', type: 'Framework', language: 'TypeScript', stars: 95000 },
        { id: '4', name: 'Svelte', type: 'Framework', language: 'JavaScript', stars: 75000 },
        { id: '5', name: 'Next.js', type: 'Framework', language: 'React', stars: 120000 },
        { id: '6', name: 'Nuxt.js', type: 'Framework', language: 'Vue', stars: 50000 },
        { id: '7', name: 'Remix', type: 'Framework', language: 'React', stars: 27000 },
        { id: '8', name: 'SolidJS', type: 'Library', language: 'JavaScript', stars: 31000 },
    ];

    if (!searchQuery) return items;

    return items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
};

const meta: Meta<typeof OttaSelect> = {
    title: 'Components/OttaSelect',
    component: OttaSelect,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'A select component that accepts any object with id and name/label/title. Always returns standardized { id, name, data } format where data contains the original object.',
            },
        },
    },
    tags: ['autodocs'],
    decorators: [
        (Story: any) => (
            <div style={{ width: '450px', padding: '20px' }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof OttaSelect>;

// Single Select Stories
export const SingleSelectBasic: Story = {
    name: 'Single Select - Basic',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>(null);

        return (
            <div>
                <OttaSelect
                    mode="single"
                    items={sampleItemsWithName}
                    value={value}
                    onChange={setValue}
                    placeholder="Select a fruit or vegetable"
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output (standardized):</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                    {value && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                            All properties preserved: <code>value.category</code>, <code>value.price</code>, etc.
                        </div>
                    )}
                </div>
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'Input: Objects with {id, name, ...any properties}. Output: Original object with normalized id and name.',
            },
        },
    },
};

export const FlexibleInputWithLabel: Story = {
    name: 'Flexible Input - Using "label"',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>(null);

        return (
            <div>
                <div
                    style={{
                        marginBottom: '12px',
                        padding: '8px',
                        background: '#e3f2fd',
                        borderRadius: '4px',
                        fontSize: '12px',
                    }}
                >
                    <strong>Input uses "label" instead of "name"</strong> - Component automatically detects it
                </div>
                <OttaSelect
                    mode="single"
                    items={sampleItemsWithLabel}
                    value={value}
                    onChange={setValue}
                    placeholder="Select a user"
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output (standardized):</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'Demonstrates fallback to "label" property. Input has "label" but output uses "name" for standardization.',
            },
        },
    },
};

export const FlexibleInputWithTitle: Story = {
    name: 'Flexible Input - Using "title"',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>(null);

        return (
            <div>
                <div
                    style={{
                        marginBottom: '12px',
                        padding: '8px',
                        background: '#e3f2fd',
                        borderRadius: '4px',
                        fontSize: '12px',
                    }}
                >
                    <strong>Input uses "title"</strong> - Fallback chain: name → label → title
                </div>
                <OttaSelect
                    mode="single"
                    items={sampleItemsWithTitle}
                    value={value}
                    onChange={setValue}
                    placeholder="Select a document"
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output (standardized):</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

export const SingleSelectWithPreselected: Story = {
    name: 'Single Select - Pre-selected',
    render: () => {
        // Pre-select with normalized format
        const [value, setValue] = useState<OttaSelectItem | null>({
            id: '2',
            name: 'Banana',
            category: 'Fruit',
            color: 'Yellow',
            price: 1.99,
        });

        return (
            <div>
                <OttaSelect
                    mode="single"
                    items={sampleItemsWithName}
                    value={value}
                    onChange={setValue}
                    placeholder="Select a fruit or vegetable"
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output:</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

// Multiple Select Stories
export const MultiSelectBasic: Story = {
    name: 'Multi Select - Basic',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem[] | null>(null);

        return (
            <div>
                <OttaSelect
                    mode="multiple"
                    items={sampleItemsWithName}
                    value={value}
                    onChange={setValue as any}
                    placeholder="Select fruits and vegetables"
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output (array):</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'Multi-select returns array of objects with all original properties, or null when empty',
            },
        },
    },
};

export const MultiSelectWithPreselected: Story = {
    name: 'Multi Select - Pre-selected',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem[] | null>([
            { id: '1', name: 'Apple', category: 'Fruit', color: 'Red', price: 2.99 },
            { id: '3', name: 'Carrot', category: 'Vegetable', color: 'Orange', price: 0.99 },
        ]);

        return (
            <div>
                <OttaSelect
                    mode="multiple"
                    items={sampleItemsWithName}
                    value={value}
                    onChange={setValue as any}
                    placeholder="Select fruits and vegetables"
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output:</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

// Search Stories
export const WithSearch: Story = {
    name: 'With Search (Client-side)',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>(null);

        return (
            <div>
                <OttaSelect
                    mode="single"
                    items={largeItemsList}
                    value={value}
                    onChange={setValue}
                    placeholder="Search from 100 items"
                    searchable={true}
                    searchPlaceholder="Type to search..."
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output:</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

// Async/CrudHub Integration Stories
export const WithAsyncFetch: Story = {
    name: 'With Async Fetch (CrudHub)',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>(null);

        return (
            <div>
                <div
                    style={{
                        marginBottom: '12px',
                        padding: '8px',
                        background: '#fff3cd',
                        borderRadius: '4px',
                        fontSize: '12px',
                    }}
                >
                    <strong>Async mode:</strong> fetchCollection receives raw objects, component normalizes them
                </div>
                <OttaSelect
                    mode="single"
                    fetchCollection={mockFetchCollection}
                    value={value}
                    onChange={setValue}
                    placeholder="Search frameworks (async)"
                    searchDebounceMs={500}
                    loadingMessage="Fetching frameworks..."
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output (normalized):</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                        Try typing to see async search (500ms debounce). All original properties preserved.
                    </div>
                </div>
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'fetchCollection can return any object format. Component normalizes id and name while preserving all properties.',
            },
        },
    },
};

export const MultiSelectWithAsyncFetch: Story = {
    name: 'Multi Select - With Async Fetch',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem[] | null>(null);

        return (
            <div>
                <OttaSelect
                    mode="multiple"
                    fetchCollection={mockFetchCollection}
                    value={value}
                    onChange={setValue as any}
                    placeholder="Select multiple frameworks (async)"
                    searchDebounceMs={500}
                    loadingMessage="Fetching frameworks..."
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output:</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

// Custom Header/Footer Stories
export const WithCustomHeaderFooter: Story = {
    name: 'With Custom Header and Footer',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>(null);

        return (
            <div>
                <OttaSelect
                    mode="single"
                    items={sampleItemsWithName}
                    value={value}
                    onChange={setValue}
                    placeholder="Select with header/footer"
                    header={
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>🍎 Fruits & Vegetables</div>
                    }
                    footer={
                        <button
                            style={{
                                width: '100%',
                                padding: '6px',
                                fontSize: '12px',
                                color: '#2563eb',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                            onClick={() => alert('Add new item clicked')}
                        >
                            + Add new item
                        </button>
                    }
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output:</h4>
                    <pre
                        style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

// Edge Cases
export const EmptyItems: Story = {
    name: 'Empty Items List',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>(null);

        return (
            <div>
                <OttaSelect
                    mode="single"
                    items={[]}
                    value={value}
                    onChange={setValue}
                    placeholder="No items available"
                    emptyMessage="No options to display"
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output:</h4>
                    <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace' }}>
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

export const Disabled: Story = {
    name: 'Disabled State',
    render: () => {
        const [value, setValue] = useState<OttaSelectItem | null>({
            id: '1',
            name: 'Apple',
            category: 'Fruit',
            color: 'Red',
            price: 2.99,
        });

        return (
            <div>
                <OttaSelect
                    mode="single"
                    items={sampleItemsWithName}
                    value={value}
                    onChange={setValue}
                    placeholder="Disabled select"
                    disabled={true}
                />
                <div
                    style={{
                        marginTop: '20px',
                        padding: '10px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                    }}
                >
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Output:</h4>
                    <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace' }}>
                        {value ? JSON.stringify(value, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        );
    },
};

// Complete Example
export const CompleteExample: Story = {
    name: 'Complete Example',
    render: () => {
        const [singleValue, setSingleValue] = useState<OttaSelectItem | null>(null);
        const [multiValue, setMultiValue] = useState<OttaSelectItem[] | null>(null);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Single Select</h3>
                    <OttaSelect
                        mode="single"
                        items={sampleItemsWithName}
                        value={singleValue}
                        onChange={setSingleValue}
                        placeholder="Select a single item"
                    />
                    <div
                        style={{
                            marginTop: '10px',
                            padding: '10px',
                            background: '#f5f5f5',
                            borderRadius: '4px',
                        }}
                    >
                        <pre
                            style={{
                                margin: 0,
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                maxHeight: '120px',
                                overflow: 'auto',
                            }}
                        >
                            {singleValue ? JSON.stringify(singleValue, null, 2) : 'null'}
                        </pre>
                    </div>
                </div>

                <div>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Multi Select</h3>
                    <OttaSelect
                        mode="multiple"
                        items={sampleItemsWithName}
                        value={multiValue}
                        onChange={setMultiValue as any}
                        placeholder="Select multiple items"
                    />
                    <div
                        style={{
                            marginTop: '10px',
                            padding: '10px',
                            background: '#f5f5f5',
                            borderRadius: '4px',
                        }}
                    >
                        <pre
                            style={{
                                margin: 0,
                                fontSize: '10px',
                                fontFamily: 'monospace',
                                maxHeight: '120px',
                                overflow: 'auto',
                            }}
                        >
                            {multiValue ? JSON.stringify(multiValue, null, 2) : 'null'}
                        </pre>
                    </div>
                </div>
            </div>
        );
    },
    parameters: {
        docs: {
            description: {
                story: 'Both modes return objects with normalized id/name and all original properties preserved.',
            },
        },
    },
};
