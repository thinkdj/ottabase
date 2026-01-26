/**
 * OttaSelect Demo Page
 * Demonstrates @ottabase/ottaselect component
 */
import {
  OttaSelect,
  type ItemRendererProps,
  type OttaSelectItem,
} from "@ottabase/ottaselect";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ottabase/ui-shadcn";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

// Sample data with various formats
const fruitsAndVegetables = [
  {
    id: "1",
    name: "Apple",
    category: "Fruit",
    color: "Red",
    price: 2.99,
    emoji: "🍎",
  },
  {
    id: "2",
    name: "Banana",
    category: "Fruit",
    color: "Yellow",
    price: 1.99,
    emoji: "🍌",
  },
  {
    id: "3",
    name: "Carrot",
    category: "Vegetable",
    color: "Orange",
    price: 0.99,
    emoji: "🥕",
  },
  {
    id: "4",
    name: "Durian",
    category: "Fruit",
    color: "Green",
    price: 12.99,
    emoji: "🍈",
  },
  {
    id: "5",
    name: "Eggplant",
    category: "Vegetable",
    color: "Purple",
    price: 3.49,
    emoji: "🍆",
  },
  {
    id: "6",
    name: "Fig",
    category: "Fruit",
    color: "Purple",
    price: 4.99,
    emoji: "🫐",
  },
  {
    id: "7",
    name: "Grapes",
    category: "Fruit",
    color: "Green",
    price: 3.99,
    emoji: "🍇",
  },
  {
    id: "8",
    name: "Honeydew",
    category: "Fruit",
    color: "Green",
    price: 5.49,
    emoji: "🍈",
  },
  {
    id: "9",
    name: "Pineapple",
    category: "Fruit",
    color: "Yellow",
    price: 4.99,
    emoji: "🍍",
  },
  {
    id: "10",
    name: "Pen",
    category: "Stationery",
    color: "Blue",
    price: 0.99,
    emoji: "🖊️",
  },
];

const countries = [
  {
    id: "us",
    label: "United States",
    code: "US",
    flag: "🇺🇸",
    population: 331000000,
  },
  {
    id: "uk",
    label: "United Kingdom",
    code: "GB",
    flag: "🇬🇧",
    population: 67000000,
  },
  { id: "jp", label: "Japan", code: "JP", flag: "🇯🇵", population: 126000000 },
  { id: "de", label: "Germany", code: "DE", flag: "🇩🇪", population: 83000000 },
  { id: "fr", label: "France", code: "FR", flag: "🇫🇷", population: 67000000 },
  { id: "in", label: "India", code: "IN", flag: "🇮🇳", population: 1400000000 },
  { id: "br", label: "Brazil", code: "BR", flag: "🇧🇷", population: 213000000 },
  { id: "ca", label: "Canada", code: "CA", flag: "🇨🇦", population: 38000000 },
];

const users = [
  {
    id: "u1",
    title: "John Doe",
    email: "john@example.com",
    role: "Admin",
    avatar: "👨‍💼",
  },
  {
    id: "u2",
    title: "Jane Smith",
    email: "jane@example.com",
    role: "Editor",
    avatar: "👩‍💻",
  },
  {
    id: "u3",
    title: "Bob Wilson",
    email: "bob@example.com",
    role: "Viewer",
    avatar: "👨‍🔧",
  },
  {
    id: "u4",
    title: "Alice Brown",
    email: "alice@example.com",
    role: "Editor",
    avatar: "👩‍🎨",
  },
];

// Simulated paginated API - returns only first 3 items
const simulatePaginatedAPI = async (
  search: string,
): Promise<typeof countries> => {
  await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate network delay
  const filtered = countries.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );
  return filtered.slice(0, 3); // Only return first 3 items (simulating pagination)
};

