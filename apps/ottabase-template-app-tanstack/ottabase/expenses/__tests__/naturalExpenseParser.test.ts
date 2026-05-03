import { describe, expect, it } from 'vitest';
import { parseNaturalExpenseInput } from '../naturalExpenseParser';

describe('parseNaturalExpenseInput', () => {
    it('parses fixed amount plus equal remainder splits', () => {
        const result = parseNaturalExpenseInput(
            'Osaka Haiku restaurant dinner on 29 may 10000 yen 5000 for Chris, rest shared equally between Kevin and dj',
            {
                now: new Date(2026, 2, 31),
                knownMembers: ['Chris', 'Kevin', 'dj'],
            },
        );

        expect(result.description).toBe('Osaka Haiku restaurant dinner');
        expect(result.amount).toBe(10000);
        expect(result.currency).toBe('JPY');
        expect(new Date(result.expenseDate).getFullYear()).toBe(2026);
        expect(new Date(result.expenseDate).getMonth()).toBe(4);
        expect(new Date(result.expenseDate).getDate()).toBe(29);
        expect(result.splits).toEqual([
            expect.objectContaining({ memberName: 'Chris', amount: 5000, splitType: 'fixed' }),
            expect.objectContaining({ memberName: 'Kevin', amount: 2500, splitType: 'equal' }),
            expect.objectContaining({ memberName: 'dj', amount: 2500, splitType: 'equal' }),
        ]);
    });

    it('distributes odd remainders deterministically', () => {
        const result = parseNaturalExpenseInput(
            'Lunch 10001 yen 5000 for Chris, rest shared equally between Kevin and DJ',
            {
                now: new Date(2026, 2, 31),
            },
        );

        expect(result.splits.map((split) => split.amount)).toEqual([5000, 2501, 2500]);
    });

    it('throws when total amount is missing', () => {
        expect(() => parseNaturalExpenseInput('Dinner for Chris')).toThrow('Could not find a total amount');
    });
});
