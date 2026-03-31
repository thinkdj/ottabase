import { zodResolver } from '@hookform/resolvers/zod';
import { homepageFooterContentJsonSchema } from '@ottabase/homepage-contract';
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

const schema = homepageFooterContentJsonSchema;
type FormValues = z.infer<typeof schema>;

function defaultsFromSection(section: HomepageSectionRow | undefined): FormValues {
    const raw = section?.contentJson;
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return {
        siteName: section?.title?.trim() || 'Ottabase',
        tagline: section?.description ?? '',
        links: [],
    };
}

type Props = {
    section: HomepageSectionRow | undefined;
};

export function FooterTab({ section }: Props) {
    const queryClient = useQueryClient();
    const updateSection = sectionHooks.useUpdate();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: defaultsFromSection(section),
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'links' });

    useEffect(() => {
        form.reset(defaultsFromSection(section));
    }, [section?.id, section?.contentJson, section?.title, section?.description, form]);

    const onSubmit = (values: FormValues) => {
        if (!section?.id) {
            toast.error('Footer section missing');
            return;
        }
        updateSection.mutate(
            {
                id: section.id,
                data: {
                    contentJson: values,
                    title: values.siteName,
                    description: values.tagline ?? '',
                },
            },
            {
                onSuccess: () => {
                    toast.success('Footer saved');
                    void queryClient.invalidateQueries();
                },
                onError: () => toast.error('Failed to save footer'),
            },
        );
    };

    if (!section) {
        return (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                No footer section. Seed defaults first.
            </p>
        );
    }

    return (
        <Card className="border-border dark:border-border">
            <CardHeader>
                <CardTitle>Footer content</CardTitle>
                <CardDescription className="dark:text-muted-foreground">
                    Site name, tagline, and footer links.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="siteName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Site name</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="max-w-md dark:border-border" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="tagline"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tagline (optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            value={field.value ?? ''}
                                            className="max-w-xl dark:border-border"
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
                            Save footer
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
