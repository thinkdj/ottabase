// ---------------------------------------------------------------------------
// Brand Engine – Menu Slot API handlers
// GET /api/brand/menu-slots – List slot assignments for app (with resolved menus)
// PUT /api/brand/menu-slots – Replace all slot assignments for app
// ---------------------------------------------------------------------------

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { MenuSlotAssignment } from '../persistence/MenuSlotAssignment.model';
import { getMenuSlotData } from '../persistence/menuSlotData';
import type { MenuSlotAssignmentItem } from '../persistence/types';
import type { BrandApiEnv } from './brand-api';
import { warmBrandCache } from './warm-cache';

/** Valid render types for validation */
const VALID_RENDER_TYPES = ['sidebar', 'flyout', 'mega', 'navbar', 'dropdown', 'footer'] as const;

/**
 * GET /api/brand/menu-slots – List menu slot assignments with resolved menu data.
 * Returns a map of slot name → array of resolved menu slots.
 */
export async function handleGetMenuSlots(
    _request: Request,
    _env: BrandApiEnv,
    appId?: string | null,
): Promise<Response> {
    const data = await getMenuSlotData(appId ?? null);
    return jsonResponse(data, 200);
}

/**
 * GET /api/brand/menu-slots/raw – List raw slot assignments (for admin editing).
 * Returns flat array of assignment items without resolved menu data.
 */
export async function handleGetMenuSlotsRaw(
    _request: Request,
    _env: BrandApiEnv,
    appId?: string | null,
): Promise<Response> {
    const assignments = (await MenuSlotAssignment.where(
        { appId: appId ?? null },
        { orderBy: 'slotName', orderDirection: 'asc' },
    )) as InstanceType<typeof MenuSlotAssignment>[];

    const data: MenuSlotAssignmentItem[] = assignments.map((a) => ({
        id: a.get('id') as string,
        slotName: a.get('slotName') as string,
        menuId: a.get('menuId') as string,
        renderType: a.get('renderType') as string as MenuSlotAssignmentItem['renderType'],
        sortOrder: (a.get('sortOrder') as number) ?? 0,
    }));

    return jsonResponse(data, 200);
}

/**
 * PUT /api/brand/menu-slots – Replace all menu slot assignments for app.
 * Accepts array of { slotName, menuId, renderType, sortOrder? }.
 * Deletes existing assignments and re-creates them (like PUT /api/brand/mappings).
 */
export async function handlePutMenuSlots(request: Request, env: BrandApiEnv, appId?: string | null): Promise<Response> {
    const body = (await request.json()) as {
        slots: MenuSlotAssignmentItem[];
    };

    if (!body.slots || !Array.isArray(body.slots)) {
        return errorResponse('slots array is required', 400);
    }

    // Validate each slot assignment
    for (const slot of body.slots) {
        if (!slot.slotName || typeof slot.slotName !== 'string') {
            return errorResponse('slotName is required for each slot assignment', 400);
        }
        if (!slot.menuId || typeof slot.menuId !== 'string') {
            return errorResponse(`menuId is required for slot "${slot.slotName}"`, 400);
        }
        if (slot.renderType && !VALID_RENDER_TYPES.includes(slot.renderType as (typeof VALID_RENDER_TYPES)[number])) {
            return errorResponse(
                `Invalid renderType "${slot.renderType}" for slot "${slot.slotName}". Valid: ${VALID_RENDER_TYPES.join(', ')}`,
                400,
            );
        }
    }

    // Delete existing assignments for this app
    const existing = (await MenuSlotAssignment.where({
        appId: appId ?? null,
    })) as InstanceType<typeof MenuSlotAssignment>[];
    for (const a of existing) {
        await a.destroy();
    }

    // Create new assignments
    for (const slot of body.slots) {
        await MenuSlotAssignment.create({
            appId: appId || null,
            slotName: slot.slotName,
            menuId: slot.menuId,
            renderType: slot.renderType || 'sidebar',
            sortOrder: slot.sortOrder ?? 0,
        });
    }

    // Warm cache to pick up the new slot assignments
    await warmBrandCache(env, { appId: appId ?? null });

    return jsonResponse({ success: true }, 200);
}
