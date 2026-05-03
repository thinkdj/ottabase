import { expenseGroupHooks, expenseHooks, expenseMemberHooks, expenseSplitHooks } from '@/hooks/expenseHooks';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseMembersManager } from './components/ExpenseMembersManager';
import { NaturalExpenseInput } from './components/NaturalExpenseInput';
import { SettlementSummary } from './components/SettlementSummary';

export function ExpenseGroupPage() {
    const { groupId } = useParams({ from: '/expenses/$groupId' });
    const groupQuery = expenseGroupHooks.useDetail(groupId);
    const membersQuery = expenseMemberHooks.useList({ where: { groupId }, orderBy: 'name', orderDirection: 'asc' });
    const expensesQuery = expenseHooks.useList({ where: { groupId }, orderBy: 'expenseDate', orderDirection: 'desc' });
    const splitsQuery = expenseSplitHooks.useList({ limit: 500 });

    const group = groupQuery.data;
    const members = membersQuery.data || [];
    const expenses = expensesQuery.data || [];
    const expenseIds = new Set(expenses.map((expense) => expense.id));
    const splits = (splitsQuery.data || []).filter((split) => expenseIds.has(split.expenseId));

    if (groupQuery.isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }

    if (!group) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Expense group not found</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline">
                        <Link to="/expenses">Back to groups</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
                        <Link to="/expenses">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Expense groups
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">{group.name}</h1>
                        <Badge>{group.currency}</Badge>
                    </div>
                    <p className="text-muted-foreground">
                        Add expenses from a sentence and review the generated split.
                    </p>
                </div>
            </div>

            <NaturalExpenseInput groupId={groupId} />

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                    <ExpenseList expenses={expenses} splits={splits} members={members} />
                </div>
                <div className="space-y-4">
                    <ExpenseMembersManager groupId={groupId} members={members} />
                    <SettlementSummary
                        expenses={expenses}
                        splits={splits}
                        members={members}
                        currency={group.currency}
                    />
                </div>
            </div>
        </div>
    );
}
