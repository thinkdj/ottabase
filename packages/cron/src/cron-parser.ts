// Simple cron expression parser
// Supports standard 5-field cron expressions: minute hour day month weekday
//
// Examples:
// - "* * * * *"       = every minute
// - "0 * * * *"       = every hour
// - "0 0 * * *"       = daily at midnight
// - "0 0 * * 0"       = weekly on Sunday
// - "0 0 1 * *"       = monthly on 1st
// - "*/5 * * * *"     = every 5 minutes
// - "0 9-17 * * 1-5"  = 9am-5pm weekdays

interface CronField {
  values: number[];
  step?: number;
}

/**
 * Parse a single cron field
 */
function parseField(field: string, min: number, max: number): CronField {
  const values: number[] = [];

  // Handle step values (e.g., */5, 10-20/3)
  let step: number | undefined;
  let fieldPart = field;

  if (field.includes("/")) {
    const [base, stepStr] = field.split("/");
    const parsedStep = parseInt(stepStr, 10);
    if (isNaN(parsedStep) || parsedStep <= 0) {
      throw new Error(`Invalid step value: "${stepStr}"`);
    }
    step = parsedStep;
    fieldPart = base === "*" ? `${min}-${max}` : base;
  }

  // Handle wildcard
  if (fieldPart === "*") {
    for (let i = min; i <= max; i++) {
      values.push(i);
    }
    return { values, step };
  }

  // Handle comma-separated values
  const parts = fieldPart.split(",");

  for (const part of parts) {
    // Handle ranges (e.g., 1-5)
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      // Validate range values
      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid range: "${part}"`);
      }

      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max && !values.includes(i)) {
          values.push(i);
        }
      }
    } else {
      const value = parseInt(part, 10);
      if (isNaN(value)) {
        throw new Error(`Invalid value: "${part}"`);
      }
      if (value >= min && value <= max && !values.includes(value)) {
        values.push(value);
      }
    }
  }

  // Apply step: generate values starting from minimum, incrementing by step
  // Standard cron semantics: start from the first value, add step repeatedly
  if (step && values.length > 0) {
    const sortedValues = values.sort((a, b) => a - b);
    const startValue = sortedValues[0];
    const endValue = sortedValues[sortedValues.length - 1];
    const stepped: number[] = [];

    // Generate stepped values from start to end
    for (let i = startValue; i <= endValue; i += step) {
      stepped.push(i);
    }

    return { values: stepped, step };
  }

  return { values: values.sort((a, b) => a - b), step };
}

export interface ParsedCron {
  minutes: number[];
  hours: number[];
  days: number[];
  months: number[];
  weekdays: number[];
}

/**
 * Parse a cron expression into its component fields
 */
export function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: "${expression}". Expected 5 fields (minute hour day month weekday)`
    );
  }

  const [minute, hour, day, month, weekday] = parts;

  return {
    minutes: parseField(minute, 0, 59).values,
    hours: parseField(hour, 0, 23).values,
    days: parseField(day, 1, 31).values,
    months: parseField(month, 1, 12).values,
    weekdays: parseField(weekday, 0, 6).values, // 0 = Sunday
  };
}

/**
 * Check if a date matches a cron expression
 *
 * Standard cron behavior for day-of-month (DOM) and day-of-week (DOW):
 * - If both DOM and DOW are wildcards (*), day always matches
 * - If only one is wildcard, only the restricted field is checked
 * - If both are restricted, the date matches if EITHER field matches (OR logic)
 */
export function matchesCron(expression: string, date: Date): boolean {
  const cron = parseCron(expression);

  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1; // JS months are 0-indexed
  const weekday = date.getDay(); // 0 = Sunday

  // Check basic fields
  if (!cron.minutes.includes(minute)) return false;
  if (!cron.hours.includes(hour)) return false;
  if (!cron.months.includes(month)) return false;

  // Day/weekday matching uses OR logic when both are restricted
  const dayMatches = cron.days.includes(day);
  const weekdayMatches = cron.weekdays.includes(weekday);
  const dayIsWildcard = cron.days.length === 31;
  const weekdayIsWildcard = cron.weekdays.length === 7;

  if (dayIsWildcard && weekdayIsWildcard) {
    return true; // Both wildcards - always match
  } else if (dayIsWildcard) {
    return weekdayMatches; // Only check weekday
  } else if (weekdayIsWildcard) {
    return dayMatches; // Only check day
  } else {
    return dayMatches || weekdayMatches; // OR logic when both restricted
  }
}

/**
 * Get the next occurrence of a cron expression after a given date
 */
export function getNextRun(expression: string, after: Date = new Date()): Date {
  const cron = parseCron(expression);
  const next = new Date(after);

  // Start from the next minute
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  // Search for the next matching time (max 2 years ahead)
  const maxDate = new Date(after);
  maxDate.setFullYear(maxDate.getFullYear() + 2);

  while (next < maxDate) {
    const minute = next.getMinutes();
    const hour = next.getHours();
    const day = next.getDate();
    const month = next.getMonth() + 1;
    const weekday = next.getDay();

    // Check month
    if (!cron.months.includes(month)) {
      // Jump to next valid month
      const nextMonth = cron.months.find((m) => m > month) ?? cron.months[0];
      if (nextMonth <= month) {
        next.setFullYear(next.getFullYear() + 1);
      }
      next.setMonth(nextMonth - 1, 1);
      next.setHours(0, 0, 0, 0);
      continue;
    }

    // Check day of month and weekday
    // Both must match (standard cron behavior: day OR weekday)
    const dayMatches = cron.days.includes(day);
    const weekdayMatches = cron.weekdays.includes(weekday);

    // If both day and weekday are restricted (not *), use OR logic
    const dayIsWildcard = cron.days.length === 31;
    const weekdayIsWildcard = cron.weekdays.length === 7;

    const dayOk =
      dayIsWildcard && weekdayIsWildcard
        ? true
        : dayIsWildcard
          ? weekdayMatches
          : weekdayIsWildcard
            ? dayMatches
            : dayMatches || weekdayMatches;

    if (!dayOk) {
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      continue;
    }

    // Check hour
    if (!cron.hours.includes(hour)) {
      const nextHour = cron.hours.find((h) => h > hour);
      if (nextHour !== undefined) {
        next.setHours(nextHour, cron.minutes[0], 0, 0);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(cron.hours[0], cron.minutes[0], 0, 0);
      }
      continue;
    }

    // Check minute
    if (!cron.minutes.includes(minute)) {
      const nextMinute = cron.minutes.find((m) => m > minute);
      if (nextMinute !== undefined) {
        next.setMinutes(nextMinute, 0, 0);
      } else {
        next.setHours(next.getHours() + 1, cron.minutes[0], 0, 0);
      }
      continue;
    }

    // Found a match
    return next;
  }

  // Fallback - shouldn't happen with valid cron
  return next;
}

/**
 * Common cron presets
 */
export const CronPresets = {
  EVERY_MINUTE: "* * * * *",
  EVERY_5_MINUTES: "*/5 * * * *",
  EVERY_15_MINUTES: "*/15 * * * *",
  EVERY_30_MINUTES: "*/30 * * * *",
  HOURLY: "0 * * * *",
  DAILY: "0 0 * * *",
  DAILY_AT_9AM: "0 9 * * *",
  WEEKLY: "0 0 * * 0",
  MONTHLY: "0 0 1 * *",
  WEEKDAYS_9AM: "0 9 * * 1-5",
} as const;
