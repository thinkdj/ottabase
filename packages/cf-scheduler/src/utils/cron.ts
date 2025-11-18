/**
 * Cron expression utilities
 */

import { FREQUENCY_CRON_MAP, type ScheduleFrequency } from '../types';

/**
 * Get cron expression from frequency
 */
export function getCronExpression(
  frequency: ScheduleFrequency,
  customExpression?: string
): string {
  if (frequency === 'custom') {
    if (!customExpression) {
      throw new Error('Custom frequency requires cron expression');
    }
    return customExpression;
  }
  return FREQUENCY_CRON_MAP[frequency];
}

/**
 * Parse cron expression to get next run time
 * Simple implementation for common patterns
 */
export function getNextRunTime(cronExpression: string, from: Date = new Date()): Date {
  const next = new Date(from);

  // Parse cron: minute hour day month dayOfWeek
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression format');
  }

  const [minutePart, hourPart, , , ] = parts;

  // Handle simple cases (*/N and fixed values)
  if (minutePart.startsWith('*/')) {
    const interval = parseInt(minutePart.slice(2), 10);
    next.setMinutes(Math.ceil(next.getMinutes() / interval) * interval, 0, 0);
  } else if (minutePart === '*') {
    next.setMinutes(next.getMinutes() + 1, 0, 0);
  } else {
    const targetMinute = parseInt(minutePart, 10);
    if (next.getMinutes() >= targetMinute) {
      next.setHours(next.getHours() + 1);
    }
    next.setMinutes(targetMinute, 0, 0);
  }

  // Handle hours
  if (hourPart.startsWith('*/')) {
    const interval = parseInt(hourPart.slice(2), 10);
    const currentHour = next.getHours();
    const nextHour = Math.ceil(currentHour / interval) * interval;
    if (nextHour > currentHour) {
      next.setHours(nextHour, 0, 0, 0);
    }
  } else if (hourPart !== '*') {
    const targetHour = parseInt(hourPart, 10);
    if (next.getHours() > targetHour || (next.getHours() === targetHour && next.getMinutes() > 0)) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(targetHour, parseInt(minutePart === '*' ? '0' : minutePart, 10), 0, 0);
  }

  return next;
}

/**
 * Check if a task should run now based on cron expression
 */
export function shouldRunNow(cronExpression: string, lastRun?: Date): boolean {
  const now = new Date();

  if (!lastRun) {
    return true;
  }

  const nextRun = getNextRunTime(cronExpression, lastRun);
  return now >= nextRun;
}

/**
 * Validate cron expression format
 */
export function validateCronExpression(expression: string): boolean {
  const parts = expression.split(' ');
  if (parts.length !== 5) {
    return false;
  }

  // Basic validation for each part
  for (const part of parts) {
    if (part === '*') continue;
    if (part.startsWith('*/')) {
      const num = parseInt(part.slice(2), 10);
      if (isNaN(num) || num <= 0) return false;
      continue;
    }
    if (part.includes(',') || part.includes('-')) {
      // Range/list validation would go here
      continue;
    }
    const num = parseInt(part, 10);
    if (isNaN(num)) return false;
  }

  return true;
}
