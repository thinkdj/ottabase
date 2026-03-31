import { zodResolver } from '@hookform/resolvers/zod';
import { homepageNavbarContentJsonSchema } from '@ottabase/homepage-contract';
import type { z } from 'zod';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
    Label,
} from '@ottabase/ui-shadcn';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { sectionHooks, type HomepageSectionRow } from '../homepage-model-hooks';

const schema = homepageNavbarContentJsonSchema;
type FormValues = z.infer<typeof schema>;

function defaultsFromSection(section: HomepageSectionRow | undefined): FormValues {
    const raw = section?.contentJson;
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return {
        title: section?.title?.trim() || 'Ottabase',
        githubUrl: '',
        links: [],
    };
}

type Props = {
    section: HomepageSectionRow | undefined;
};

export function NavbarTab({ section }: Props) {
    const queryClient = useQueryClient();
    const updateSection = sectionHooks.useUpdate();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultsFromSection(section),
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'links' });

    useEffect(() => {
        form.reset(defaultsFromSection(section));
    }, [section?.id, section?.contentJson, section?.title, form]);

    const onSubmit = (values: FormValues) => {
        if (!section?.id) {
            toast.error('Navbar section missing');
            return;
        }
        updateSection.mutate(
            {
                id: section.id,
                data: {
                    contentJson: values,
                    title: values.title,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Navbar saved');
                    void queryClient.invalidateQueries();
                },
                onError: () => toast.error('Failed to save navbar'),
            },
        );
    };

    if (!section) {
        return (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                No navbar section. Seed defaults first.
            </p>
        );
    }

    return (
        <Card className="border-border dark:border-border">
            <CardHeader>
                <CardTitle>Navbar content</CardTitle>
                <CardDescription className="dark:text-muted-foreground">
                    Title, GitHub URL, and inline links (stored in <code className="text-xs">content_json</code>).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Site title</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="max-w-md dark:border-border" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="githubUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>GitHub URL (optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value ?? ''}
                                            placeholder="https://github.com/…"
                                            className="max-w-xl font-mono text-sm dark:border-border"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <Label>Links</Label>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => append({ href: '/', label: 'New link' })}
                                >
                                    <IconPlus className="mr-1 size-4" aria-hidden />
                                    Add link
                                </Button>
                            </div>
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="grid gap-3 rounded-lg border border-border p-3 dark:border-border md:grid-cols-[1fr_1fr_auto_auto]"
                                >
                                    <FormField
                                        control={form.control}
                                        name={`links.${index}.label`}
                                        render={({ field: f }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Label</FormLabel>
                                                <FormControl>
                                                    <Input {...f} className="dark:border-border" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`links.${index}.href`}
                                        render={({ field: f }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Href</FormLabel>
                                                <FormControl>
                                                    <Input {...f} className="font-mono text-sm dark:border-border" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`links.${index}.external`}
                                        render={({ field: f }) => (
                                            <FormItem className="flex flex-row items-end gap-2 pb-2">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={Boolean(f.value)}
                                                        onCheckedChange={(c) => f.onChange(Boolean(c))}
                                                    />
                                                </FormControl>
                                                <FormLabel className="!mt-0 text-xs font-normal">External</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex items-end justify-end">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                                            <IconTrash className="size-4" aria-hidden />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button type="submit" disabled={updateSection.isPending}>
                            Save navbar
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
