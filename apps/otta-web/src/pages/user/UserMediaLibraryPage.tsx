import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';
import { useSession } from '@/lib/auth';

export function UserMediaLibraryPage() {
    const { user } = useSession({ skipAutoSync: true });

    return (
        <MediaLibraryBrowser
            title="My Uploads"
            description="Everything you have uploaded is collected here with previews, metadata, and direct links."
            emptyTitle="You have not uploaded any files yet"
            emptyDescription="Upload a file here or from the editor to start building your personal media library."
            defaultWhere={user?.id ? { userId: user.id } : undefined}
        />
    );
}
