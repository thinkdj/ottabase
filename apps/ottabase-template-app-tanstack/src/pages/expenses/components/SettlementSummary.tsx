import type { ExpenseGroupMemberRecord, ExpenseRecord, ExpenseSplitRecord } from '@/types/expenses';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Scale } from 'lucide-react';
import { calculateMemberBalances, formatExpenseAmount, memberNameById } from '../expense-utils';

interface SettlementSummaryProps {
    expenses: ExpenseRecord[];
    splits: ExpenseSplitRecord[];
    members: ExpenseGroupMemberRecord[];
    currency: string;
}

export function SettlementSummary({ expenses, splits, members, currency }: SettlementSummaryProps) {
    const balances = calculateMemberBalances(expenses, splits);
    const names = memberNameById(members);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Scale className="h-4 w-4" />
                    Balances
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {balances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Balances appear after expenses are added.</p>
                ) : (
                    balances.map((balance) => (
                        <div
                            key={balance.memberId}
                            className="flex items-center justify-between gap-2 rounded-md border p-2"
                        >
                            <span className="text-sm font-medium">{names.get(balance.memberId) || 'Unknown'}</span>
                            <Badge variant={balance.balance >= 0 ? 'default' : 'secondary'}>
                                {formatExpenseAmount(balance.balance, currency)}
                            </Badge>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
