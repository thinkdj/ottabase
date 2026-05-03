import { api } from '@/lib/api';
import type {
    ExpenseGroupMemberRecord,
    ExpenseGroupRecord,
    ExpenseRecord,
    ExpenseSplitRecord,
    NaturalExpenseResponse,
} from '@/types/expenses';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const expenseGroupHooks = createModelHooks<ExpenseGroupRecord>({ entityName: 'expense_groups' });
export const expenseMemberHooks = createModelHooks<ExpenseGroupMemberRecord>({ entityName: 'expense_group_members' });
export const expenseHooks = createModelHooks<ExpenseRecord>({ entityName: 'expenses' });
export const expenseSplitHooks = createModelHooks<ExpenseSplitRecord>({ entityName: 'expense_splits' });

export function useCreateNaturalExpense(groupId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: string) =>
            api<NaturalExpenseResponse>(`/api/expense-groups/${encodeURIComponent(groupId)}/natural-expense`, {
                method: 'POST',
                body: { input },
            }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['expenses'] }),
                queryClient.invalidateQueries({ queryKey: ['expense_splits'] }),
                queryClient.invalidateQueries({ queryKey: ['expense_group_members'] }),
            ]);
        },
    });
}
