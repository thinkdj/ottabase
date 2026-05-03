import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { expenseGroupMembersTable, expenseGroupsTable, expensesTable, expenseSplitsTable } from './Expense.schema';

export {
    expenseGroupMembersTable,
    expenseGroupsTable,
    expensesTable,
    expenseSplitsTable,
    type ExpenseGroupMemberRow,
    type ExpenseGroupRow,
    type ExpenseRow,
    type ExpenseSplitRow,
} from './Expense.schema';

const tenantFields: Pick<ModelFields, 'appId' | 'organizationId' | 'userId'> = {
    appId: { type: 'string', editable: true, filterable: true },
    organizationId: { type: 'string', editable: true, filterable: true },
    userId: { type: 'string', editable: true, filterable: true },
};

export class ExpenseGroup extends BaseModel {
    static entity = 'expense_groups';
    static table = expenseGroupsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        ...tenantFields,
        name: { type: 'string', editable: true, searchable: true, sortable: true },
        currency: { type: 'string', editable: true, filterable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    protected static validationRules = {
        name: { rules: 'required|max:100', fieldName: 'Name' },
    };
}

export class ExpenseGroupMember extends BaseModel {
    static entity = 'expense_group_members';
    static table = expenseGroupMembersTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        groupId: { type: 'string', editable: true, filterable: true },
        ...tenantFields,
        name: { type: 'string', editable: true, searchable: true, sortable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    protected static validationRules = {
        groupId: { rules: 'required', fieldName: 'Group' },
        name: { rules: 'required|max:80', fieldName: 'Name' },
    };
}

export class Expense extends BaseModel {
    static entity = 'expenses';
    static table = expensesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        groupId: { type: 'string', editable: true, filterable: true },
        ...tenantFields,
        description: { type: 'string', editable: true, searchable: true, sortable: true },
        merchant: { type: 'string', editable: true, searchable: true },
        expenseDate: { type: 'date', editable: true, sortable: true },
        amount: { type: 'number', editable: true, sortable: true },
        currency: { type: 'string', editable: true, filterable: true },
        paidByMemberId: { type: 'string', editable: true, filterable: true },
        rawInput: { type: 'string', editable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
        updatedAt: { type: 'date', editable: false, sortable: true },
    };

    protected static validationRules = {
        groupId: { rules: 'required', fieldName: 'Group' },
        description: { rules: 'required|max:200', fieldName: 'Description' },
    };
}

export class ExpenseSplit extends BaseModel {
    static entity = 'expense_splits';
    static table = expenseSplitsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        expenseId: { type: 'string', editable: true, filterable: true },
        groupId: { type: 'string', editable: true, filterable: true },
        memberId: { type: 'string', editable: true, filterable: true },
        ...tenantFields,
        amount: { type: 'number', editable: true, sortable: true },
        splitType: { type: 'string', editable: true, filterable: true },
        note: { type: 'string', editable: true },
        createdAt: { type: 'date', editable: false, sortable: true },
    };

    protected static validationRules = {
        expenseId: { rules: 'required', fieldName: 'Expense' },
        memberId: { rules: 'required', fieldName: 'Member' },
    };
}
