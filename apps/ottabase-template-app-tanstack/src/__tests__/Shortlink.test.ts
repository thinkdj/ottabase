import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Shortlink } from '../../ottabase/models/Shortlink';

describe('Shortlink Model', () => {
  beforeEach(() => {
    // Setup D1 Mock and Register Connection
    // We reuse the global mock set in vitest.setup.ts
    const d1Mock = (global as any).OBCF_D1;
    vi.clearAllMocks(); // Clear previous calls
    
    // Ensure the mock returns something useful for chaining
    d1Mock.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([]),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    });

    registerConnection('default', createD1Driver(d1Mock));
  });

  it('should define valid fields', () => {
    expect(Shortlink.entity).toBe('shortlinks');
    expect(Shortlink.primaryKey).toBe('id');
  });

  it('should create a shortlink instance', async () => {
    const d1Mock = (global as any).OBCF_D1;
    // Mock the insertion return (usually D1 returns meta object)
    d1Mock.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 1, changes: 1 } }),
        first: vi.fn().mockResolvedValue({
             id: '123',
             fullUrl: 'https://example.com',
             shortCode: 'ex',
             type: 'redirect',
             appName: 'test',
             clicks: 0,
             createdAt: new Date().toISOString(), // D1 returns strings for dates usually
        })
    });

    const link = await Shortlink.create({
      fullUrl: 'https://example.com',
      shortCode: 'ex',
      type: 'redirect',
      appName: 'test'
    });

    expect(link).toBeDefined();
    expect(link.get('fullUrl')).toBe('https://example.com');
  });

  it('should find by code', async () => {
    const d1Mock = (global as any).OBCF_D1;
    d1Mock.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([{
            id: '123', 
            shortCode: 'gh',
            fullUrl: 'https://github.com',
            clicks: 0
        }]),
    });

    const link = await Shortlink.findByCode('gh');
    expect(link).not.toBeNull();
    expect(link?.get('shortCode')).toBe('gh');
  });

  it('should check expiration', () => {
    // Create instance manually without saving
    const link = new Shortlink({
       expiryDate: new Date(Date.now() - 1000) // Past
    });
    expect(link.isExpired()).toBe(true);

    const futureLink = new Shortlink({
        expiryDate: new Date(Date.now() + 10000) // Future
    });
    expect(futureLink.isExpired()).toBe(false);
  });
});
