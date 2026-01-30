import {
    // Layout & Structure
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    AspectRatio,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Separator,
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,

    // Feedback & Status
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Progress,
    Skeleton,
    Spinner,
    toast,
    Toaster,

    // Forms & Inputs
    Button,
    ButtonGroup,
    ButtonGroupSeparator,
    ButtonGroupText,
    Checkbox,
    Input,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupText,
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
    InputOTPSeparator,
    Label,
    NativeSelect,
    NativeSelectOption,
    RadioGroup,
    RadioGroupItem,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Slider,
    Switch,
    Textarea,

    // Advanced Forms
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,

    // Navigation
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,

    // Overlays & Dialogs
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,

    // Menus
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarTrigger,

    // Display & Media
    Avatar,
    AvatarFallback,
    AvatarImage,
    Calendar,
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    Empty,
    EmptyDescription,
    EmptyTitle,
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
    ScrollArea,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,

    // Utilities
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Kbd,
    KbdGroup,
    Toggle,
    ToggleGroup,
    ToggleGroupItem,
} from '@ottabase/ui-shadcn';
import { AlertCircle, ChevronDown, Mail, Menu, Search, Settings, User } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
    username: z.string().min(2, 'Username must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
});

export function ShadcnDemoPage() {
    const [progress, setProgress] = useState(33);
    const [sliderValue, setSliderValue] = useState([50]);
    const [enabled, setEnabled] = useState(true);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [otp, setOtp] = useState('');
    const [open, setOpen] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: '',
            email: '',
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        toast('Form submitted!', {
            description: JSON.stringify(values, null, 2),
        });
    }

    return (
        <div className="mx-auto w-full max-w-7xl space-y-8 pb-16">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                        <Link to="/demo">← Back to Demo Gallery</Link>
                    </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        shadcn/ui
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight">Complete Component Showcase</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    shadcn/ui components from <code>@ottabase/ui-shadcn</code> organized by category.
                </p>
            </div>

            {/* Feedback & Status */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Feedback & Status</h2>

                <Card>
                    <CardHeader>
                        <CardTitle>Alerts</CardTitle>
                        <CardDescription>Display important messages</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Heads up!</AlertTitle>
                            <AlertDescription>This is a default alert with an icon.</AlertDescription>
                        </Alert>
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>Something went wrong with your request.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Badges & Progress</CardTitle>
                        <CardDescription>Visual status indicators</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-wrap gap-2">
                            <Badge>Default</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                            <Badge variant="destructive">Destructive</Badge>
                            <Badge variant="outline">Outline</Badge>
                        </div>

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

                        <div className="flex items-center gap-4">
                            <Spinner />
                            <span className="text-sm text-muted-foreground">Loading...</span>
                        </div>

                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Forms & Inputs */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Forms & Inputs</h2>

                <Card>
                    <CardHeader>
                        <CardTitle>Basic Inputs</CardTitle>
                        <CardDescription>Standard form controls</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="you@example.com" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="note">Note</Label>
                            <Textarea id="note" placeholder="Type something…" rows={3} />
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
                                    {enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Slider</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={sliderValue}
                                    onValueChange={setSliderValue}
                                    max={100}
                                    className="flex-1"
                                />
                                <span className="w-12 text-sm text-muted-foreground">{sliderValue[0]}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Advanced Inputs</CardTitle>
                        <CardDescription>Specialized input components</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Input Group</Label>
                            <InputGroup>
                                <InputGroupAddon>
                                    <Mail className="h-4 w-4" />
                                </InputGroupAddon>
                                <InputGroupInput placeholder="Email address" />
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton size="icon-xs">
                                        <Search className="h-3 w-3" />
                                    </InputGroupButton>
                                </InputGroupAddon>
                            </InputGroup>
                        </div>

                        <div className="space-y-2">
                            <Label>Input OTP</Label>
                            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                </InputOTPGroup>
                                <InputOTPSeparator />
                                <InputOTPGroup>
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>

                        <div className="space-y-2">
                            <Label>Select</Label>
                            <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose an option" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="option1">Option 1</SelectItem>
                                    <SelectItem value="option2">Option 2</SelectItem>
                                    <SelectItem value="option3">Option 3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Native Select</Label>
                            <NativeSelect>
                                <NativeSelectOption value="">Choose...</NativeSelectOption>
                                <NativeSelectOption value="1">Option 1</NativeSelectOption>
                                <NativeSelectOption value="2">Option 2</NativeSelectOption>
                                <NativeSelectOption value="3">Option 3</NativeSelectOption>
                            </NativeSelect>
                        </div>

                        <div className="space-y-2">
                            <Label>Radio Group</Label>
                            <RadioGroup defaultValue="option1">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="option1" id="r1" />
                                    <Label htmlFor="r1">Option 1</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="option2" id="r2" />
                                    <Label htmlFor="r2">Option 2</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Form with Validation</CardTitle>
                        <CardDescription>Using React Hook Form + Zod</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input placeholder="johndoe" {...field} />
                                            </FormControl>
                                            <FormDescription>This is your public display name.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="john@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit">Submit</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Field Component</CardTitle>
                        <CardDescription>Alternative form field system</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Field>
                            <FieldLabel>Project name</FieldLabel>
                            <FieldContent>
                                <Input placeholder="My awesome project" />
                                <FieldDescription>Choose a descriptive name for your project.</FieldDescription>
                            </FieldContent>
                        </Field>
                    </CardContent>
                </Card>
            </section>

            {/* Buttons & Groups */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Buttons & Actions</h2>

                <Card>
                    <CardHeader>
                        <CardTitle>Button Variants</CardTitle>
                        <CardDescription>Different button styles</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Button>Default</Button>
                            <Button variant="secondary">Secondary</Button>
                            <Button variant="destructive">Destructive</Button>
                            <Button variant="outline">Outline</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Button variant="link">Link</Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button size="sm">Small</Button>
                            <Button>Default</Button>
                            <Button size="lg">Large</Button>
                            <Button size="icon">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Button Group</CardTitle>
                        <CardDescription>Group related buttons</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ButtonGroup>
                            <Button variant="outline">Left</Button>
                            <Button variant="outline">Center</Button>
                            <Button variant="outline">Right</Button>
                        </ButtonGroup>

                        <ButtonGroup>
                            <Button variant="outline">Action 1</Button>
                            <ButtonGroupSeparator />
                            <Button variant="outline">Action 2</Button>
                            <ButtonGroupSeparator />
                            <Button variant="outline">Action 3</Button>
                        </ButtonGroup>

                        <ButtonGroup>
                            <ButtonGroupText>
                                <User className="h-4 w-4" />
                                <span>User</span>
                            </ButtonGroupText>
                            <Button variant="outline">Edit</Button>
                        </ButtonGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Toggle & Toggle Group</CardTitle>
                        <CardDescription>Toggle buttons for selections</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Toggle>Toggle me</Toggle>

                        <ToggleGroup type="single">
                            <ToggleGroupItem value="a">A</ToggleGroupItem>
                            <ToggleGroupItem value="b">B</ToggleGroupItem>
                            <ToggleGroupItem value="c">C</ToggleGroupItem>
                        </ToggleGroup>
                    </CardContent>
                </Card>
            </section>

            {/* Navigation */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Navigation</h2>

                <Card>
                    <CardHeader>
                        <CardTitle>Breadcrumbs</CardTitle>
                        <CardDescription>Show current page location</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="#">Home</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="#">Demo</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Shadcn</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Pagination</CardTitle>
                        <CardDescription>Navigate through pages</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious href="#" />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink href="#">1</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink href="#" isActive>
                                        2
                                    </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink href="#">3</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext href="#" />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tabs</CardTitle>
                        <CardDescription>Organize content by category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="tab1">
                            <TabsList>
                                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                                <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                            </TabsList>
                            <TabsContent value="tab1" className="mt-4">
                                Content for tab 1
                            </TabsContent>
                            <TabsContent value="tab2" className="mt-4">
                                Content for tab 2
                            </TabsContent>
                            <TabsContent value="tab3" className="mt-4">
                                Content for tab 3
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </section>

            {/* Dialogs & Overlays */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Dialogs & Overlays</h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dialog</CardTitle>
                            <CardDescription>Modal dialog</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline">Open Dialog</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Dialog Title</DialogTitle>
                                        <DialogDescription>This is a dialog description</DialogDescription>
                                    </DialogHeader>
                                    <p>Dialog content goes here</p>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Alert Dialog</CardTitle>
                            <CardDescription>Confirmation dialogs</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline">Delete Item</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Drawer</CardTitle>
                            <CardDescription>Slide-out panel</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Drawer>
                                <DrawerTrigger asChild>
                                    <Button variant="outline">Open Drawer</Button>
                                </DrawerTrigger>
                                <DrawerContent>
                                    <DrawerHeader>
                                        <DrawerTitle>Drawer Title</DrawerTitle>
                                        <DrawerDescription>Drawer description</DrawerDescription>
                                    </DrawerHeader>
                                    <div className="p-4">Drawer content</div>
                                    <DrawerFooter>
                                        <DrawerClose asChild>
                                            <Button variant="outline">Close</Button>
                                        </DrawerClose>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sheet</CardTitle>
                            <CardDescription>Side sheet panel</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline">Open Sheet</Button>
                                </SheetTrigger>
                                <SheetContent>
                                    <SheetHeader>
                                        <SheetTitle>Sheet Title</SheetTitle>
                                        <SheetDescription>Sheet description</SheetDescription>
                                    </SheetHeader>
                                    <div className="py-4">Sheet content</div>
                                </SheetContent>
                            </Sheet>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Popover</CardTitle>
                            <CardDescription>Floating content</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline">Open Popover</Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <p className="text-sm">Popover content goes here</p>
                                </PopoverContent>
                            </Popover>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Hover Card</CardTitle>
                            <CardDescription>Hover to show</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <HoverCard>
                                <HoverCardTrigger asChild>
                                    <Button variant="link">@username</Button>
                                </HoverCardTrigger>
                                <HoverCardContent>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">@username</h4>
                                        <p className="text-sm text-muted-foreground">User bio and details</p>
                                    </div>
                                </HoverCardContent>
                            </HoverCard>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Menus */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Menus</h2>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dropdown Menu</CardTitle>
                            <CardDescription>Click to open</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        <Menu className="mr-2 h-4 w-4" />
                                        Menu
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>Profile</DropdownMenuItem>
                                    <DropdownMenuItem>Settings</DropdownMenuItem>
                                    <DropdownMenuItem>Logout</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Context Menu</CardTitle>
                            <CardDescription>Right-click me</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ContextMenu>
                                <ContextMenuTrigger className="flex h-32 w-full items-center justify-center rounded-md border border-dashed">
                                    Right click here
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                    <ContextMenuItem>Copy</ContextMenuItem>
                                    <ContextMenuItem>Paste</ContextMenuItem>
                                    <ContextMenuItem>Delete</ContextMenuItem>
                                </ContextMenuContent>
                            </ContextMenu>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Menubar</CardTitle>
                            <CardDescription>Menu bar navigation</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Menubar>
                                <MenubarMenu>
                                    <MenubarTrigger>File</MenubarTrigger>
                                    <MenubarContent>
                                        <MenubarItem>New</MenubarItem>
                                        <MenubarItem>Open</MenubarItem>
                                    </MenubarContent>
                                </MenubarMenu>
                                <MenubarMenu>
                                    <MenubarTrigger>Edit</MenubarTrigger>
                                    <MenubarContent>
                                        <MenubarItem>Cut</MenubarItem>
                                        <MenubarItem>Copy</MenubarItem>
                                    </MenubarContent>
                                </MenubarMenu>
                            </Menubar>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Display & Media */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Display & Media</h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Avatar</CardTitle>
                            <CardDescription>User avatars</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src="https://github.com/shadcn.png" />
                                <AvatarFallback>CN</AvatarFallback>
                            </Avatar>
                            <Avatar>
                                <AvatarFallback>JD</AvatarFallback>
                            </Avatar>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Calendar</CardTitle>
                            <CardDescription>Date picker</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Carousel</CardTitle>
                            <CardDescription>Swipeable image carousel</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Carousel className="w-full max-w-xs mx-auto">
                                <CarouselContent>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <CarouselItem key={i}>
                                            <div className="p-1">
                                                <Card>
                                                    <CardContent className="flex aspect-square items-center justify-center p-6">
                                                        <span className="text-4xl font-semibold">{i}</span>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <CarouselPrevious />
                                <CarouselNext />
                            </Carousel>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Empty State</CardTitle>
                            <CardDescription>No data placeholder</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Empty>
                                <EmptyTitle>No results found</EmptyTitle>
                                <EmptyDescription>Try adjusting your search criteria</EmptyDescription>
                            </Empty>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Item List</CardTitle>
                            <CardDescription>Structured list items</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ItemGroup>
                                <Item>
                                    <ItemMedia variant="icon">
                                        <User className="h-4 w-4" />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>John Doe</ItemTitle>
                                        <ItemDescription>Software Engineer</ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <Button size="sm" variant="ghost">
                                            View
                                        </Button>
                                    </ItemActions>
                                </Item>
                            </ItemGroup>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Layout & Structure */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Layout & Structure</h2>

                <Card>
                    <CardHeader>
                        <CardTitle>Accordion</CardTitle>
                        <CardDescription>Collapsible sections</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>Section 1</AccordionTrigger>
                                <AccordionContent>Content for section 1</AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger>Section 2</AccordionTrigger>
                                <AccordionContent>Content for section 2</AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Collapsible</CardTitle>
                        <CardDescription>Toggle content visibility</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Collapsible open={open} onOpenChange={setOpen}>
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    Toggle content
                                    <ChevronDown
                                        className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                                    />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 rounded-md border p-4">
                                This content can be collapsed
                            </CollapsibleContent>
                        </Collapsible>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Resizable Panels</CardTitle>
                        <CardDescription>Adjustable panel layout</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResizablePanelGroup direction="horizontal" className="min-h-[200px] rounded-lg border">
                            <ResizablePanel defaultSize={50}>
                                <div className="flex h-full items-center justify-center p-6">
                                    <span className="font-semibold">Panel 1</span>
                                </div>
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel defaultSize={50}>
                                <div className="flex h-full items-center justify-center p-6">
                                    <span className="font-semibold">Panel 2</span>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Scroll Area</CardTitle>
                        <CardDescription>Custom scrollable area</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-48 rounded-md border p-4">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="py-2">
                                    Scrollable item {i + 1}
                                </div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Table</CardTitle>
                        <CardDescription>Data table</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell>John Doe</TableCell>
                                    <TableCell>john@example.com</TableCell>
                                    <TableCell>Admin</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Jane Smith</TableCell>
                                    <TableCell>jane@example.com</TableCell>
                                    <TableCell>User</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Aspect Ratio</CardTitle>
                        <CardDescription>Maintain aspect ratio</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AspectRatio ratio={16 / 9} className="bg-muted rounded-md">
                            <div className="flex h-full items-center justify-center">16:9 Aspect Ratio</div>
                        </AspectRatio>
                    </CardContent>
                </Card>
            </section>

            {/* Utilities */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Utilities</h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Command</CardTitle>
                            <CardDescription>Command palette</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Command className="rounded-lg border">
                                <CommandInput placeholder="Type a command..." />
                                <CommandList>
                                    <CommandEmpty>No results found.</CommandEmpty>
                                    <CommandGroup heading="Suggestions">
                                        <CommandItem>Calendar</CommandItem>
                                        <CommandItem>Search Emoji</CommandItem>
                                        <CommandItem>Calculator</CommandItem>
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kbd</CardTitle>
                            <CardDescription>Keyboard key display</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">Press</span>
                                <KbdGroup>
                                    <Kbd>⌘</Kbd>
                                    <Kbd>K</Kbd>
                                </KbdGroup>
                                <span className="text-sm">to open command palette</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Kbd>Ctrl</Kbd>
                                <span className="text-sm">+</span>
                                <Kbd>C</Kbd>
                                <span className="text-sm">to copy</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Tooltip</CardTitle>
                            <CardDescription>Helpful hints</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline">Hover me</Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>This is a tooltip</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Toast</CardTitle>
                            <CardDescription>Notification messages</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={() =>
                                    toast('Event Created', {
                                        description: 'Monday, January 3rd at 6:00pm',
                                    })
                                }
                            >
                                Show Toast
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Toaster</CardTitle>
                            <CardDescription>Toast notification container</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                                The Toaster component renders toast notifications. Click the buttons below to see
                                different toast types.
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={() =>
                                        toast.success('Success!', {
                                            description: 'Operation completed successfully',
                                        })
                                    }
                                    variant="outline"
                                >
                                    Success Toast
                                </Button>
                                <Button
                                    onClick={() =>
                                        toast.error('Error!', {
                                            description: 'Something went wrong',
                                        })
                                    }
                                    variant="outline"
                                >
                                    Error Toast
                                </Button>
                                <Button
                                    onClick={() =>
                                        toast.info('Info', {
                                            description: 'This is an informational message',
                                        })
                                    }
                                    variant="outline"
                                >
                                    Info Toast
                                </Button>
                                <Button
                                    onClick={() =>
                                        toast.warning('Warning!', {
                                            description: 'Please be careful',
                                        })
                                    }
                                    variant="outline"
                                >
                                    Warning Toast
                                </Button>
                                <Button
                                    onClick={() =>
                                        toast.loading('Loading...', {
                                            description: 'Processing your request',
                                        })
                                    }
                                    variant="outline"
                                >
                                    Loading Toast
                                </Button>
                            </div>
                            <Toaster />
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}
