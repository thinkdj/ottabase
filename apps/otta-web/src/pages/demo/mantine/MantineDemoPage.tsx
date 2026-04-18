import { APP_META, appConfig } from '@/ottabase/config';
import { appStateAtom, sidebarStateAtom, themeAtom } from '@/ottabase/state/appState';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import { BlogPagination } from '@ottabase/ui-components';
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';
import { Logo } from '@ottabase/ui-components/logo';
import {
    Badge,
    Button,
    Card,
    Code,
    Container,
    Group,
    MANTINE_DEMO_THEME_COLORS,
    Stack,
    Switch,
    Text,
    Title,
} from '@ottabase/ui-mantine';
import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';
import { mantineThemePresetAtom, type MantineThemePreset } from './MantineLayout';

const sampleItems = [
    { id: '1', name: 'Apple', category: 'Fruit', color: 'Red', price: 2.99 },
    { id: '2', name: 'Banana', category: 'Fruit', color: 'Yellow', price: 1.99 },
    {
        id: '3',
        name: 'Carrot',
        category: 'Vegetable',
        color: 'Orange',
        price: 0.99,
    },
    { id: '4', name: 'Durian', category: 'Fruit', color: 'Green', price: 12.99 },
    {
        id: '5',
        name: 'Eggplant',
        category: 'Vegetable',
        color: 'Purple',
        price: 3.49,
    },
];

export function MantineDemoPage() {
    const appState = useAtomValue(appStateAtom);
    const [theme, setTheme] = useAtom(themeAtom);
    const [sidebarState, setSidebarState] = useAtom(sidebarStateAtom);
    const [mantineTheme, setMantineTheme] = useAtom(mantineThemePresetAtom);

    const [localCounter, setLocalCounter] = useState(0);
    const [singleSelectValue, setSingleSelectValue] = useState<OttaSelectItem | null>(null);
    const [multiSelectValue, setMultiSelectValue] = useState<OttaSelectItem[] | null>(null);

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <Container size="md" py="xl">
            <Stack gap="xl">
                <div>
                    <Title order={1} mb="md">
                        {APP_META.appName} - Demo Components
                    </Title>
                    <Text size="lg" c="dimmed">
                        Mantine demo (wrapped in a Mantine provider). In a real app, you can delete the entire /demo
                        directory.
                    </Text>

                    {/* Proof-of-concept notice — explains the wrapper pattern used on this page */}
                    <div
                        style={{
                            background: 'rgba(250,204,21,0.12)',
                            border: '1px solid rgba(250,204,21,0.5)',
                            borderRadius: 8,
                            padding: '12px 16px',
                            marginTop: 24,
                        }}
                    >
                        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14 }}>
                            ⚠ Proof of Concept for seamless third-party UI library integration: Mantine Wrapper Required
                            (MantineLayout)
                        </p>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                            This page is a <strong>proof of concept</strong> for <code>@ottabase/ui-mantine</code>.
                            Mantine requires its own provider (<code>MantineLayout</code>) scoped only to this route -
                            the core app and core layout are <em>not</em> affected. <code>MantineDemoRoute</code> wraps
                            this page in <code>MantineLayout</code> so there is zero overhead anywhere else in the app.
                            Apply the same wrapper pattern for any production route that needs Mantine.
                        </p>
                    </div>
                    {/* <Group mt="lg">
                        <Button component="a" href="/demo/shadcn" variant="outline">
                            Explore shadcn/ui demo
                        </Button>
                        <Button component="a" href="/demo/ottaeditor" variant="outline">
                            Explore OttaEditor demo
                        </Button>
                        <Button component="a" href="/demo/state" variant="outline">
                            Explore State demo
                        </Button>
                    </Group> */}
                </div>

                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={2} size="h3" mb="md">
                        Global State & Theme Demo
                    </Title>

                    <Stack gap="md">
                        <Group justify="space-between">
                            <Text>App Name:</Text>
                            <Badge variant="light">{appState.appName}</Badge>
                        </Group>

                        <Group justify="space-between">
                            <Text>Color Scheme (Light/Dark):</Text>
                            <Badge color={theme === 'dark' ? 'dark' : 'blue'}>{theme}</Badge>
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
                                        'mantine-slate',
                                        'mantine-graphite',
                                        'mantine-azure',
                                        'mantine-aurora',
                                        'mantine-artisan',
                                    ] as MantineThemePreset[]
                                ).map((preset) => (
                                    <Button
                                        key={preset}
                                        size="sm"
                                        variant={mantineTheme === preset ? 'filled' : 'outline'}
                                        onClick={() => setMantineTheme(preset)}
                                    >
                                        {preset.replace('mantine-', '')}
                                    </Button>
                                ))}
                            </Group>
                            <Text size="xs" c="dimmed" mt="xs">
                                Current: <Code>{mantineTheme}</Code>
                            </Text>
                        </div>

                        <Group justify="space-between">
                            <Text>Sidebar Open:</Text>
                            <Switch
                                checked={sidebarState.isOpen}
                                onChange={(event) =>
                                    setSidebarState({
                                        ...sidebarState,
                                        isOpen: event.currentTarget.checked,
                                    })
                                }
                            />
                        </Group>

                        <Group justify="space-between">
                            <Text>Is Loading:</Text>
                            <Badge variant="light">{appState.isLoading ? 'Yes' : 'No'}</Badge>
                        </Group>

                        <Group justify="space-between">
                            <Text>Is Authenticated:</Text>
                            <Badge variant="light" color={appState.isAuthenticated ? 'green' : 'gray'}>
                                {appState.isAuthenticated ? 'Yes' : 'No'}
                            </Badge>
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
                        onPageChange={(page) => console.log('Page changed to:', page)}
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
                                <Code block mt="xs" style={{ fontSize: '11px' }}>
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
                                    style={{
                                        fontSize: '11px',
                                        maxHeight: '150px',
                                        overflow: 'auto',
                                    }}
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
                                {Object.keys(MANTINE_DEMO_THEME_COLORS).map((colorName) => (
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
