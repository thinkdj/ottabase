import { beforeEach, describe, expect, it, vi } from 'vitest';

const { templateFind, mappingWhere, mappingCreate, warm } = vi.hoisted(() => ({
    templateFind: vi.fn(),
    mappingWhere: vi.fn(),
    mappingCreate: vi.fn(),
    warm: vi.fn(),
}));

vi.mock('../persistence/LayoutTemplate.model', () => ({ LayoutTemplate: { find: templateFind } }));
vi.mock('../persistence/LayoutRouteMapping.model', () => ({
    LayoutRouteMapping: { where: mappingWhere, create: mappingCreate },
}));
vi.mock('../persistence/layoutData', () => ({ getLayoutData: vi.fn() }));
vi.mock('../handlers/warm-cache', () => ({ warmBrandCache: warm }));

import { handlePutLayout, handlePutMappings } from '../handlers/layout-api';

const ENV = {} as any;
const put = (body: unknown) => new Request('http://x/api/brand', { method: 'PUT', body: JSON.stringify(body) });

describe('handlePutLayout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 404 and does not save a template owned by another app', async () => {
        const save = vi.fn();
        templateFind.mockResolvedValue({ get: (k: string) => (k === 'appId' ? 'app-b' : null), set: vi.fn(), save });

        const res = await handlePutLayout(put({ id: 't1', name: 'x', componentKey: 'k', config: {} }), ENV, 'app-a');

        expect(res.status).toBe(404);
        expect(save).not.toHaveBeenCalled();
    });
});

describe('handlePutMappings', () => {
    const destroy = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mappingWhere.mockResolvedValue([{ destroy }]);
    });

    it.each([
        ['mappings missing', {}],
        ['mappings not an array', { mappings: 'nope' }],
        ['a later mapping invalid', { mappings: [{ pathPattern: '/', layoutTemplateId: 't', brandKitId: 'k' }, {}] }],
        [
            'bad tokenOverridesJson',
            { mappings: [{ pathPattern: '/', layoutTemplateId: 't', brandKitId: 'k', tokenOverridesJson: '{' }] },
        ],
    ])('rejects (%s) without deleting existing mappings', async (_label, body) => {
        const res = await handlePutMappings(put(body), ENV, 'app-a');

        expect(res.status).toBe(400);
        expect(destroy).not.toHaveBeenCalled();
        expect(mappingCreate).not.toHaveBeenCalled();
    });

    it('replaces mappings when every entry is valid', async () => {
        const res = await handlePutMappings(
            put({ mappings: [{ pathPattern: '/blog/*', layoutTemplateId: 't', brandKitId: 'k', priority: 5 }] }),
            ENV,
            'app-a',
        );

        expect(res.status).toBe(200);
        expect(destroy).toHaveBeenCalledTimes(1);
        expect(mappingCreate).toHaveBeenCalledWith(
            expect.objectContaining({ appId: 'app-a', pathPattern: '/blog/*', priority: 5 }),
        );
    });
});
