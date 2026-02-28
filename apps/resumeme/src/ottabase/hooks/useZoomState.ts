/**
 * Hook to track browser zoom level
 * Detects when the browser zoom changes and updates accordingly
 */
import { useEffect, useState } from 'react';

export function useZoomState(): number {
    const [zoom, setZoom] = useState<number>(1.0);

    useEffect(() => {
        // Initial zoom level detection
        const initialZoom = window.devicePixelRatio;
        setZoom(initialZoom);

        // Handle resize events (zoom changes trigger resize events)
        const handleZoomChange = () => {
            setZoom(window.devicePixelRatio);
        };

        window.addEventListener('resize', handleZoomChange);

        return () => {
            window.removeEventListener('resize', handleZoomChange);
        };
    }, []);

    return zoom;
}
