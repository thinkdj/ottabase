import { describe, it, expect } from 'vitest';

describe('Next.js App Example Tests', () => {
    describe('Environment Setup', () => {
        it('should have test environment configured', () => {
            expect(process.env.NODE_ENV).toBe('test');
        });
    });

    describe('Utility Functions', () => {
        it('should perform basic string operations', () => {
            const str = 'hello world';
            expect(str.toUpperCase()).toBe('HELLO WORLD');
        });

        it('should handle array operations', () => {
            const arr = [1, 2, 3];
            expect(arr.length).toBe(3);
            expect(arr.map((x) => x * 2)).toEqual([2, 4, 6]);
        });
    });

    describe('Async Operations', () => {
        it('should handle promises', async () => {
            const promise = Promise.resolve('success');
            await expect(promise).resolves.toBe('success');
        });

        it('should handle async/await', async () => {
            const asyncFn = async () => {
                return new Promise((resolve) => {
                    setTimeout(() => resolve('done'), 10);
                });
            };

            const result = await asyncFn();
            expect(result).toBe('done');
        });
    });

    describe('Error Handling', () => {
        it('should catch errors', () => {
            expect(() => {
                throw new Error('test error');
            }).toThrow('test error');
        });
    });
});
