export interface ParsedExpenseSplit {
    memberName: string;
    amount: number;
    splitType: 'fixed' | 'equal';
    note?: string;
}

export interface ParsedExpenseInput {
    description: string;
    merchant?: string;
    expenseDate: number;
    amount: number;
    currency: string;
    paidByName?: string;
    splits: ParsedExpenseSplit[];
    confidence: number;
    warnings: string[];
}

interface ParserOptions {
    now?: Date;
    knownMembers?: string[];
}

const MONTHS: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
};

const CURRENCY_ALIASES: Record<string, string> = {
    yen: 'JPY',
    jpy: 'JPY',
    usd: 'USD',
    dollar: 'USD',
    dollars: 'USD',
    eur: 'EUR',
    euro: 'EUR',
    euros: 'EUR',
    inr: 'INR',
    rupee: 'INR',
    rupees: 'INR',
    gbp: 'GBP',
    pound: 'GBP',
    pounds: 'GBP',
};

function normalizeName(name: string) {
    return name.trim().replace(/\s+/g, ' ');
}

function canonicalMemberName(name: string, knownMembers: string[]) {
    const normalized = normalizeName(name);
    const match = knownMembers.find((member) => member.toLowerCase() === normalized.toLowerCase());
    return match || normalized.replace(/^./, (char) => char.toUpperCase());
}

function parseIntegerAmount(value: string) {
    return Math.round(Number(value.replace(/,/g, '')));
}

function parseDate(input: string, now: Date) {
    const lower = input.toLowerCase();
    const dateWithMonth = lower.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\b/);
    if (dateWithMonth) {
        const day = Number(dateWithMonth[1]);
        const month = MONTHS[dateWithMonth[2]];
        const year = dateWithMonth[3] ? Number(dateWithMonth[3]) : now.getFullYear();
        if (month !== undefined && day >= 1 && day <= 31) {
            return new Date(year, month, day).getTime();
        }
    }

    const isoDate = lower.match(/\bon\s+(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (isoDate) {
        return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])).getTime();
    }

    if (/\byesterday\b/.test(lower)) {
        const date = new Date(now);
        date.setDate(date.getDate() - 1);
        return date.getTime();
    }

    if (/\btoday\b/.test(lower)) {
        return now.getTime();
    }

    return now.getTime();
}

function removeParsedFragments(input: string) {
    return input
        .replace(/\bon\s+\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s+\d{4})?\b/gi, ' ')
        .replace(/\bon\s+\d{4}-\d{1,2}-\d{1,2}\b/gi, ' ')
        .replace(/\b(today|yesterday)\b/gi, ' ')
        .replace(/\b\d[\d,]*(?:\.\d+)?\s*(yen|jpy|usd|dollars?|eur|euros?|inr|rupees?|gbp|pounds?)\b/gi, ' ')
        .replace(/\b\d[\d,]*\s+(?:for|to)\s+[a-z][a-z .'-]*\b/gi, ' ')
        .replace(/\b(rest|remainder|remaining)\s+(?:is\s+)?(?:shared\s+)?equally\s+(?:between|among|with)\s+.+$/i, ' ')
        .replace(/\bpaid\s+by\s+[a-z][a-z .'-]*\b/gi, ' ')
        .replace(/\s+[,.]+/g, ' ')
        .replace(/[,.]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitNames(value: string, knownMembers: string[]) {
    return value
        .split(/,|\band\b|\+/i)
        .map((name) => name.replace(/\b(rest|remainder|remaining|shared|equally|between|among|with)\b/gi, ''))
        .map(normalizeName)
        .filter(Boolean)
        .map((name) => canonicalMemberName(name, knownMembers));
}

export function parseNaturalExpenseInput(input: string, options: ParserOptions = {}): ParsedExpenseInput {
    const now = options.now || new Date();
    const knownMembers = options.knownMembers || [];
    const warnings: string[] = [];
    const normalizedInput = input.trim();
    const lower = normalizedInput.toLowerCase();

    const amountMatch = lower.match(
        /\b(\d[\d,]*(?:\.\d+)?)\s*(yen|jpy|usd|dollars?|eur|euros?|inr|rupees?|gbp|pounds?)\b/,
    );
    if (!amountMatch) {
        throw new Error('Could not find a total amount and currency. Try: "10000 yen".');
    }

    const amount = parseIntegerAmount(amountMatch[1]);
    const currency = CURRENCY_ALIASES[amountMatch[2]] || amountMatch[2].toUpperCase();
    const expenseDate = parseDate(normalizedInput, now);

    const fixedSplits: ParsedExpenseSplit[] = [];
    const fixedRegex =
        /\b(\d[\d,]*)\s+(?:for|to)\s+([a-z][a-z .'-]*?)(?=\s*,|\s+and\s+\d|\s+rest\b|\s+remainder\b|\s+remaining\b|$)/gi;
    let fixedMatch: RegExpExecArray | null;
    while ((fixedMatch = fixedRegex.exec(normalizedInput)) !== null) {
        fixedSplits.push({
            memberName: canonicalMemberName(fixedMatch[2], knownMembers),
            amount: parseIntegerAmount(fixedMatch[1]),
            splitType: 'fixed',
            note: 'Fixed amount from natural language input',
        });
    }

    const equalNamesMatch = normalizedInput.match(
        /\b(?:rest|remainder|remaining)\s+(?:is\s+)?(?:shared\s+)?equally\s+(?:between|among|with)\s+(.+)$/i,
    );
    const equalNames = equalNamesMatch ? splitNames(equalNamesMatch[1], knownMembers) : [];

    const fixedTotal = fixedSplits.reduce((sum, split) => sum + split.amount, 0);
    const remaining = amount - fixedTotal;
    if (remaining < 0) {
        throw new Error('Fixed split amounts exceed the total expense amount.');
    }

    const equalSplits: ParsedExpenseSplit[] = [];
    if (equalNames.length > 0) {
        const base = Math.floor(remaining / equalNames.length);
        const remainder = remaining % equalNames.length;
        equalNames.forEach((memberName, index) => {
            equalSplits.push({
                memberName,
                amount: base + (index < remainder ? 1 : 0),
                splitType: 'equal',
                note: 'Equal share of remaining amount',
            });
        });
    } else if (remaining > 0) {
        warnings.push('No equal-share members were found for the remaining amount.');
    }

    const paidByMatch = normalizedInput.match(/\bpaid\s+by\s+([a-z][a-z .'-]*?)(?=\s*,|\s+on\b|$)/i);
    const paidByName = paidByMatch ? canonicalMemberName(paidByMatch[1], knownMembers) : undefined;
    const description = removeParsedFragments(normalizedInput) || 'Expense';
    const merchant = description.split(/\s+/).slice(0, 3).join(' ');
    const confidence = Math.max(
        0.4,
        Math.min(1, 0.55 + (fixedSplits.length ? 0.15 : 0) + (equalSplits.length ? 0.2 : 0)),
    );

    return {
        description,
        merchant,
        expenseDate,
        amount,
        currency,
        paidByName,
        splits: [...fixedSplits, ...equalSplits],
        confidence,
        warnings,
    };
}
