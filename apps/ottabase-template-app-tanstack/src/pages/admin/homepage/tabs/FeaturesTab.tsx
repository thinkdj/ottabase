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
} from '@ottabase/ui-shadcn';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { sectionHooks, type HomepageSectionRow } from '../homepage-model-hooks';
import { FeaturesEditor } from './FeaturesEditor';

const featuresHeaderSchema = z.object({
    title: z.string().optional(),
});

type FeaturesHeaderValues = z.infer<typeof featuresHeaderSchema>;

type Props = {
    section: HomepageSectionRow | undefined;
};

export function FeaturesTab({ section }: Props) {
    const queryClient = useQueryClient();
    const updateSection = sectionHooks.useUpdate();

    const form = useForm<FeaturesHeaderValues>({
        resolver: zodResolver(featuresHeaderSchema),
        defaultValues: { title: section?.title ?? '' },
    });

    useEffect(() => {
        form.reset({ title: section?.title ?? '' });
    }, [section?.id, section?.title, form]);

    const onSubmit = (values: FeaturesHeaderValues) => {
        if (!section?.id) {
            toast.error('Features section missing');
            return;
        }
        updateSection.mutate(
            {
                id: section.id,
                data: { title: values.title?.trim() || null },
            },
            {
                onSuccess: () => {
                    toast.success('Section title saved');
                    void queryClient.invalidateQueries();
                },
                onError: () => toast.error('Failed to save'),
            },
        );
    };

    return (
        <div className="space-y-6">
            <Card className="border-border dark:border-border">
                <CardHeader>
                    <CardTitle>Features section</CardTitle>
                    <CardDescription className="dark:text-muted-foreground">
                        Optional heading above the feature grid.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!section ? (
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                            No features section. Seed defaults first.
                        </p>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Section title (optional)</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="max-w-xl dark:border-border" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={updateSection.isPending}>
                                    Save section title
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
            <FeaturesEditor sectionId={section?.id} />
        </div>
    );
}
