import type { ExpenseGroupMemberRecord, ExpenseRecord, ExpenseSplitRecord } from '@/types/expenses';

export function formatExpenseAmount(amount: number, currency: string) {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
}

export function memberNameById(members: ExpenseGroupMemberRecord[]) {
    return new Map(members.map((member) => [member.id, member.name]));
}

export function calculateMemberBalances(expenses: ExpenseRecord[], splits: ExpenseSplitRecord[]) {
    const paid = new Map<string, number>();
    const owed = new Map<string, number>();

    for (const expense of expenses) {
        if (expense.paidByMemberId) {
            paid.set(expense.paidByMemberId, (paid.get(expense.paidByMemberId) || 0) + expense.amount);
        }
    }

    for (const split of splits) {
        owed.set(split.memberId, (owed.get(split.memberId) || 0) + split.amount);
    }

    const memberIds = new Set([...paid.keys(), ...owed.keys()]);
    return Array.from(memberIds).map((memberId) => ({
        memberId,
        paid: paid.get(memberId) || 0,
        owed: owed.get(memberId) || 0,
        balance: (paid.get(memberId) || 0) - (owed.get(memberId) || 0),
    }));
}
