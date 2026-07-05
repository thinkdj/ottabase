/**
 * OttaSelect Demo Page
 * Demonstrates @ottabase/ottaselect component
 */
import { OttaSelect, type ItemRendererProps, type OttaSelectItem, type OttaSelectSize } from '@ottabase/ottaselect';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

// Sample data with various formats
const fruitsAndVegetables = [
    {
        id: '1',
        name: 'Apple',
        category: 'Fruit',
        color: 'Red',
        price: 2.99,
        emoji: '🍎',
    },
    {
        id: '2',
        name: 'Banana',
        category: 'Fruit',
        color: 'Yellow',
        price: 1.99,
        emoji: '🍌',
    },
    {
        id: '3',
        name: 'Carrot',
        category: 'Vegetable',
        color: 'Orange',
        price: 0.99,
        emoji: '🥕',
    },
    {
        id: '4',
        name: 'Durian',
        category: 'Fruit',
        color: 'Green',
        price: 12.99,
        emoji: '🍈',
    },
    {
        id: '5',
        name: 'Eggplant',
        category: 'Vegetable',
        color: 'Purple',
        price: 3.49,
        emoji: '🍆',
    },
    {
        id: '6',
        name: 'Fig',
        category: 'Fruit',
        color: 'Purple',
        price: 4.99,
        emoji: '🫐',
    },
    {
        id: '7',
        name: 'Grapes',
        category: 'Fruit',
        color: 'Green',
        price: 3.99,
        emoji: '🍇',
    },
    {
        id: '8',
        name: 'Honeydew',
        category: 'Fruit',
        color: 'Green',
        price: 5.49,
        emoji: '🍈',
    },
    {
        id: '9',
        name: 'Pineapple',
        category: 'Fruit',
        color: 'Yellow',
        price: 4.99,
        emoji: '🍍',
    },
    {
        id: '10',
        name: 'Pen',
        category: 'Stationery',
        color: 'Blue',
        price: 0.99,
        emoji: '🖊️',
    },
];

const countries = [
    {
        id: 'us',
        label: 'United States',
        code: 'US',
        flag: '🇺🇸',
        population: 331000000,
    },
    {
        id: 'uk',
        label: 'United Kingdom',
        code: 'GB',
        flag: '🇬🇧',
        population: 67000000,
    },
    { id: 'jp', label: 'Japan', code: 'JP', flag: '🇯🇵', population: 126000000 },
    { id: 'de', label: 'Germany', code: 'DE', flag: '🇩🇪', population: 83000000 },
    { id: 'fr', label: 'France', code: 'FR', flag: '🇫🇷', population: 67000000 },
    { id: 'in', label: 'India', code: 'IN', flag: '🇮🇳', population: 1400000000 },
    { id: 'br', label: 'Brazil', code: 'BR', flag: '🇧🇷', population: 213000000 },
    { id: 'ca', label: 'Canada', code: 'CA', flag: '🇨🇦', population: 38000000 },
];

const users = [
    {
        id: 'u1',
        title: 'John Doe',
        email: 'john@example.com',
        role: 'Admin',
        avatar: '👨‍💼',
    },
    {
        id: 'u2',
        title: 'Jane Smith',
        email: 'jane@example.com',
        role: 'Editor',
        avatar: '👩‍💻',
    },
    {
        id: 'u3',
        title: 'Bob Wilson',
        email: 'bob@example.com',
        role: 'Viewer',
        avatar: '👨‍🔧',
    },
    {
        id: 'u4',
        title: 'Alice Brown',
        email: 'alice@example.com',
        role: 'Editor',
        avatar: '👩‍🎨',
    },
];

const selectSizes: OttaSelectSize[] = ['xs', 'sm', 'md', 'lg'];

// Simulated paginated API - returns only first 3 items
const simulatePaginatedAPI = async (search: string): Promise<typeof countries> => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate network delay
    const filtered = countries.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));
    return filtered.slice(0, 3); // Only return first 3 items (simulating pagination)
};

