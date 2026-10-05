/** Where a menu shows up: the layout slots that hold it, read from the brand config already on the client. */
export function slotsForMenu(menuSlots: Record<string, { menuId: string }[]> | undefined, menuId: string): string[] {
    return Object.entries(menuSlots ?? {})
        .filter(([, assignments]) => assignments.some((a) => a.menuId === menuId))
        .map(([slot]) => slot);
}

/** `header-nav` reads "Header nav". */
export function slotLabel(slot: string): string {
    const words = slot.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}
