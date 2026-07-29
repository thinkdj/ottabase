// ====================================================================
// @ottabase/spotlight/react
// --------------------------------------------------------------------
// The ONLY entry that renders React UI. Everything here pulls in
// @ottabase/ui-shadcn, @radix-ui/react-dialog and @tabler/icons-react
// (all OPTIONAL peer dependencies). Consumers that only need the pure
// context/hooks/helpers import from '@ottabase/spotlight' and never pay
// for these UI packages.
// ====================================================================

export { Spotlight } from './Spotlight';
export { SpotlightProvider } from './SpotlightProvider';
