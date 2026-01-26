/**
 * Zoom Manager
 * Syncs browser zoom level with global Jotai state
 */
import { useEffect } from "react";
import { useAtom } from "jotai";
import { zoomAtom } from "@/ottabase/state/appState";
import { useZoomState } from "@/ottabase/hooks/useZoomState";

export function ZoomManager(): null {
  const [, setGlobalZoom] = useAtom(zoomAtom);
  const browserZoom = useZoomState();

  useEffect(() => {
    // Update global state when browser zoom changes
    setGlobalZoom(browserZoom);
  }, [browserZoom, setGlobalZoom]);

  return null;
}
