import { useCreateNaturalExpense } from '@/hooks/expenseHooks';
import { Alert, AlertDescription, Button, Textarea } from '@ottabase/ui-shadcn';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface NaturalExpenseInputProps {
    groupId: string;
}

const EXAMPLE_INPUT =
    'Osaka Haiku restaurant dinner on 29 may 10000 yen 5000 for Chris, rest shared equally between Kevin and dj';

export function NaturalExpenseInput({ groupId }: NaturalExpenseInputProps) {
    const [input, setInput] = useState('');
    const createNaturalExpense = useCreateNaturalExpense(groupId);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!input.trim()) return;

        try {
            const result = await createNaturalExpense.mutateAsync(input.trim());
            const warnings = result.parsed.warnings;
            toast.success('Expense added', {
                description: warnings.length ? warnings.join(' ') : result.parsed.description,
            });
            setInput('');
        } catch (err) {
            toast.error('Could not add expense', {
                description: err instanceof Error ? err.message : 'Please check the input and try again.',
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                    <h2 className="font-semibold">Add expense with natural language</h2>
                    <p className="text-sm text-muted-foreground">
                        Describe who paid, when, the total, and how to split the amount.
                    </p>
                </div>
            </div>
            <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={EXAMPLE_INPUT}
                className="min-h-24"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Alert className="py-2 text-xs sm:max-w-2xl">
                    <AlertDescription>
                        Example: <span className="font-medium">{EXAMPLE_INPUT}</span>
                    </AlertDescription>
                </Alert>
                <Button type="submit" disabled={!input.trim() || createNaturalExpense.isPending}>
                    {createNaturalExpense.isPending ? 'Adding…' : 'Add expense'}
                </Button>
            </div>
        </form>
    );
}
