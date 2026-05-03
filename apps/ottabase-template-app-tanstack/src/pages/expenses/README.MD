# Expense Groups

Expense groups track shared spending and support natural language expense entry.

## Natural language input

The group page has an input at the top that accepts sentences like:

```text
Osaka Haiku restaurant dinner on 29 may 10000 yen 5000 for Chris, rest shared equally between Kevin and dj
```

The parser extracts:

- description: `Osaka Haiku restaurant dinner`
- date: `29 May` in the current year
- total: `10000 JPY`
- fixed split: `5000` for Chris
- remaining split: `2500` each for Kevin and dj

Names are matched against existing group members case-insensitively. New names are created automatically when mentioned in a valid input.

## Module layout

- `ottabase/models/Expense.schema.ts` — Drizzle schemas
- `ottabase/models/Expense.ts` — OttaORM models
- `ottabase/expenses/naturalExpenseParser.ts` — rule-based parser
- `worker/routes/expenses.ts` — natural language creation endpoint
- `src/hooks/expenseHooks.ts` — client hooks
- `src/pages/expenses/` — pages, components, and UI helpers
