import { expenseGroupHooks } from '@/hooks/expenseHooks';
import type { ExpenseGroupRecord } from '@/types/expenses';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Plus, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function ExpenseGroupsPage() {
    const [name, setName] = useState('');
    const groupsQuery = expenseGroupHooks.useList({ orderBy: 'createdAt', orderDirection: 'desc' });
    const createGroup = expenseGroupHooks.useCreate();

    const handleCreateGroup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return;

        const group = await createGroup.mutateAsync({
            name: trimmedName,
            currency: 'JPY',
        } as Partial<ExpenseGroupRecord>);
        setName('');
        toast.success('Expense group created', { description: group.name });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Expense groups</h1>
                <p className="text-muted-foreground">Track shared expenses and split them from natural language.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Create a group</CardTitle>
                    <CardDescription>Start a trip, dinner, or household expense group.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateGroup} className="flex gap-2">
                        <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Japan trip"
                        />
                        <Button type="submit" disabled={!name.trim() || createGroup.isPending}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(groupsQuery.data || []).map((group) => (
                    <Card key={group.id} className="transition-colors hover:border-primary/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ReceiptText className="h-4 w-4" />
                                {group.name}
                            </CardTitle>
                            <CardDescription>{new Date(group.createdAt).toLocaleDateString()}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <Badge variant="secondary">{group.currency}</Badge>
                            <Button asChild>
                                <Link to="/expenses/$groupId" params={{ groupId: group.id }}>
                                    Open
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!groupsQuery.isLoading && (groupsQuery.data || []).length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No expense groups yet. Create one above.
                </div>
            )}
        </div>
    );
}
