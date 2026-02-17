'use client';

import React, { ReactNode } from 'react';

/**
 * @deprecated This provider is no longer needed. The CodeBlock component handles highlighting internally.
 * You can remove this wrapper from your application.
 */
interface ProviderCodeHighlightProps {
    children: ReactNode;
}

/**
 * @deprecated This provider is no longer needed. The CodeBlock component handles highlighting internally.
 * Simply remove this wrapper and use CodeBlock directly.
 *
 * @example
 * // Before:
 * <ProviderCodeHighlight>
 *   <CodeBlock code="..." language="js" />
 * </ProviderCodeHighlight>
 *
 * // After:
 * <CodeBlock code="..." language="js" />
 */
const ProviderCodeHighlight = ({ children }: ProviderCodeHighlightProps) => {
    return <>{children}</>;
};

export default ProviderCodeHighlight;
