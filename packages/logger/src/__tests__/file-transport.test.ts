import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileTransport } from '../transports.js';

const { writeMock, mockFs } = vi.hoisted(() => {
    const writeMock = vi.fn();
    const writeStreamMock = {
        write: writeMock,
        end: vi.fn((cb?: () => void) => cb?.()),
        once: vi.fn((_event: string, cb: () => void) => cb()),
    };
    const mockFs = {
        existsSync: vi.fn(() => false),
        statSync: vi.fn(() => ({ size: 0 })),
        createWriteStream: vi.fn(() => writeStreamMock),
        unlinkSync: vi.fn(),
        renameSync: vi.fn(),
    };
    return { writeMock, mockFs };
});

vi.mock('fs', () => ({
    default: mockFs,
    ...mockFs,
}));

describe('FileTransport', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        writeMock.mockClear();
    });

    it('should buffer logs while initializing then write after fs is ready', async () => {
        const transport = new FileTransport({
            path: './test.log',
        });

        transport.log({
            level: 1,
            levelName: 'info',
            message: 'buffered message',
            timestamp: new Date(),
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(writeMock).toHaveBeenCalled();
        expect(writeMock.mock.calls[0][0]).toContain('buffered message');
    });
});
