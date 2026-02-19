// Icon utility for EditorJS tools
// Since EditorJS doesn't support React components, we use SVG strings

// Base path for the reusable image icon
const IMAGE_ICON_PATHS =
    '<rect width="14" height="14" x="5" y="5" rx="4"></rect><path d="M5.13968 15.32L8.69058 11.5661C9.02934 11.2036 9.48873 11 9.96774 11C10.4467 11 10.9061 11.2036 11.2449 11.5661L15.3871 16M13.5806 14.0664L15.0132 12.533C15.3519 12.1705 15.8113 11.9668 16.2903 11.9668C16.7693 11.9668 17.2287 12.1705 17.5675 12.533L18.841 13.9634"></path><path d="M13.7778 9.33331H13.7867"></path>';

// Function to generate a complete image SVG icon with dynamic properties
function createImageIcon(size: number, strokeWidth: number): string {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${IMAGE_ICON_PATHS}</svg>`;
}

export const Icons = {
    // Main icons
    image: createImageIcon(18, 2),
    imageLarge: createImageIcon(48, 1.5),

    // Settings icons
    border: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2" fill="none"/></svg>',
    stretch:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12H3"/><path d="M18 9l3 3-3 3"/><path d="M6 9l-3 3 3 3"/></svg>',
    background:
        '<svg width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="8" cy="8" r=".5" fill="currentColor" /><circle cx="12" cy="8" r=".5" fill="currentColor" /><circle cx="16" cy="8" r=".5" fill="currentColor" /><circle cx="8" cy="12" r=".5" fill="currentColor" /><circle cx="12" cy="12" r=".5" fill="currentColor" /><circle cx="16" cy="12" r=".5" fill="currentColor" /><circle cx="8" cy="16" r=".5" fill="currentColor" /><circle cx="12" cy="16" r=".5" fill="currentColor" /><circle cx="16" cy="16" r=".5" fill="currentColor" /></svg>',
    featured:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,3 14.5,8.5 20.5,9.3 16.25,13.4 17.25,19.3 12,16.8 6.75,19.3 7.75,13.4 3.5,9.3 9.5,8.5"/></svg>',
    aspectRatio:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 10h8"/><path d="M8 14h8"/></svg>',
};

// Helper function to create an icon element
export function createIconElement(iconSvg: string, className?: string): HTMLElement {
    const iconContainer = document.createElement('div');
    if (className) {
        iconContainer.className = className;
    }
    iconContainer.innerHTML = iconSvg;
    return iconContainer;
}

// Helper function to get icon SVG string with custom size
export function getIconSvg(iconName: keyof typeof Icons, size: number = 20): string {
    const svg = Icons[iconName];
    return svg.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
}
