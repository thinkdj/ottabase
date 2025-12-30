import { APP_META, appConfig } from "@/ottabase/config/app.config";
import {
    appStateAtom,
    mantineThemePresetAtom,
    scaleAtom,
    themeAtom,
    type MantineThemePreset,
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
import { OttaSelect, type OttaSelectItem } from "@ottabase/ottaselect";
import { BlogPagination } from "@ottabase/ui-components";
import { DarkModeToggle } from "@ottabase/ui-components/dark-mode-toggle";
import { Logo } from "@ottabase/ui-components/logo";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";

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

export function MantineDemoPage() {
    const appState = useAtomValue(appStateAtom);
    const [scale, setScale] = useAtom(scaleAtom);
    const [theme, setTheme] = useAtom(themeAtom);
    const [mantineTheme, setMantineTheme] = useAtom(mantineThemePresetAtom);
    const setAppState = useAtom(appStateAtom)[1];

    const [localCounter, setLocalCounter] = useState(0);
    const [singleSelectValue, setSingleSelectValue] =
        useState<OttaSelectItem | null>(null);
    const [multiSelectValue, setMultiSelectValue] = useState<OttaSelectItem[] | null>(null);

    const toggleTheme = () => {
        setTheme(theme === "light" ? "dark" : "light");
    };

    const updateCursorTheme = () => {
        const themes = ["default", "retro", "modern", "minimal"] as const;
        const currentIndex = themes.indexOf(appState.cursorTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        setAppState((prev) => ({ ...prev, cursorTheme: nextTheme }));
    };

    return (
        <Container size="md" py="xl">
            <Stack gap="xl">
                <div>
                    <Title order={1} mb="md">
                        {APP_META.appName} - Demo Components
                    </Title>
                    <Text size="lg" c="dimmed">
                        Mantine demo (wrapped in a Mantine provider). In a real app, you can
                        delete the entire /demo directory.
                    </Text>

                    <Group mt="lg">
                        <Button component="a" href="/demo/shadcn" variant="outline">
                            Explore shadcn/ui demo
                        </Button>
                        <Button component="a" href="/demo/ottaeditor" variant="outline">
                            Explore OttaEditor demo
                        </Button>
                    </Group>
                </div>

                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={2} size="h3" mb="md">
                        Global State & Theme Demo
                    </Title>

                    <Stack gap="md">
                        <Group justify="space-between">
                            <Text>Color Scheme (Light/Dark):</Text>
                            <Badge color={theme === "dark" ? "dark" : "blue"}>{theme}</Badge>
                            <Button size="xs" onClick={toggleTheme}>
                                Toggle Light/Dark
                            </Button>
                        </Group>

                        <div>
                            <Text size="sm" fw={500} mb="xs">
                                Mantine Theme Preset:
                            </Text>
                            <Group gap="xs">
                                {(
                                    [
                                        "mantine-shadcn",
                                        "mantine-vercel",
                                        "mantine-ant",
                                        "mantine-stripe",
                                    ] as MantineThemePreset[]
                                ).map((preset) => (
                                    <Button
                                        key={preset}
                                        size="sm"
                                        variant={mantineTheme === preset ? "filled" : "outline"}
                                        onClick={() => setMantineTheme(preset)}
                                    >
                                        {preset.replace("mantine-", "")}
                                    </Button>
                                ))}
                            </Group>
                            <Text size="xs" c="dimmed" mt="xs">
                                Current: <Code>{mantineTheme}</Code>
                            </Text>
                        </div>

                        <Group justify="space-between">
                            <Text>UI Scale:</Text>
                            <Text size="sm" c="dimmed">
                                {scale}x
                            </Text>
                        </Group>
                        <Slider
                            value={scale}
                            onChange={setScale}
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
                            <Button size="xs" variant="light" onClick={() => setLocalCounter(0)}>
                                Reset
                            </Button>
                        </Group>
                    </Group>
                </Card>

                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={2} size="h3" mb="md">
                        UI Components Demo
                    </Title>

                    <BlogPagination
                        onPageChange={(page) => console.log("Page changed to:", page)}
                        page={1}
                        lastPage={10}
                        perPage={10}
                    />

                    <Stack gap="md" mt="md">
                        <Group justify="space-between">
                            <Text>Dark Mode Toggle (Button):</Text>
                            <DarkModeToggle type="button" />
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

                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={2} size="h3" mb="md">
                        OttaSelect Component
                    </Title>
                    <Text size="sm" c="dimmed" mb="lg">
                        A select with flexible input and standardized output.
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
                                onChange={(value) => setSingleSelectValue(value as OttaSelectItem | null)}
                                placeholder="Select a fruit or vegetable"
                            />
                            {singleSelectValue ? (
                                <Code block mt="xs" style={{ fontSize: "11px" }}>
                                    {JSON.stringify(singleSelectValue, null, 2)}
                                </Code>
                            ) : null}
                        </div>

                        <div>
                            <Text size="sm" fw={500} mb="xs">
                                Multi Select:
                            </Text>
                            <OttaSelect
                                mode="multiple"
                                items={sampleItems}
                                value={multiSelectValue}
                                onChange={(value) => setMultiSelectValue(value as OttaSelectItem[] | null)}
                                placeholder="Select multiple items"
                            />
                            {multiSelectValue && multiSelectValue.length > 0 ? (
                                <Code
                                    block
                                    mt="xs"
                                    style={{ fontSize: "11px", maxHeight: "150px", overflow: "auto" }}
                                >
                                    {JSON.stringify(multiSelectValue, null, 2)}
                                </Code>
                            ) : null}
                        </div>
                    </Stack>
                </Card>

                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={2} size="h3" mb="md">
                        Configuration Demo
                    </Title>

                    <Stack gap="sm">
                        <Group justify="space-between">
                            <Text size="sm">UI Layout Min Width:</Text>
                            <Code>{appConfig.ui.layout.minWidth}px</Code>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm">UI Layout Max Width:</Text>
                            <Code>{appConfig.ui.layout.maxWidth}px</Code>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm">Available Theme Colors:</Text>
                            <Group gap="xs">
                                {Object.keys(appConfig.theme.colors).map((colorName) => (
                                    <Badge key={colorName} variant="light" size="sm">
                                        {colorName}
                                    </Badge>
                                ))}
                            </Group>
                        </Group>
                    </Stack>
                </Card>
            </Stack>
        </Container>
    );
}
