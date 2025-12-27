import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProviderUIMantine } from "@ottabase/ui-mantine";
import {
  mantineThemePresetAtom,
  themeAtom,
} from "@/ottabase/state/appGlobalState";
import { useAtomValue } from "jotai";

export const Route = createFileRoute("/demo/mantine")({
  component: MantineLayout,
});

/**
 * Mantine Layout
 *
 * This layout wraps Mantine demo routes and provides the Mantine context.
 * It uses the theme preset from global state to switch between different
 * Mantine theme configurations.
 */
function MantineLayout() {
  const mantineTheme = useAtomValue(mantineThemePresetAtom);
  const globalTheme = useAtomValue(themeAtom);

  return (
    <ProviderUIMantine
      baseTheme={mantineTheme}
      colorScheme={globalTheme}
    >
      <Outlet />
    </ProviderUIMantine>
  );
}
