import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { clearAllConnections, registerConnection } from "@ottabase/ottaorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Shortlink } from "../../ottabase/models/Shortlink";

describe("Shortlink Model", () => {
  const toRawRows = (rows: any[]) => rows.map((row) => Object.values(row));
  const createStatement = (rawResult: any[]) => ({
    bind: vi.fn().mockReturnThis(),
    raw: vi.fn().mockResolvedValue(toRawRows(rawResult)),
    all: vi.fn().mockResolvedValue({ results: rawResult, success: true }),
    first: vi.fn().mockResolvedValue(rawResult[0] ?? null),
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: { changes: rawResult.length },
    }),
  });

  beforeEach(() => {
    const d1Mock = (global as any).OBCF_D1;
    vi.clearAllMocks();

    d1Mock.prepare.mockImplementation(() => createStatement([]));

    clearAllConnections();
    registerConnection("default", createD1Driver(d1Mock));
  });

  it("should define valid fields", () => {
    expect(Shortlink.entity).toBe("shortlinks");
    expect(Shortlink.primaryKey).toBe("id");
  });

  it("should create a shortlink instance", async () => {
    const d1Mock = (global as any).OBCF_D1;
    const now = Math.floor(Date.now() / 1000);
    const createdRow = {
      id: "123",
      fullUrl: "https://example.com",
      shortCode: "ex",
      type: "redirect",
      appName: "test",
      expiryDate: null,
      clicks: 0,
      lastClickedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    d1Mock.prepare.mockImplementation((sql: string) =>
      /insert/i.test(sql) ? createStatement([createdRow]) : createStatement([]),
    );

    const link = await Shortlink.create({
      fullUrl: "https://example.com",
      shortCode: "ex",
      type: "redirect",
      appName: "test",
    });

    expect(link).toBeDefined();
    expect(link.get("fullUrl")).toBe("https://example.com");
  });

  it("should find by code", async () => {
    const d1Mock = (global as any).OBCF_D1;
    const now = Math.floor(Date.now() / 1000);
    const row = {
      id: "123",
      fullUrl: "https://github.com",
      shortCode: "gh",
      type: "redirect",
      appName: "test",
      expiryDate: null,
      clicks: 0,
      lastClickedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    d1Mock.prepare.mockImplementation((sql: string) =>
      /select/i.test(sql) ? createStatement([row]) : createStatement([]),
    );

    const link = await Shortlink.findByCode("gh");
    expect(link).not.toBeNull();
    expect(link?.get("shortCode")).toBe("gh");
  });

  it("should check expiration", () => {
    const link = new Shortlink({
      entity: Shortlink.entity,
      data: {
        expiryDate: new Date(Date.now() - 1000),
      },
    } as any);
    expect(link.isExpired()).toBe(true);

    const futureLink = new Shortlink({
      entity: Shortlink.entity,
      data: {
        expiryDate: new Date(Date.now() + 10000),
      },
    } as any);
    expect(futureLink.isExpired()).toBe(false);
  });
});
