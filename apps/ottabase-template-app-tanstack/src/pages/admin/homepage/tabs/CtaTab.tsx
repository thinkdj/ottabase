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

const ctaFieldsSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
});

type CtaFormValues = z.infer<typeof ctaFieldsSchema>;

type Props = {
    section: HomepageSectionRow | undefined;
};

export function CtaTab({ section }: Props) {
    const queryClient = useQueryClient();
    const updateSection = sectionHooks.useUpdate();

    const form = useForm<CtaFormValues>({
        resolver: zodResolver(ctaFieldsSchema),
        defaultValues: {
            title: section?.title ?? '',
            description: section?.description ?? '',
        },
    });

    useEffect(() => {
        form.reset({
            title: section?.title ?? '',
            description: section?.description ?? '',
        });
    }, [section?.id, section?.title, section?.description, form]);

    const onSubmit = (values: CtaFormValues) => {
        if (!section?.id) {
            toast.error('CTA section missing');
            return;
        }
        updateSection.mutate(
            {
                id: section.id,
                data: {
                    title: values.title,
                    description: values.description || null,
                },
            },
            {
                onSuccess: () => {
                    toast.success('CTA saved');
                    void queryClient.invalidateQueries();
                },
                onError: () => toast.error('Failed to save CTA'),
            },
        );
    };

    return (
        <div className="space-y-6">
            <Card className="border-border dark:border-border">
                <CardHeader>
                    <CardTitle>Call to action</CardTitle>
                    <CardDescription className="dark:text-muted-foreground">
                        Headline and supporting line for the CTA block.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!section ? (
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                            No CTA section. Seed defaults first.
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
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description (optional)</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    rows={3}
                                                    className="max-w-2xl dark:border-border"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={updateSection.isPending}>
                                    Save CTA copy
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
            <ActionsEditor
                sectionId={section?.id}
                title="CTA actions"
                description="Buttons shown in the CTA section."
            />
        </div>
    );
}
