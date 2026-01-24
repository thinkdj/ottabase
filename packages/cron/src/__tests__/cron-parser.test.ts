import { describe, it, expect } from "vitest";
import {
  parseCron,
  matchesCron,
  getNextRun,
  CronPresets,
} from "../cron-parser";

describe("parseCron", () => {
  it("should parse wildcard expression", () => {
    const result = parseCron("* * * * *");
    expect(result.minutes).toHaveLength(60);
    expect(result.hours).toHaveLength(24);
    expect(result.days).toHaveLength(31);
    expect(result.months).toHaveLength(12);
    expect(result.weekdays).toHaveLength(7);
  });

  it("should parse specific values", () => {
    const result = parseCron("30 9 15 6 3");
    expect(result.minutes).toEqual([30]);
    expect(result.hours).toEqual([9]);
    expect(result.days).toEqual([15]);
    expect(result.months).toEqual([6]);
    expect(result.weekdays).toEqual([3]);
  });

  it("should parse ranges", () => {
    const result = parseCron("0-5 9-17 1-15 1-6 1-5");
    expect(result.minutes).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(result.days).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(result.months).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it("should parse step values", () => {
    const result = parseCron("*/15 */2 * * *");
    expect(result.minutes).toEqual([0, 15, 30, 45]);
    expect(result.hours).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
  });

  it("should parse comma-separated values", () => {
    const result = parseCron("0,30 9,12,18 1,15 * *");
    expect(result.minutes).toEqual([0, 30]);
    expect(result.hours).toEqual([9, 12, 18]);
    expect(result.days).toEqual([1, 15]);
  });

  it("should throw on invalid expression", () => {
    expect(() => parseCron("* * *")).toThrow("Invalid cron expression");
    expect(() => parseCron("* * * * * *")).toThrow("Invalid cron expression");
  });

  it("should throw on invalid range values", () => {
    expect(() => parseCron("abc-5 * * * *")).toThrow("Invalid range");
    expect(() => parseCron("1-xyz * * * *")).toThrow("Invalid range");
  });

  it("should throw on invalid step values", () => {
    expect(() => parseCron("*/abc * * * *")).toThrow("Invalid step value");
    expect(() => parseCron("*/0 * * * *")).toThrow("Invalid step value");
    expect(() => parseCron("*/-1 * * * *")).toThrow("Invalid step value");
  });

  it("should throw on invalid single values", () => {
    expect(() => parseCron("abc * * * *")).toThrow("Invalid value");
  });
});

describe("matchesCron", () => {
  it("should match every minute", () => {
    const date = new Date("2024-06-15T10:30:00");
    expect(matchesCron("* * * * *", date)).toBe(true);
  });

  it("should match specific time", () => {
    const date = new Date("2024-06-15T09:30:00");
    expect(matchesCron("30 9 * * *", date)).toBe(true);
    expect(matchesCron("31 9 * * *", date)).toBe(false);
    expect(matchesCron("30 10 * * *", date)).toBe(false);
  });

  it("should match specific day", () => {
    const date = new Date("2024-06-15T00:00:00"); // Saturday
    expect(matchesCron("0 0 15 * *", date)).toBe(true);
    expect(matchesCron("0 0 16 * *", date)).toBe(false);
  });

  it("should match weekday", () => {
    const saturday = new Date("2024-06-15T00:00:00"); // Saturday = 6
    expect(matchesCron("0 0 * * 6", saturday)).toBe(true);
    expect(matchesCron("0 0 * * 0", saturday)).toBe(false); // Sunday

    const monday = new Date("2024-06-17T00:00:00"); // Monday = 1
    expect(matchesCron("0 0 * * 1", monday)).toBe(true);
  });

  it("should match month", () => {
    const june = new Date("2024-06-15T00:00:00");
    expect(matchesCron("0 0 15 6 *", june)).toBe(true);
    expect(matchesCron("0 0 15 7 *", june)).toBe(false);
  });

  // Tests for OR logic when both day and weekday are restricted
  describe("day/weekday OR logic", () => {
    it("should match when day matches but weekday does not (both restricted)", () => {
      // June 15, 2024 is a Saturday (weekday=6)
      // "0 0 15 * 1" = 15th of month OR Monday
      // Day 15 matches, but it's Saturday not Monday - should still match (OR logic)
      const date = new Date("2024-06-15T00:00:00");
      expect(matchesCron("0 0 15 * 1", date)).toBe(true);
    });

    it("should match when weekday matches but day does not (both restricted)", () => {
      // June 17, 2024 is a Monday (weekday=1)
      // "0 0 15 * 1" = 15th of month OR Monday
      // It's day 17 not 15, but it's Monday - should match (OR logic)
      const date = new Date("2024-06-17T00:00:00");
      expect(matchesCron("0 0 15 * 1", date)).toBe(true);
    });

    it("should not match when neither day nor weekday matches (both restricted)", () => {
      // June 16, 2024 is a Sunday (weekday=0)
      // "0 0 15 * 1" = 15th of month OR Monday
      // It's day 16 not 15, and it's Sunday not Monday - should NOT match
      const date = new Date("2024-06-16T00:00:00");
      expect(matchesCron("0 0 15 * 1", date)).toBe(false);
    });

    it("should only check day when weekday is wildcard", () => {
      const date = new Date("2024-06-15T00:00:00"); // Saturday
      expect(matchesCron("0 0 15 * *", date)).toBe(true);
      expect(matchesCron("0 0 14 * *", date)).toBe(false);
    });

    it("should only check weekday when day is wildcard", () => {
      const saturday = new Date("2024-06-15T00:00:00"); // Saturday=6
      expect(matchesCron("0 0 * * 6", saturday)).toBe(true);
      expect(matchesCron("0 0 * * 1", saturday)).toBe(false);
    });
  });
});

describe("getNextRun", () => {
  it("should get next minute", () => {
    const now = new Date("2024-06-15T10:30:45");
    const next = getNextRun("* * * * *", now);
    expect(next.getMinutes()).toBe(31);
    expect(next.getSeconds()).toBe(0);
  });

  it("should get next hour", () => {
    const now = new Date("2024-06-15T10:30:00");
    const next = getNextRun("0 * * * *", now);
    expect(next.getHours()).toBe(11);
    expect(next.getMinutes()).toBe(0);
  });

  it("should get next day", () => {
    const now = new Date("2024-06-15T23:30:00");
    const next = getNextRun("0 0 * * *", now);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(0);
    expect(next.getMinutes()).toBe(0);
  });

  it("should handle daily at 9am", () => {
    // Before 9am
    const morning = new Date("2024-06-15T08:00:00");
    let next = getNextRun("0 9 * * *", morning);
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(9);

    // After 9am
    const afternoon = new Date("2024-06-15T10:00:00");
    next = getNextRun("0 9 * * *", afternoon);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(9);
  });

  it("should handle every 5 minutes", () => {
    const now = new Date("2024-06-15T10:32:00");
    const next = getNextRun("*/5 * * * *", now);
    expect(next.getMinutes()).toBe(35);
  });
});

describe("CronPresets", () => {
  it("should have valid preset expressions", () => {
    expect(() => parseCron(CronPresets.EVERY_MINUTE)).not.toThrow();
    expect(() => parseCron(CronPresets.EVERY_5_MINUTES)).not.toThrow();
    expect(() => parseCron(CronPresets.HOURLY)).not.toThrow();
    expect(() => parseCron(CronPresets.DAILY)).not.toThrow();
    expect(() => parseCron(CronPresets.WEEKLY)).not.toThrow();
    expect(() => parseCron(CronPresets.MONTHLY)).not.toThrow();
  });
});
