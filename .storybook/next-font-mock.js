const createFont = (fontName, options = {}) => {
    const fontFamilies = {
        Inter: 'Inter, ui-sans-serif, system-ui, sans-serif',
        Work_Sans: 'Work Sans, ui-sans-serif, system-ui, sans-serif',
        JetBrains_Mono: 'JetBrains Mono, ui-monospace, monospace',
        Patrick_Hand: 'Patrick Hand, cursive',
    };

    const family = fontFamilies[fontName] || 'ui-sans-serif, system-ui, sans-serif';
    const className = options?.variable
        ? options.variable.replace('--font-', '')
        : `font-${fontName.toLowerCase().replace('_', '-')}`;

    return {
        className,
        style: { fontFamily: family },
        variable: options?.variable || `--font-${fontName.toLowerCase().replace('_', '-')}`,
    };
};

module.exports = {
    __esModule: true,
    default: (options) => createFont('Inter', options),
    Inter: (options) => createFont('Inter', options),
    Work_Sans: (options) => createFont('Work_Sans', options),
    JetBrains_Mono: (options) => createFont('JetBrains_Mono', options),
    Patrick_Hand: (options) => createFont('Patrick_Hand', options),
};
