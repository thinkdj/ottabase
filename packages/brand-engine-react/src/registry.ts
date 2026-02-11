// ---------------------------------------------------------------------------
// Brand Engine React – Layout component registry
// Apps register their layout components; LayoutResolver resolves which to render
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/brand-engine';
import type { LayoutComponentKey } from '@ottabase/brand-engine';

export interface LayoutComponentProps {
    config: LayoutConfig;
    children: React.ReactNode;
}

const layoutComponentMap = new Map<LayoutComponentKey, React.ComponentType<LayoutComponentProps>>();

export function registerLayoutComponent(
    key: LayoutComponentKey,
    Component: React.ComponentType<LayoutComponentProps>,
): void {
    layoutComponentMap.set(key, Component);
}

export function getLayoutComponent(key: LayoutComponentKey): React.ComponentType<LayoutComponentProps> | undefined {
    return layoutComponentMap.get(key);
}
