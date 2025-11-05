import { createDefaultAppState } from "@ottabase/state";

// Create app state using the shared state package
const appState = createDefaultAppState();

// Export the main atom containing the entire state object.
export const appStateAtom = appState.appStateAtom;

// Export the convenient, pre-created lensed atoms.
// These are the recommended way to interact with state slices.
export const themeAtom = appState.atoms.themeAtom;
export const scaleAtom = appState.atoms.scaleAtom;
export const userAtom = appState.atoms.userAtom;
export const isMobileSidebarOpenAtom = appState.atoms.isMobileSidebarOpenAtom;
export const isDesktopSidebarOpenAtom = appState.atoms.isDesktopSidebarOpenAtom;

// Export the lensed atom creator for advanced use cases.
export const createLensedAtom = appState.createLensedAtom;

// Export the complete state object for modern usage
export default appState;

/*
    NEW, SIMPLIFIED USAGE EXAMPLES
    ----------------------------------------------------------------

    1. Reading and Writing a specific value (e.g., scale)
       Best for performance, as this only re-renders when `scale` changes.
    ----------------------------------------------------------------
    import { useAtom } from 'jotai';
    import { scaleAtom } from '@/ottabase/state/appGlobalState';

    function ScaleChanger() {
      const [scale, setScale] = useAtom(scaleAtom);

      return <input value={scale} onChange={(e) => setScale(Number(e.target.value))} />;
    }

    2. Reading the entire state object (less common)
       Use this if your component needs many properties from the state.
    ----------------------------------------------------------------
    import { useAtomValue } from 'jotai';
    import { appStateAtom } from '@/ottabase/state/appGlobalState';

    function GlobalStateViewer() {
      const state = useAtomValue(appStateAtom);

      return <pre>{JSON.stringify(state, null, 2)}</pre>;
    }

    3. Updating the entire state object (use with caution)
    ----------------------------------------------------------------
    import { useSetAtom } from 'jotai';
    import { appStateAtom } from '@/ottabase/state/appGlobalState';

    function StateResetter() {
      const setAppState = useSetAtom(appStateAtom);

      const handleReset = () => {
        setAppState(defaultInitialState); // Assumes `defaultInitialState` is defined
      };

      return <button onClick={handleReset}>Reset State</button>;
    }
*/
