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
import { ActionsEditor } from './ActionsEditor';

const heroFieldsSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    subtitle: z.string().optional(),
    body: z.string().optional(),
});

type HeroFormValues = z.infer<typeof heroFieldsSchema>;

type Props = {
    section: HomepageSectionRow | undefined;
};

export function HeroTab({ section }: Props) {
    const queryClient = useQueryClient();
    const updateSection = sectionHooks.useUpdate();

    const form = useForm<HeroFormValues>({
        resolver: zodResolver(heroFieldsSchema),
        defaultValues: {
            title: section?.title ?? '',
            subtitle: section?.subtitle ?? '',
            body: section?.body ?? '',
        },
    });

    useEffect(() => {
        form.reset({
            title: section?.title ?? '',
            subtitle: section?.subtitle ?? '',
            body: section?.body ?? '',
        });
    }, [section?.id, section?.title, section?.subtitle, section?.body, form]);

    const onSubmit = (values: HeroFormValues) => {
        if (!section?.id) {
            toast.error('Hero section missing');
            return;
        }
        updateSection.mutate(
            {
                id: section.id,
                data: {
                    title: values.title,
                    subtitle: values.subtitle || null,
                    body: values.body || null,
                },
            },
            {
                onSuccess: () => {
                    toast.success('Hero saved');
                    void queryClient.invalidateQueries();
                },
                onError: () => toast.error('Failed to save hero'),
            },
        );
    };

    return (
        <div className="space-y-6">
            <Card className="border-border dark:border-border">
                <CardHeader>
                    <CardTitle>Hero copy</CardTitle>
                    <CardDescription className="dark:text-muted-foreground">
                        Title, subtitle, and body text. Buttons are managed below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!section ? (
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                            No hero section. Seed defaults first.
                        </p>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Title</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="max-w-xl dark:border-border" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="subtitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subtitle (optional)</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="max-w-2xl dark:border-border" />
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
                                                <Textarea
                                                    {...field}
                                                    rows={4}
                                                    className="max-w-2xl dark:border-border"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={updateSection.isPending}>
                                    Save hero copy
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
            <ActionsEditor
                sectionId={section?.id}
                title="Hero actions"
                description="Primary and secondary buttons under the hero."
            />
        </div>
    );
}
