import type { ExpenseGroupMemberRecord, ExpenseRecord, ExpenseSplitRecord } from '@/types/expenses';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { CalendarDays, ReceiptText } from 'lucide-react';
import { formatExpenseAmount, memberNameById } from '../expense-utils';

interface ExpenseListProps {
    expenses: ExpenseRecord[];
    splits: ExpenseSplitRecord[];
    members: ExpenseGroupMemberRecord[];
}

export function ExpenseList({ expenses, splits, members }: ExpenseListProps) {
    const names = memberNameById(members);
    const splitsByExpense = new Map<string, ExpenseSplitRecord[]>();
    for (const split of splits) {
        const existing = splitsByExpense.get(split.expenseId) || [];
        existing.push(split);
        splitsByExpense.set(split.expenseId, existing);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <ReceiptText className="h-4 w-4" />
                    Expenses
                </CardTitle>
            </CardHeader>
            <CardContent>
                {expenses.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No expenses yet. Try the natural language input above.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {expenses.map((expense) => (
                            <div key={expense.id} className="rounded-lg border p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 className="font-medium">{expense.description}</h3>
                                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                            <CalendarDays className="h-3 w-3" />
                                            {new Date(expense.expenseDate).toLocaleDateString()}
                                            {expense.paidByMemberId
                                                ? ` · paid by ${names.get(expense.paidByMemberId) || 'Unknown'}`
                                                : ''}
                                        </p>
                                    </div>
                                    <Badge>{formatExpenseAmount(expense.amount, expense.currency)}</Badge>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(splitsByExpense.get(expense.id) || []).map((split) => (
                                        <Badge key={split.id} variant="outline">
                                            {names.get(split.memberId) || 'Unknown'}:{' '}
                                            {formatExpenseAmount(split.amount, expense.currency)}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
