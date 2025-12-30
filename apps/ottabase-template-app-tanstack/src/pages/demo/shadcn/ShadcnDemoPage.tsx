import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Input,
    Label,
    Progress,
    Separator,
    Slider,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    toast,
} from "@ottabase/ui-shadcn";
import { AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

export function ShadcnDemoPage() {
    const [progress, setProgress] = useState(33);
    const [sliderValue, setSliderValue] = useState([50]);
    const [enabled, setEnabled] = useState(true);

    return (
        <div className="mx-auto w-full max-w-5xl space-y-8">
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                    <Button
                        asChild
                        variant="ghost"
                        className="w-fit text-muted-foreground hover:text-foreground"
                    >
                        <Link to="/demo">← Back to Demo Gallery</Link>
                    </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        TanStack
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        shadcn/ui Component Showcase
                    </h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    A lightweight, TanStack-friendly sample of components from{" "}
                    <code>@ottabase/ui-shadcn</code>.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Accordion</CardTitle>
                    <CardDescription>
                        A vertically stacked set of interactive headings
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Is it accessible?</AccordionTrigger>
                            <AccordionContent>
                                Yes. It follows the WAI-ARIA design pattern.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger>Is it styled?</AccordionTrigger>
                            <AccordionContent>
                                Yes. It matches the rest of the component system.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Alert</CardTitle>
                    <CardDescription>Callouts for user attention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Heads up!</AlertTitle>
                        <AlertDescription>
                            This demo runs in a Vite + TanStack Router app.
                        </AlertDescription>
                    </Alert>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Example Error</AlertTitle>
                        <AlertDescription>
                            Replace this with real error states in your UI.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Inputs</CardTitle>
                    <CardDescription>Common form controls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="you@example.com" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="note">Note</Label>
                        <Textarea id="note" placeholder="Type something…" />
                    </div>
                    <Separator />
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Checkbox id="terms" />
                            <Label htmlFor="terms">Accept terms</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch checked={enabled} onCheckedChange={setEnabled} />
                            <span className="text-sm text-muted-foreground">
                                {enabled ? "Enabled" : "Disabled"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Progress + Slider</CardTitle>
                    <CardDescription>Visual feedback and value selection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm text-muted-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} />
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setProgress(25)}>
                                25%
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setProgress(50)}>
                                50%
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setProgress(100)}>
                                100%
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Slider</span>
                            <span className="text-sm text-muted-foreground">
                                {sliderValue[0]}
                            </span>
                        </div>
                        <Slider value={sliderValue} onValueChange={setSliderValue} max={100} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tabs</CardTitle>
                    <CardDescription>Organize content by category</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="actions">Actions</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview" className="mt-4 space-y-2">
                            <p className="text-sm text-muted-foreground">
                                This page intentionally avoids Next.js-only APIs.
                            </p>
                        </TabsContent>
                        <TabsContent value="actions" className="mt-4 space-y-2">
                            <Button
                                onClick={() =>
                                    toast("Toast", {
                                        description: "Toasts work via ShadcnProviders.",
                                    })
                                }
                            >
                                Show toast
                            </Button>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
