import type { ReactNode } from 'react';
import { SignalFooter } from '@/components/themes/signal-horizon/SignalFooter';
import { SignalNav, type SignalNavActive } from '@/components/themes/signal-horizon/SignalNav';
import { SignalShell } from '@/components/themes/signal-horizon/SignalShell';

type Props = {
    active?: SignalNavActive;
    children: ReactNode;
};

export function SignalMarketingChrome({ active, children }: Props) {
    return (
        <SignalShell>
            <SignalNav active={active} />
            {children}
            <SignalFooter />
        </SignalShell>
    );
}
