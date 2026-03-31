import { zodResolver } from '@hookform/resolvers/zod';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
    Textarea,
} from '@ottabase/ui-shadcn';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { sectionHooks, type HomepageSectionRow } from '../homepage-model-hooks';

const aboutSchema = z.object({
    title: z.string().optional(),
    body: z.string().optional(),
});

type AboutFormValues = z.infer<typeof aboutSchema>;

type Props = {
    section: HomepageSectionRow | undefined;
};

export function AboutTab({ section }: Props) {
    const queryClient = useQueryClient();
    const updateSection = sectionHooks.useUpdate();

    const form = useForm<AboutFormValues>({
        resolver: zodResolver(aboutSchema),
        defaultValues: {
            title: section?.title ?? '',
            body: section?.body ?? '',
        },
    });

    useEffect(() => {
        form.reset({
            title: section?.title ?? '',
            body: section?.body ?? '',
        });
    }, [section?.id, section?.title, section?.body, form]);

    const onSubmit = (values: AboutFormValues) => {
        if (!section?.id) {
            toast.error('About section missing');
            return;
        }
        updateSection.mutate(
            {
                id: section.id,
                data: {
                    title: values.title?.trim() || null,
                    body: values.body?.trim() || null,
                },
            },
            {
                onSuccess: () => {
                    toast.success('About saved');
                    void queryClient.invalidateQueries();
                },
                onError: () => toast.error('Failed to save about'),
            },
        );
    };

    return (
        <Card className="border-border dark:border-border">
            <CardHeader>
                <CardTitle>About page content</CardTitle>
                <CardDescription className="dark:text-muted-foreground">
                    Used by the Next.js `/about` route when wired to the public payload.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!section ? (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        No about section. Seed defaults first.
                    </p>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title (optional)</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="max-w-xl dark:border-border" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="body"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Body (optional)</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} rows={12} className="max-w-3xl dark:border-border" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={updateSection.isPending}>
                                Save about
                            </Button>
                        </form>
                    </Form>
                )}
            </CardContent>
        </Card>
    );
}
