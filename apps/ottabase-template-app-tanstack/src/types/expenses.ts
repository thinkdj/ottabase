export interface ExpenseGroupRecord {
    id: string;
    appId?: string;
    organizationId?: string | null;
    userId?: string | null;
    name: string;
    currency: string;
    createdAt: number;
    updatedAt: number;
}

export interface ExpenseGroupMemberRecord {
    id: string;
    groupId: string;
    name: string;
    createdAt: number;
    updatedAt: number;
}

export interface ExpenseRecord {
    id: string;
    groupId: string;
    description: string;
    merchant?: string | null;
    expenseDate: number;
    amount: number;
    currency: string;
    paidByMemberId?: string | null;
    rawInput?: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ExpenseSplitRecord {
    id: string;
    expenseId: string;
    memberId: string;
    amount: number;
    splitType: 'fixed' | 'equal' | string;
    note?: string | null;
    createdAt: number;
}

export interface NaturalExpenseResponse {
    expense: ExpenseRecord;
    splits: Array<ExpenseSplitRecord & { memberName?: string }>;
    parsed: {
        description: string;
        merchant?: string;
        expenseDate: number;
        amount: number;
        currency: string;
        paidByName?: string;
        splits: Array<{ memberName: string; amount: number; splitType: 'fixed' | 'equal'; note?: string }>;
        confidence: number;
        warnings: string[];
    };
    members: ExpenseGroupMemberRecord[];
}
