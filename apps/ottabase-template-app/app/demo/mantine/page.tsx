"use client";

import {
  APP_META,
  THEME_COLORS,
  UI_LAYOUT,
} from "@/ottabase/config/app.config";
import {
  appStateAtom,
  scaleAtom,
  themeAtom,
} from "@/ottabase/state/appGlobalState";
import {
  Badge,
  Button,
  Card,
  Code,
  Container,
  Group,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from "@ottabase/ui-mantine";
import { OttaSelect, OttaSelectItem } from "@ottabase/ottaselect";
import { BlogPagination } from "@ottabase/ui-components";
import { DarkModeToggle } from "@ottabase/ui-components/dark-mode-toggle";
import { Logo } from "@ottabase/ui-components/logo";
import { useAtom, useAtomValue } from "jotai";
import Link from "next/link";
import { useState } from "react";

// Sample data for OttaSelect - flexible input format (any object with id and name/label/title)
const sampleItems = [
  { id: "1", name: "Apple", category: "Fruit", color: "Red", price: 2.99 },
  { id: "2", name: "Banana", category: "Fruit", color: "Yellow", price: 1.99 },
  {
    id: "3",
    name: "Carrot",
    category: "Vegetable",
    color: "Orange",
    price: 0.99,
  },
  { id: "4", name: "Durian", category: "Fruit", color: "Green", price: 12.99 },
  {
    id: "5",
    name: "Eggplant",
    category: "Vegetable",
    color: "Purple",
    price: 3.49,
  },
];

export default function DemoPage() {
  const appState = useAtomValue(appStateAtom);
  const [scale, setScale] = useAtom(scaleAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  // For more complex updates, you can use the main atom
  const setAppState = useAtom(appStateAtom)[1];

  const [localCounter, setLocalCounter] = useState(0);
  const [singleSelectValue, setSingleSelectValue] =
    useState<OttaSelectItem | null>(null);
  const [multiSelectValue, setMultiSelectValue] = useState<
    OttaSelectItem[] | null
  >(null);

  const handleScaleChange = (value: number) => {
    setScale(value);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const updateCursorTheme = () => {
    const themes = ["default", "retro", "modern", "minimal"] as const;
    const currentIndex = themes.indexOf(appState.cursorTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setAppState((prev) => ({ ...prev, cursorTheme: nextTheme }));
  };

  const updateSelectionColor = () => {
    const isDark = appState.theme === "dark";
    setAppState((prev) => ({
      ...prev,
      selectionColor: {
        foreground: "#fa4529",
        background: isDark ? "#2c2e33" : "#fff",
      },
    }));
  };

  return (
    <Container size="md" py="xl">
      {/* Back to Demo Gallery */}
      <Group justify="flex-start" align="center" mb="xl">
        <Button component={Link} href="/demo" variant="light" size="sm">
          ← Back to Demo Gallery
        </Button>
      </Group>

      <div className="bg-red-500 text-white p-4 my-4 rounded-sm">
        Tailwind is working!
      </div>

      <Stack gap="xl">
        {/* Header */}
        <div>
          <Title order={1} mb="md">
            {APP_META.appName} - Demo Components
          </Title>
          <Text size="lg" c="dimmed">
            This demo page showcases all the available components, state
            management, and theme switching capabilities. In a real app, you can
            safely delete this entire /demo directory.
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            {APP_META.copyrightText}
          </Text>
          <Group mt="lg">
            <Button
              component={Link}
              href="/demo/shadcn"
              variant="outline"
              leftSection={<span aria-hidden="true">✨</span>}
            >
              Explore shadcn/ui demo
            </Button>
            <Button
              component={Link}
              href="/demo/ottaeditor"
              variant="outline"
              leftSection={<span aria-hidden="true">✏️</span>}
            >
              Explore OttaEditor demo
            </Button>
          </Group>
        </div>

        {/* App State Demo */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">
            Global State Demo
          </Title>

          <Stack gap="md">
            <Group justify="space-between">
              <Text>Current Theme:</Text>
              <Badge color={theme === "dark" ? "dark" : "blue"}>{theme}</Badge>
              <Button size="xs" onClick={toggleTheme}>
                Toggle Theme
              </Button>
            </Group>

            <Group justify="space-between">
              <Text>UI Scale:</Text>
              <Text size="sm" c="dimmed">
                {scale}x
              </Text>
            </Group>
            <Slider
              value={scale}
              onChange={handleScaleChange}
              min={0.5}
              max={2.0}
              step={0.1}
              marks={[
                { value: 0.5, label: "0.5x" },
                { value: 1.0, label: "1x" },
                { value: 1.5, label: "1.5x" },
                { value: 2.0, label: "2x" },
              ]}
            />

            <Group justify="space-between">
              <Text>Cursor Theme:</Text>
              <Badge variant="light">{appState.cursorTheme}</Badge>
              <Button size="xs" onClick={updateCursorTheme}>
                Change Cursor
              </Button>
            </Group>

            <Group justify="space-between">
              <Text>Selection Color:</Text>
              <div
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: appState.selectionColor.background,
                  border: `2px solid ${appState.selectionColor.foreground}`,
                  borderRadius: 4,
                }}
              />
              <Button size="xs" onClick={updateSelectionColor}>
                Update Colors
              </Button>
            </Group>

            <Group justify="space-between">
              <Text>Desktop Sidebar:</Text>
              <Switch
                checked={appState.isDesktopSidebarOpen}
                onChange={(event) =>
                  setAppState((prev) => ({
                    ...prev,
                    isDesktopSidebarOpen: event.currentTarget.checked,
                  }))
                }
              />
            </Group>
          </Stack>
        </Card>

        {/* Local State Demo */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">
            Local State Demo
          </Title>

          <Group justify="space-between">
            <Text>Local Counter: {localCounter}</Text>
            <Group>
              <Button size="xs" onClick={() => setLocalCounter((c) => c - 1)}>
                -1
              </Button>
              <Button size="xs" onClick={() => setLocalCounter((c) => c + 1)}>
                +1
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => setLocalCounter(0)}
              >
                Reset
              </Button>
            </Group>
          </Group>
        </Card>

        {/* UI Components Demo */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">
            UI Components Demo
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            Note: The dark mode toggle in the top-right corner is provided by
            the demo layout and works globally across all demo pages.
          </Text>

          <BlogPagination
            onPageChange={(page) => console.log("Page changed to:", page)}
            page={1}
            lastPage={10}
            perPage={10}
          />

          <Stack gap="md">
            <Group justify="space-between">
              <Text>Dark Mode Toggle (Button):</Text>
              <DarkModeToggle type="button" />
            </Group>

            <Group justify="space-between">
              <Text>Dark Mode Toggle (Switch):</Text>
              <DarkModeToggle type="toggle-switch" />
            </Group>

            <Group justify="space-between">
              <Text>Logo Component:</Text>
              <Logo appName={APP_META.appName} logoUrl={APP_META.logoUrl} />
            </Group>

            <Group justify="space-between">
              <Text>Logo with Dark Mode Toggle:</Text>
              <Logo appName={APP_META.appName} darkModeSwitcher={true} />
            </Group>
          </Stack>
        </Card>

        {/* OttaSelect Demo */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">
            OttaSelect Component
          </Title>
          <Text size="sm" c="dimmed" mb="lg">
            A select with flexible input (any object format) and standardized
            output. Accepts objects with id and name/label/title properties.
          </Text>

          <Stack gap="lg">
            <div>
              <Text size="sm" fw={500} mb="xs">
                Single Select:
              </Text>
              <OttaSelect
                mode="single"
                items={sampleItems}
                value={singleSelectValue}
                onChange={(value) =>
                  setSingleSelectValue(value as OttaSelectItem | null)
                }
                placeholder="Select a fruit or vegetable"
              />
              {singleSelectValue && (
                <Code block mt="xs" style={{ fontSize: "11px" }}>
                  {JSON.stringify(singleSelectValue, null, 2)}
                </Code>
              )}
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">
                Multi Select:
              </Text>
              <OttaSelect
                mode="multiple"
                items={sampleItems}
                value={multiSelectValue}
                onChange={(value) =>
                  setMultiSelectValue(value as OttaSelectItem[] | null)
                }
                placeholder="Select multiple items"
              />
              {multiSelectValue && multiSelectValue.length > 0 && (
                <Code
                  block
                  mt="xs"
                  style={{
                    fontSize: "11px",
                    maxHeight: "150px",
                    overflow: "auto",
                  }}
                >
                  {JSON.stringify(multiSelectValue, null, 2)}
                </Code>
              )}
            </div>
          </Stack>
        </Card>

        {/* Configuration Demo */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">
            Configuration Demo
          </Title>

          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm">UI Layout Min Width:</Text>
              <Code>{UI_LAYOUT.minWidth}px</Code>
            </Group>
            <Group justify="space-between">
              <Text size="sm">UI Layout Max Width:</Text>
              <Code>{UI_LAYOUT.maxWidth}px</Code>
            </Group>
            <Group justify="space-between">
              <Text size="sm">Available Theme Colors:</Text>
              <Group gap="xs">
                {Object.keys(THEME_COLORS).map((colorName) => (
                  <Badge key={colorName} variant="light" size="sm">
                    {colorName}
                  </Badge>
                ))}
              </Group>
            </Group>
          </Stack>
        </Card>

        {/* Font Demo */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} size="h3" mb="md">
            Font Demo
          </Title>

          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Primary Font (Inter):
              </Text>
              <Text className="font-family-primary">
                The quick brown fox jumps over the lazy dog. 1234567890
              </Text>
            </div>

            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Heading Font (Work Sans):
              </Text>
              <Text className="font-family-heading" size="lg" fw={600}>
                The quick brown fox jumps over the lazy dog. 1234567890
              </Text>
            </div>

            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Monospace Font (JetBrains Mono):
              </Text>
              <Code className="font-family-monospace">
                const example = "Hello World"; // Code example
              </Code>
            </div>

            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Handwriting Font (Patrick Hand):
              </Text>
              <Text className="font-family-handwriting" size="lg">
                The quick brown fox jumps over the lazy dog.
              </Text>
            </div>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
