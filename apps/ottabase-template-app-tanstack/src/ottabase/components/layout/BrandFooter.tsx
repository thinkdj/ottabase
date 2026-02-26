import { memo } from 'react';
import { APP_NAME } from '@/ottabase/config/app.config';

export const BrandFooter = memo(function BrandFooter({ containerClass }: { containerClass: string }) {
    return (
        <footer className="border-t mt-auto">
            <div className={`mx-auto px-4 py-6 text-center text-xs text-muted-foreground ${containerClass}`}>
                Built with {APP_NAME}
            </div>
        </footer>
    );
});
