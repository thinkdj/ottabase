import { useState } from 'react';
import { SplitPane } from '@ottabase/ui-split-pane';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';

export function SplitPaneDemoPage() {
    const [size1, setSize1] = useState<number>(50);
    const [size2, setSize2] = useState<number>(50);
    const [size3, setSize3] = useState<number>(50);

    return (
        <div className="container mx-auto py-8">
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">SplitPane Component Demo</h1>
                    <p className="text-muted-foreground mt-2">Minimal, clean split-pane component with no frills</p>
                </div>

                {/* Basic Vertical Split */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Vertical Split</CardTitle>
                        <CardDescription>Simple vertical split with 50/50 default size</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] border rounded">
                            <SplitPane split="vertical" defaultSize="50%">
                                <div className="h-full p-4 bg-muted/30">
                                    <p className="font-medium">Left Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">Drag the divider to resize</p>
                                </div>
                                <div className="h-full p-4 bg-muted/50">
                                    <p className="font-medium">Right Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        This pane will flex to fill remaining space
                                    </p>
                                </div>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Basic Horizontal Split */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Horizontal Split</CardTitle>
                        <CardDescription>Simple horizontal split with 40/60 default size</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] border rounded">
                            <SplitPane split="horizontal" defaultSize="40%">
                                <div className="h-full p-4 bg-muted/30">
                                    <p className="font-medium">Top Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">40% of the height</p>
                                </div>
                                <div className="h-full p-4 bg-muted/50">
                                    <p className="font-medium">Bottom Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">Fills remaining 60%</p>
                                </div>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Nested Split Panes */}
                <Card>
                    <CardHeader>
                        <CardTitle>Nested Split Panes</CardTitle>
                        <CardDescription>Create complex layouts by nesting split panes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px] border rounded">
                            <SplitPane split="vertical" defaultSize="30%">
                                <div className="h-full p-4 bg-muted/30">
                                    <p className="font-medium">Sidebar</p>
                                    <p className="text-sm text-muted-foreground mt-1">Fixed width sidebar</p>
                                </div>
                                <SplitPane split="horizontal" defaultSize="50%">
                                    <div className="h-full p-4 bg-muted/50">
                                        <p className="font-medium">Top Content</p>
                                        <p className="text-sm text-muted-foreground mt-1">Nested horizontal split</p>
                                    </div>
                                    <div className="h-full p-4 bg-muted/70">
                                        <p className="font-medium">Bottom Content</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            You can nest as many levels as needed
                                        </p>
                                    </div>
                                </SplitPane>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Styled Split Pane */}
                <Card>
                    <CardHeader>
                        <CardTitle>Styled Split Pane</CardTitle>
                        <CardDescription>Customize the appearance with custom styles</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] border rounded">
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
                                    <p className="text-lg font-bold">Styled Left Pane</p>
                                    <p className="text-sm mt-2">Custom gradient background</p>
                                </div>
                                <div>
                                    <p className="text-lg font-bold">Styled Right Pane</p>
                                    <p className="text-sm mt-2">Different gradient background</p>
                                </div>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Snap Points */}
                <Card>
                    <CardHeader>
                        <CardTitle>Snap Points</CardTitle>
                        <CardDescription>Define specific positions where the divider will snap</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] border rounded">
                            <SplitPane
                                split="vertical"
                                defaultSize={300}
                                snapPoints={[200, 400, 600]}
                                snapThreshold={30}
                                onChange={setSize2}
                            >
                                <div className="h-full p-4 bg-muted/30">
                                    <p className="font-medium">Left Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Snap points at: 200px, 400px, 600px
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Current size:{' '}
                                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
                                            {Math.round(size2)}px
                                        </code>
                                    </p>
                                </div>
                                <div className="h-full p-4 bg-muted/50">
                                    <p className="font-medium">Right Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Drag the divider and it will snap to the nearest point when within 30px
                                    </p>
                                </div>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Percentage Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>Percentage Configuration</CardTitle>
                        <CardDescription>Use percentage-based sizing for responsive layouts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] border rounded">
                            <SplitPane split="vertical" defaultSize="33%" minSize={100} onChange={setSize3}>
                                <div className="h-full p-4 bg-muted/30">
                                    <p className="font-medium">33% Default Width</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Current size:{' '}
                                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
                                            {Math.round(size3)}%
                                        </code>
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">Minimum size: 100px</p>
                                </div>
                                <div className="h-full p-4 bg-muted/50">
                                    <p className="font-medium">67% Remaining</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Resize the window to see the percentage-based behavior
                                    </p>
                                </div>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Min/Max Width Constraints */}
                <Card>
                    <CardHeader>
                        <CardTitle>Min/Max Width Constraints</CardTitle>
                        <CardDescription>
                            Limit the resizing range with minWidth and maxWidth for vertical splits
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] border rounded">
                            <SplitPane
                                split="vertical"
                                defaultSize={300}
                                minWidth={150}
                                maxWidth={500}
                                onChange={setSize1}
                            >
                                <div className="h-full p-4 bg-muted/30">
                                    <p className="font-medium">Constrained Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Min Width: 150px, Max Width: 500px
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Current:{' '}
                                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
                                            {Math.round(size1)}px
                                        </code>
                                    </p>
                                </div>
                                <div className="h-full p-4 bg-muted/50">
                                    <p className="font-medium">Right Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Try dragging - the left pane width can't go below 150px or above 500px
                                    </p>
                                </div>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Min/Max Height Constraints */}
                <Card>
                    <CardHeader>
                        <CardTitle>Min/Max Height Constraints</CardTitle>
                        <CardDescription>
                            Limit the resizing range with minHeight and maxHeight for horizontal splits
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px] border rounded">
                            <SplitPane split="horizontal" defaultSize={150} minHeight={100} maxHeight={250}>
                                <div className="h-full p-4 bg-muted/30">
                                    <p className="font-medium">Top Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Min Height: 100px, Max Height: 250px
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Try dragging - this pane's height is constrained
                                    </p>
                                </div>
                                <div className="h-full p-4 bg-muted/50">
                                    <p className="font-medium">Bottom Pane</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        This pane flexes to fill the remaining space
                                    </p>
                                </div>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>

                {/* Complex Nested Example */}
                <Card>
                    <CardHeader>
                        <CardTitle>Complex Nested Layout</CardTitle>
                        <CardDescription>IDE-like layout with multiple nested panes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[500px] border rounded">
                            <SplitPane split="vertical" defaultSize="20%">
                                {/* Sidebar */}
                                <div className="h-full p-4" style={{ background: '#2c3e50', color: 'white' }}>
                                    <p className="font-bold">Explorer</p>
                                    <p className="text-xs text-gray-400 mt-1">File tree would go here</p>
                                </div>

                                {/* Main area */}
                                <SplitPane split="vertical" defaultSize="70%">
                                    {/* Editor area */}
                                    <SplitPane split="horizontal" defaultSize="70%">
                                        <div className="h-full p-4" style={{ background: '#1e1e1e', color: 'white' }}>
                                            <p className="font-bold">Editor</p>
                                            <p className="text-xs text-gray-400 mt-1">Code editor would go here</p>
                                        </div>
                                        <div className="h-full p-4" style={{ background: '#252526', color: 'white' }}>
                                            <p className="font-bold">Terminal</p>
                                            <p className="text-xs text-gray-400 mt-1">Terminal output</p>
                                        </div>
                                    </SplitPane>

                                    {/* Right panel */}
                                    <SplitPane split="horizontal" defaultSize="50%">
                                        <div className="h-full p-4" style={{ background: '#37474f', color: 'white' }}>
                                            <p className="font-bold">Properties</p>
                                            <p className="text-xs text-gray-400 mt-1">Component properties</p>
                                        </div>
                                        <div className="h-full p-4" style={{ background: '#455a64', color: 'white' }}>
                                            <p className="font-bold">Console</p>
                                            <p className="text-xs text-gray-400 mt-1">Debug console</p>
                                        </div>
                                    </SplitPane>
                                </SplitPane>
                            </SplitPane>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