export function OttaSelectDemoPage() {
    const [demoSize, setDemoSize] = useState<OttaSelectSize>('md');

    // Single select states
    const [singleFruit, setSingleFruit] = useState<OttaSelectItem | null>(null);
    const [singleCountry, setSingleCountry] = useState<OttaSelectItem | null>(null);
    const [singleUser, setSingleUser] = useState<OttaSelectItem | null>(null);

    // Multi select states
    const [multiFruits, setMultiFruits] = useState<OttaSelectItem[] | null>(null);
    const [multiCountries, setMultiCountries] = useState<OttaSelectItem[] | null>(null);

    // Pagination demo - pre-select items that won't be in API response
    const [paginatedSelection, setPaginatedSelection] = useState<OttaSelectItem[] | null>([
        { id: 'in', name: 'India', flag: '🇮🇳', code: 'IN' }, // This won't be in first 3 results
        { id: 'br', name: 'Brazil', flag: '🇧🇷', code: 'BR' },
    ]);

    // Custom Renderers
    const CountryRenderer = ({ item }: ItemRendererProps) => (
        <div className="flex items-center gap-2 flex-1">
            <span className="text-lg">{item.flag}</span>
            <span className="truncate">{item.name}</span>
            <span className="text-xs text-muted-foreground ml-auto">{item.code}</span>
        </div>
    );

    const FruitRenderer = ({ item }: ItemRendererProps) => (
        <div className="flex items-center gap-2 flex-1">
            <span>{item.emoji}</span>
            <span className="truncate">{item.name}</span>
            <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                {item.category}
            </span>
        </div>
    );

    const UserRenderer = ({ item }: ItemRendererProps) => (
        <div className="flex items-center gap-2 flex-1">
            <span className="text-lg">{item.avatar}</span>
            <div className="flex flex-col flex-1 min-w-0">
                <span className="truncate font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground truncate">{item.email}</span>
            </div>
            <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                {item.role}
            </span>
        </div>
    );

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="OttaSelect Component"
                description="A flexible select component with custom rendering, pagination support, and standardized output format."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Demo size:</span>
                        {selectSizes.map((size) => (
                            <Button
                                key={size}
                                type="button"
                                size="sm"
                                variant={demoSize === size ? 'default' : 'outline'}
                                className="min-w-10 uppercase"
                                onClick={() => setDemoSize(size)}
                            >
                                {size}
                            </Button>
                        ))}
                        <span className="text-xs text-muted-foreground">Applies to all OttaSelect examples below.</span>
                    </div>
                }
            />

            {/* Basic Usage */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">🔘 Basic Usage</CardTitle>
                    <CardDescription>
                        Simple single and multi-select without custom rendering. Just pass your data and go!
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Simple single select */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Single Select:</label>
                        <OttaSelect
                            mode="single"
                            size={demoSize}
                            items={fruitsAndVegetables}
                            value={singleFruit}
                            onChange={(value) => setSingleFruit(value as OttaSelectItem | null)}
                            placeholder="Pick a fruit or vegetable..."
                        />
                        {singleFruit && (
                            <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                                {JSON.stringify(singleFruit, null, 2)}
                            </pre>
                        )}
                    </div>

                    {/* Simple multi select */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Multi Select:</label>
                        <OttaSelect
                            mode="multiple"
                            size={demoSize}
                            items={fruitsAndVegetables}
                            value={multiFruits}
                            onChange={(value) => setMultiFruits(value as OttaSelectItem[] | null)}
                            placeholder="Pick multiple items..."
                        />
                        {multiFruits && multiFruits.length > 0 && (
                            <pre className="max-h-32 overflow-x-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                                {JSON.stringify(multiFruits, null, 2)}
                            </pre>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Custom Renderer Examples */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">🎨 Custom Item Renderers</CardTitle>
                    <CardDescription>
                        Use <code className="rounded bg-background px-1 ring-1 ring-border">renderItem</code> to display
                        custom content like flags, avatars, or badges.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Country with flag */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Countries with flags:</label>
                        <OttaSelect
                            mode="single"
                            size={demoSize}
                            items={countries}
                            value={singleCountry}
                            onChange={(value) => setSingleCountry(value as OttaSelectItem | null)}
                            placeholder="Select a country..."
                            renderItem={CountryRenderer}
                            renderValue={(item) => (
                                <span className="flex items-center gap-2">
                                    <span>{item.flag}</span>
                                    <span>{item.name}</span>
                                </span>
                            )}
                        />
                        {singleCountry && (
                            <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                                {JSON.stringify(singleCountry, null, 2)}
                            </pre>
                        )}
                    </div>

                    {/* Fruits with emoji and category */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Fruits with emoji and category:</label>
                        <OttaSelect
                            mode="single"
                            size={demoSize}
                            items={fruitsAndVegetables}
                            value={singleFruit}
                            onChange={(value) => setSingleFruit(value as OttaSelectItem | null)}
                            placeholder="Select a fruit..."
                            renderItem={FruitRenderer}
                            renderValue={(item) => (
                                <span className="flex items-center gap-2">
                                    <span>{item.emoji}</span>
                                    <span>{item.name}</span>
                                </span>
                            )}
                        />
                    </div>

                    {/* Users with avatar and role */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Users with avatar, email, and role:</label>
                        <OttaSelect
                            mode="single"
                            size={demoSize}
                            items={users}
                            value={singleUser}
                            onChange={(value) => setSingleUser(value as OttaSelectItem | null)}
                            placeholder="Select a user..."
                            renderItem={UserRenderer}
                            renderValue={(item) => (
                                <span className="flex items-center gap-2">
                                    <span>{item.avatar}</span>
                                    <span>{item.name}</span>
                                    <span className="text-xs text-muted-foreground">({item.role})</span>
                                </span>
                            )}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Multi Select with Custom Rendering */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">
                        ☑️ Multi Select with Custom Rendering
                    </CardTitle>
                    <CardDescription>Custom renderers work with multi-select too.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select multiple countries:</label>
                        <OttaSelect
                            mode="multiple"
                            size={demoSize}
                            items={countries}
                            value={multiCountries}
                            onChange={(value) => setMultiCountries(value as OttaSelectItem[] | null)}
                            placeholder="Select countries..."
                            renderItem={CountryRenderer}
                        />
                        {multiCountries && multiCountries.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {multiCountries.map((country, index) => (
                                    <span
                                        key={country.id || `country-${index}`}
                                        className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-sm ring-1 ring-border"
                                    >
                                        {country.flag} {country.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select multiple fruits:</label>
                        <OttaSelect
                            mode="multiple"
                            size={demoSize}
                            items={fruitsAndVegetables}
                            value={multiFruits}
                            onChange={(value) => setMultiFruits(value as OttaSelectItem[] | null)}
                            placeholder="Select fruits..."
                            renderItem={FruitRenderer}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Pagination Handling */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">📄 Pagination Support</CardTitle>
                    <CardDescription>
                        Selected items persist even when not in current API page. The{' '}
                        <code className="rounded bg-background px-1 ring-1 ring-border">showSelectedFirst</code> prop
                        ensures selected items are always visible at the top.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border border-info/40 bg-info/10 p-3 text-sm text-info">
                        <strong className="font-semibold">Demo:</strong> This select uses a simulated API that only
                        returns the first 3 countries. India and Brazil are pre-selected but won't appear in the API
                        response. Notice they still appear at the top of the dropdown!
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Countries (API returns only first 3):</label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setPaginatedSelection([
                                        { id: 'in', name: 'India', flag: '🇮🇳', code: 'IN' },
                                        { id: 'br', name: 'Brazil', flag: '🇧🇷', code: 'BR' },
                                    ])
                                }
                            >
                                Reset Demo
                            </Button>
                        </div>
                        <OttaSelect
                            mode="multiple"
                            size={demoSize}
                            fetchCollection={simulatePaginatedAPI}
                            value={paginatedSelection}
                            onChange={(value) => setPaginatedSelection(value as OttaSelectItem[] | null)}
                            placeholder="Select countries..."
                            renderItem={CountryRenderer}
                            showSelectedFirst={true}
                        />
                        {paginatedSelection && paginatedSelection.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {paginatedSelection.map((country, index) => (
                                    <span
                                        key={country.id || `country-pag-${index}`}
                                        className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-sm ring-1 ring-border"
                                    >
                                        {country.flag} {country.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">✨ Features</CardTitle>
                    <CardDescription>Key capabilities of OttaSelect</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>
                                <strong>Size Variants:</strong> Toggle{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">xs</code>,{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">sm</code>,{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">md</code>, and{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">lg</code> using the demo
                                switcher
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>
                                <strong>Custom Item Renderer:</strong> Pass{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">renderItem</code> to
                                display flags, avatars, badges, etc.
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>
                                <strong>Custom Value Renderer:</strong> Pass{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">renderValue</code> to
                                customize the selected value display
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>
                                <strong>Pagination Support:</strong> Selected items persist even when not in current API
                                response
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>
                                <strong>Selected First:</strong>{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">showSelectedFirst</code>{' '}
                                keeps selected items at top
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>
                                <strong>Flexible Input:</strong> Accepts objects with{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">name</code>,{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">label</code>, or{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">title</code>
                            </span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-success">✓</span>
                            <span>
                                <strong>Async Loading:</strong> Built-in support for{' '}
                                <code className="rounded bg-background px-1 ring-1 ring-border">fetchCollection</code>{' '}
                                with loading states
                            </span>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            {/* Usage Example */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">📖 Usage</CardTitle>
                    <CardDescription>How to use custom renderers</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-sm ring-1 ring-border">
                        {`import { OttaSelect, type ItemRendererProps } from "@ottabase/ottaselect";

const countries = [
  { id: "us", name: "United States", flag: "🇺🇸" },
  { id: "uk", name: "United Kingdom", flag: "🇬🇧" },
];

// Custom renderer with flag
const CountryRenderer = ({ item }: ItemRendererProps) => (
  <div className="flex items-center gap-2">
    <span>{item.flag}</span>
    <span>{item.name}</span>
  </div>
);

function MyComponent() {
  const [selected, setSelected] = useState(null);

  return (
    <OttaSelect
      mode="single"
      items={countries}
      value={selected}
      onChange={setSelected}
      renderItem={CountryRenderer}
      renderValue={(item) => (
        <span>{item.flag} {item.name}</span>
      )}
    />
  );
}`}
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}
