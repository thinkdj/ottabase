import { useState } from 'react';
import { SplitPane } from '@ottabase/ui-split-pane';
import { Container, Title, Text, Stack, Box, Paper, Group, Button, Code } from '@mantine/core';

export function SplitPaneDemoPage() {
    const [size1, setSize1] = useState<number>(50);
    const [size2, setSize2] = useState<number>(50);
    const [size3, setSize3] = useState<number>(50);

    return (
        <Container size="xl" py="xl">
            <Stack gap="xl">
                <div>
                    <Title order={1}>SplitPane Component Demo</Title>
                    <Text c="dimmed" mt="sm">
                        Minimal, clean split-pane component with no frills
                    </Text>
                </div>

                {/* Basic Vertical Split */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Basic Vertical Split</Title>
                            <Text size="sm" c="dimmed">
                                Simple vertical split with 50/50 default size
                            </Text>
                        </div>
                        <Box style={{ height: '300px', border: '1px solid #ddd' }}>
                            <SplitPane split="vertical" defaultSize="50%">
                                <Paper p="md" style={{ height: '100%', background: '#f8f9fa' }}>
                                    <Text fw={500}>Left Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Drag the divider to resize
                                    </Text>
                                </Paper>
                                <Paper p="md" style={{ height: '100%', background: '#e9ecef' }}>
                                    <Text fw={500}>Right Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        This pane will flex to fill remaining space
                                    </Text>
                                </Paper>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>

                {/* Basic Horizontal Split */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Basic Horizontal Split</Title>
                            <Text size="sm" c="dimmed">
                                Simple horizontal split with 40/60 default size
                            </Text>
                        </div>
                        <Box style={{ height: '300px', border: '1px solid #ddd' }}>
                            <SplitPane split="horizontal" defaultSize="40%">
                                <Paper p="md" style={{ height: '100%', background: '#f8f9fa' }}>
                                    <Text fw={500}>Top Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        40% of the height
                                    </Text>
                                </Paper>
                                <Paper p="md" style={{ height: '100%', background: '#e9ecef' }}>
                                    <Text fw={500}>Bottom Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Fills remaining 60%
                                    </Text>
                                </Paper>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>

                {/* Nested Split Panes */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Nested Split Panes</Title>
                            <Text size="sm" c="dimmed">
                                Create complex layouts by nesting split panes
                            </Text>
                        </div>
                        <Box style={{ height: '400px', border: '1px solid #ddd' }}>
                            <SplitPane split="vertical" defaultSize="30%">
                                <Paper p="md" style={{ height: '100%', background: '#f8f9fa' }}>
                                    <Text fw={500}>Sidebar</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Fixed width sidebar
                                    </Text>
                                </Paper>
                                <SplitPane split="horizontal" defaultSize="50%">
                                    <Paper p="md" style={{ height: '100%', background: '#e9ecef' }}>
                                        <Text fw={500}>Top Content</Text>
                                        <Text size="sm" c="dimmed" mt="xs">
                                            Nested horizontal split
                                        </Text>
                                    </Paper>
                                    <Paper p="md" style={{ height: '100%', background: '#dee2e6' }}>
                                        <Text fw={500}>Bottom Content</Text>
                                        <Text size="sm" c="dimmed" mt="xs">
                                            You can nest as many levels as needed
                                        </Text>
                                    </Paper>
                                </SplitPane>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>

                {/* Styled Split Pane */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Styled Split Pane</Title>
                            <Text size="sm" c="dimmed">
                                Customize the appearance with custom styles
                            </Text>
                        </div>
                        <Box style={{ height: '300px', border: '1px solid #ddd' }}>
                            <SplitPane
                                split="vertical"
                                defaultSize="50%"
                                resizerStyle={{
                                    background: '#228be6',
                                    opacity: 0.6,
                                }}
                                pane1Style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    padding: '1rem',
                                }}
                                pane2Style={{
                                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                    color: 'white',
                                    padding: '1rem',
                                }}
                            >
                                <div>
                                    <Text fw={700} size="lg">
                                        Styled Left Pane
                                    </Text>
                                    <Text size="sm" mt="xs">
                                        Custom gradient background
                                    </Text>
                                </div>
                                <div>
                                    <Text fw={700} size="lg">
                                        Styled Right Pane
                                    </Text>
                                    <Text size="sm" mt="xs">
                                        Different gradient background
                                    </Text>
                                </div>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>

                {/* Snap Points */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Snap Points</Title>
                            <Text size="sm" c="dimmed">
                                Define specific positions where the divider will snap
                            </Text>
                        </div>
                        <Box style={{ height: '300px', border: '1px solid #ddd' }}>
                            <SplitPane
                                split="vertical"
                                defaultSize={300}
                                snapPoints={[200, 400, 600]}
                                snapThreshold={30}
                                onChange={setSize2}
                            >
                                <Paper p="md" style={{ height: '100%', background: '#f8f9fa' }}>
                                    <Text fw={500}>Left Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Snap points at: 200px, 400px, 600px
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Current size: <Code>{Math.round(size2)}px</Code>
                                    </Text>
                                </Paper>
                                <Paper p="md" style={{ height: '100%', background: '#e9ecef' }}>
                                    <Text fw={500}>Right Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Drag the divider and it will snap to the nearest point when within 30px
                                    </Text>
                                </Paper>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>

                {/* Percentage Configuration */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Percentage Configuration</Title>
                            <Text size="sm" c="dimmed">
                                Use percentage-based sizing for responsive layouts
                            </Text>
                        </div>
                        <Box style={{ height: '300px', border: '1px solid #ddd' }}>
                            <SplitPane split="vertical" defaultSize="33%" minSize={100} onChange={setSize3}>
                                <Paper p="md" style={{ height: '100%', background: '#f8f9fa' }}>
                                    <Text fw={500}>33% Default Width</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Current size: <Code>{Math.round(size3)}%</Code>
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Minimum size: 100px
                                    </Text>
                                </Paper>
                                <Paper p="md" style={{ height: '100%', background: '#e9ecef' }}>
                                    <Text fw={500}>67% Remaining</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Resize the window to see the percentage-based behavior
                                    </Text>
                                </Paper>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>

                {/* Min/Max Constraints */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Min/Max Constraints</Title>
                            <Text size="sm" c="dimmed">
                                Limit the resizing range with minSize and maxSize
                            </Text>
                        </div>
                        <Box style={{ height: '300px', border: '1px solid #ddd' }}>
                            <SplitPane
                                split="vertical"
                                defaultSize={300}
                                minSize={150}
                                maxSize={500}
                                onChange={setSize1}
                            >
                                <Paper p="md" style={{ height: '100%', background: '#f8f9fa' }}>
                                    <Text fw={500}>Constrained Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Min: 150px, Max: 500px
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Current: <Code>{Math.round(size1)}px</Code>
                                    </Text>
                                </Paper>
                                <Paper p="md" style={{ height: '100%', background: '#e9ecef' }}>
                                    <Text fw={500}>Right Pane</Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        Try dragging - the left pane can't go below 150px or above 500px
                                    </Text>
                                </Paper>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>

                {/* Complex Nested Example */}
                <Paper shadow="sm" p="md" withBorder>
                    <Stack gap="md">
                        <div>
                            <Title order={3}>Complex Nested Layout</Title>
                            <Text size="sm" c="dimmed">
                                IDE-like layout with multiple nested panes
                            </Text>
                        </div>
                        <Box style={{ height: '500px', border: '1px solid #ddd' }}>
                            <SplitPane split="vertical" defaultSize="20%">
                                {/* Sidebar */}
                                <Paper p="md" style={{ height: '100%', background: '#2c3e50', color: 'white' }}>
                                    <Text fw={700}>Explorer</Text>
                                    <Text size="xs" c="gray.4" mt="xs">
                                        File tree would go here
                                    </Text>
                                </Paper>

                                {/* Main area */}
                                <SplitPane split="vertical" defaultSize="70%">
                                    {/* Editor area */}
                                    <SplitPane split="horizontal" defaultSize="70%">
                                        <Paper p="md" style={{ height: '100%', background: '#1e1e1e', color: 'white' }}>
                                            <Text fw={700}>Editor</Text>
                                            <Text size="xs" c="gray.4" mt="xs">
                                                Code editor would go here
                                            </Text>
                                        </Paper>
                                        <Paper p="md" style={{ height: '100%', background: '#252526', color: 'white' }}>
                                            <Text fw={700}>Terminal</Text>
                                            <Text size="xs" c="gray.4" mt="xs">
                                                Terminal output
                                            </Text>
                                        </Paper>
                                    </SplitPane>

                                    {/* Right panel */}
                                    <SplitPane split="horizontal" defaultSize="50%">
                                        <Paper p="md" style={{ height: '100%', background: '#37474f', color: 'white' }}>
                                            <Text fw={700}>Properties</Text>
                                            <Text size="xs" c="gray.4" mt="xs">
                                                Component properties
                                            </Text>
                                        </Paper>
                                        <Paper p="md" style={{ height: '100%', background: '#455a64', color: 'white' }}>
                                            <Text fw={700}>Console</Text>
                                            <Text size="xs" c="gray.4" mt="xs">
                                                Debug console
                                            </Text>
                                        </Paper>
                                    </SplitPane>
                                </SplitPane>
                            </SplitPane>
                        </Box>
                    </Stack>
                </Paper>
            </Stack>
        </Container>
    );
}
