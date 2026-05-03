import { getSession } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { Expense, ExpenseGroup, ExpenseGroupMember, ExpenseSplit } from '../../ottabase/models/Expense';
import { parseNaturalExpenseInput } from '../../ottabase/expenses/naturalExpenseParser';
import { getAuthOptions, getSecurityContext } from '../lib/auth-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

interface NaturalExpenseBody {
    input?: string;
}

function normalizeName(name: string) {
    return name.trim().replace(/\s+/g, ' ');
}

async function ensureExpenseMember(params: {
    groupId: string;
    name: string;
    appId: string;
    organizationId: string | null | undefined;
    userId: string | null | undefined;
    existingMembers: ExpenseGroupMember[];
}) {
    const normalizedName = normalizeName(params.name);
    const existing = params.existingMembers.find(
        (member) => String(member.get('name') || '').toLowerCase() === normalizedName.toLowerCase(),
    );
    if (existing) return existing;

    const member = await ExpenseGroupMember.create({
        groupId: params.groupId,
        name: normalizedName,
        appId: params.appId,
        organizationId: params.organizationId ?? null,
        userId: params.userId ?? null,
    } as any);
    params.existingMembers.push(member);
    return member;
}

export async function handleNaturalExpenseCreate(context: ApiRouteContext, groupId: string): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<NaturalExpenseBody>(request);
    const input = body.input?.trim();
    if (!input) {
        return errorResponse('Natural language expense input is required', 400, { code: 'VALIDATION_ERROR' });
    }

    const group = await ExpenseGroup.find(groupId);
    if (!group) {
        return errorResponse('Expense group not found', 404, { code: 'NOT_FOUND' });
    }

    const session = await getSession(request, env as any, getAuthOptions(env));
    const securityContext = await getSecurityContext(request, session);
    const appId = securityContext.appId || String(group.get('appId') || 'web');
    const organizationId = securityContext.organizationId ?? (group.get('organizationId') as string | null) ?? null;
    const userId = securityContext.userId ?? (group.get('userId') as string | null) ?? null;
    const members = await ExpenseGroupMember.where({ groupId });
    const knownMembers = members.map((member) => String(member.get('name') || '')).filter(Boolean);

    let parsed;
    try {
        parsed = parseNaturalExpenseInput(input, { knownMembers });
    } catch (err) {
        return errorResponse(err instanceof Error ? err.message : 'Could not parse expense input', 400, {
            code: 'PARSE_ERROR',
        });
    }

    const paidByMember = parsed.paidByName
        ? await ensureExpenseMember({
              groupId,
              name: parsed.paidByName,
              appId,
              organizationId,
              userId,
              existingMembers: members,
          })
        : null;

    const expense = await Expense.create({
        groupId,
        appId,
        organizationId,
        userId,
        description: parsed.description,
        merchant: parsed.merchant ?? null,
        expenseDate: parsed.expenseDate,
        amount: parsed.amount,
        currency: parsed.currency,
        paidByMemberId: paidByMember?.get('id') ?? null,
        rawInput: input,
    } as any);

    const splits = [];
    for (const split of parsed.splits) {
        const member = await ensureExpenseMember({
            groupId,
            name: split.memberName,
            appId,
            organizationId,
            userId,
            existingMembers: members,
        });
        const createdSplit = await ExpenseSplit.create({
            expenseId: expense.get('id'),
            memberId: member.get('id'),
            appId,
            organizationId,
            userId,
            amount: split.amount,
            splitType: split.splitType,
            note: split.note ?? null,
        } as any);
        splits.push({ ...createdSplit.toJson(), memberName: member.get('name') });
    }

    return jsonResponse(
        {
            expense: expense.toJson(),
            splits,
            parsed,
            members: members.map((member) => member.toJson()),
        },
        201,
    );
}