export function OttaSelectDemoPage() {
  // Single select states
  const [singleFruit, setSingleFruit] = useState<OttaSelectItem | null>(null);
  const [singleCountry, setSingleCountry] = useState<OttaSelectItem | null>(
    null,
  );
  const [singleUser, setSingleUser] = useState<OttaSelectItem | null>(null);

  // Multi select states
  const [multiFruits, setMultiFruits] = useState<OttaSelectItem[] | null>(null);
  const [multiCountries, setMultiCountries] = useState<OttaSelectItem[] | null>(
    null,
  );

  // Pagination demo - pre-select items that won't be in API response
  const [paginatedSelection, setPaginatedSelection] = useState<
    OttaSelectItem[] | null
  >([
    { id: "in", name: "India", flag: "🇮🇳", code: "IN" }, // This won't be in first 3 results
    { id: "br", name: "Brazil", flag: "🇧🇷", code: "BR" },
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
      <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
        {item.category}
      </span>
    </div>
  );

  const UserRenderer = ({ item }: ItemRendererProps) => (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-lg">{item.avatar}</span>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground truncate">
          {item.email}
        </span>
      </div>
      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
        {item.role}
      </span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Button
          asChild
          variant="ghost"
          className="w-fit text-muted-foreground hover:text-foreground"
        >
          <Link to="/demo">← Back to Demo Gallery</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="uppercase">
            @ottabase/ottaselect
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            OttaSelect Component
          </h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          A flexible select component with custom rendering, pagination support,
          and standardized output format.
        </p>
      </div>

      {/* Basic Usage */}
      <Card>
        <CardHeader>
          <CardTitle>🔘 Basic Usage</CardTitle>
          <CardDescription>
            Simple single and multi-select without custom rendering. Just pass
            your data and go!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Simple single select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Single Select:</label>
            <OttaSelect
              mode="single"
              items={fruitsAndVegetables}
              value={singleFruit}
              onChange={(value) =>
                setSingleFruit(value as OttaSelectItem | null)
              }
              placeholder="Pick a fruit or vegetable..."
            />
            {singleFruit && (
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(singleFruit, null, 2)}
              </pre>
            )}
          </div>

          {/* Simple multi select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Multi Select:</label>
            <OttaSelect
              mode="multiple"
              items={fruitsAndVegetables}
              value={multiFruits}
              onChange={(value) =>
                setMultiFruits(value as OttaSelectItem[] | null)
              }
              placeholder="Pick multiple items..."
            />
            {multiFruits && multiFruits.length > 0 && (
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-32">
                {JSON.stringify(multiFruits, null, 2)}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Renderer Examples */}
      <Card>
        <CardHeader>
          <CardTitle>🎨 Custom Item Renderers</CardTitle>
          <CardDescription>
            Use <code className="bg-muted px-1 rounded">renderItem</code> to
            display custom content like flags, avatars, or badges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Country with flag */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Countries with flags:</label>
            <OttaSelect
              mode="single"
              items={countries}
              value={singleCountry}
              onChange={(value) =>
                setSingleCountry(value as OttaSelectItem | null)
              }
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
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(singleCountry, null, 2)}
              </pre>
            )}
          </div>

          {/* Fruits with emoji and category */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Fruits with emoji and category:
            </label>
            <OttaSelect
              mode="single"
              items={fruitsAndVegetables}
              value={singleFruit}
              onChange={(value) =>
                setSingleFruit(value as OttaSelectItem | null)
              }
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
            <label className="text-sm font-medium">
              Users with avatar, email, and role:
            </label>
            <OttaSelect
              mode="single"
              items={users}
              value={singleUser}
              onChange={(value) =>
                setSingleUser(value as OttaSelectItem | null)
              }
              placeholder="Select a user..."
              renderItem={UserRenderer}
              renderValue={(item) => (
                <span className="flex items-center gap-2">
                  <span>{item.avatar}</span>
                  <span>{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({item.role})
                  </span>
                </span>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Multi Select with Custom Rendering */}
      <Card>
        <CardHeader>
          <CardTitle>☑️ Multi Select with Custom Rendering</CardTitle>
          <CardDescription>
            Custom renderers work with multi-select too.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select multiple countries:
            </label>
            <OttaSelect
              mode="multiple"
              items={countries}
              value={multiCountries}
              onChange={(value) =>
                setMultiCountries(value as OttaSelectItem[] | null)
              }
              placeholder="Select countries..."
              renderItem={CountryRenderer}
            />
            {multiCountries && multiCountries.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {multiCountries.map((country, index) => (
                  <span
                    key={country.id || `country-${index}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-sm"
                  >
                    {country.flag} {country.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select multiple fruits:
            </label>
            <OttaSelect
              mode="multiple"
              items={fruitsAndVegetables}
              value={multiFruits}
              onChange={(value) =>
                setMultiFruits(value as OttaSelectItem[] | null)
              }
              placeholder="Select fruits..."
              renderItem={FruitRenderer}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pagination Handling */}
      <Card>
        <CardHeader>
          <CardTitle>📄 Pagination Support</CardTitle>
          <CardDescription>
            Selected items persist even when not in current API page. The{" "}
            <code className="bg-muted px-1 rounded">showSelectedFirst</code>{" "}
            prop ensures selected items are always visible at the top.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <strong>Demo:</strong> This select uses a simulated API that only
            returns the first 3 countries. India and Brazil are pre-selected but
            won't appear in the API response. Notice they still appear at the
            top of the dropdown!
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Countries (API returns only first 3):
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPaginatedSelection([
                    { id: "in", name: "India", flag: "🇮🇳", code: "IN" },
                    { id: "br", name: "Brazil", flag: "🇧🇷", code: "BR" },
                  ])
                }
              >
                Reset Demo
              </Button>
            </div>
            <OttaSelect
              mode="multiple"
              fetchCollection={simulatePaginatedAPI}
              value={paginatedSelection}
              onChange={(value) =>
                setPaginatedSelection(value as OttaSelectItem[] | null)
              }
              placeholder="Select countries..."
              renderItem={CountryRenderer}
              showSelectedFirst={true}
            />
            {paginatedSelection && paginatedSelection.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {paginatedSelection.map((country, index) => (
                  <span
                    key={country.id || `country-pag-${index}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
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
      <Card>
        <CardHeader>
          <CardTitle>✨ Features</CardTitle>
          <CardDescription>Key capabilities of OttaSelect</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                <strong>Custom Item Renderer:</strong> Pass{" "}
                <code className="bg-muted px-1 rounded">renderItem</code> to
                display flags, avatars, badges, etc.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                <strong>Custom Value Renderer:</strong> Pass{" "}
                <code className="bg-muted px-1 rounded">renderValue</code> to
                customize the selected value display
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                <strong>Pagination Support:</strong> Selected items persist even
                when not in current API response
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                <strong>Selected First:</strong>{" "}
                <code className="bg-muted px-1 rounded">showSelectedFirst</code>{" "}
                keeps selected items at top
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                <strong>Flexible Input:</strong> Accepts objects with{" "}
                <code className="bg-muted px-1 rounded">name</code>,{" "}
                <code className="bg-muted px-1 rounded">label</code>, or{" "}
                <code className="bg-muted px-1 rounded">title</code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>
                <strong>Async Loading:</strong> Built-in support for{" "}
                <code className="bg-muted px-1 rounded">fetchCollection</code>{" "}
                with loading states
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Usage Example */}
      <Card>
        <CardHeader>
          <CardTitle>📖 Usage</CardTitle>
          <CardDescription>How to use custom renderers</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
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
