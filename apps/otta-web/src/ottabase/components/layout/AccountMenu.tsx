import { useDemoMode } from '@/hooks/useDemoMode';
import { isAdminUser, useSession } from '@/lib/auth';
import { MEDIA_LIBRARY_ENABLED, PACKAGE_ACCOUNT_LINKS, PACKAGES_ENABLED } from '@/ottabase/config';
import { PRO_PACKAGE_KEYS } from '@/pages/demo/pro/proPackages';
import type { PackageIcon } from '@ottabase/kernel/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@ottabase/ui-shadcn';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronsUpDown, Images, LogIn, LogOut, PenLine, ShieldCheck, UserRound } from 'lucide-react';
import { Fragment, memo, useCallback, useState } from 'react';

/**
 * The account menu: Login and Sign up when anonymous, every signed-in destination when signed in,
 * so the top nav stays visitor-facing. Packages add their pages through a `menu` entry in their
 * client descriptor (`PACKAGE_ACCOUNT_LINKS`). The layout renders it in the first chrome it has,
 * as `accountPlacement` from @ottabase/ottalayout decides: the header, the sidebar, the drawer
 * (as `AccountLinks`) or a floating button.
 */

interface AccountLink {
    to: string;
    label: string;
    icon: PackageIcon;
    /** An Ottabase Pro package's page, marked as such on a public demo. */
    pro?: boolean;
}

/** The signed-in destinations, in groups: the person's own pages, then the work surfaces. */
function useAccountLinks(): AccountLink[][] {
    const { user } = useSession();
    const demo = useDemoMode();
    const own: AccountLink[] = [
        { to: '/profile', label: 'Profile', icon: UserRound },
        ...(MEDIA_LIBRARY_ENABLED ? [{ to: '/media-library', label: 'Media Library', icon: Images }] : []),
        ...PACKAGE_ACCOUNT_LINKS.map((link) => ({
            to: link.path,
            label: link.title,
            icon: link.icon,
            pro: demo.enabled && PRO_PACKAGE_KEYS.has(link.pkg),
        })),
    ];
    const work: AccountLink[] = [
        ...(PACKAGES_ENABLED.ottablog && hasGrantedPermission(user?.permissions, 'posts:update')
            ? [{ to: '/studio', label: 'Studio', icon: PenLine }]
            : []),
        ...(isAdminUser(user) ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
    ];
    return [own, work].filter((group) => group.length > 0);
}

function ProMark() {
    return (
        <span className="ml-auto text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">Pro</span>
    );
}

/** Log out behind a confirmation: `ask` opens it, `dialog` renders it; `onDone` runs once signed out. */
function useLogout(onDone?: () => void) {
    const { logout } = useSession();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const confirm = useCallback(() => {
        setOpen(false);
        logout();
        onDone?.();
        navigate({ to: '/' });
    }, [logout, navigate, onDone]);
    const dialog = (
        <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Log out?"
            description="You will be signed out of your current session and returned to the home page."
            secondaryActionText="Cancel"
            primaryActionText="Log out"
            onConfirm={confirm}
        />
    );
    return { ask: () => setOpen(true), dialog };
}

function initialsOf(user: { name?: string | null; email?: string | null } | null | undefined): string {
    const words = user?.name?.split(' ').filter((word) => word.length > 0) ?? [];
    if (words.length > 0)
        return words
            .map((word) => word[0])
            .join('')
            .toUpperCase();
    return user?.email ? user.email[0].toUpperCase() : '?';
}

function UserAvatar({ className }: { className: string }) {
    const { user } = useSession();
    return (
        <Avatar className={className}>
            {user?.image && <AvatarImage src={user.image} />}
            <AvatarFallback className="text-xs">{initialsOf(user)}</AvatarFallback>
        </Avatar>
    );
}

/**
 * - `header`: avatar and name in the header; `compact` is the avatar alone, for the minimal header.
 * - `sidebar`: a full-width row at the foot of the sidebar, opening upwards.
 * - `floating`: an avatar button pinned to the top-right corner of a layout with no chrome.
 */
export type AccountMenuVariant = 'header' | 'compact' | 'sidebar' | 'floating';

export const AccountMenu = memo(function AccountMenu({ variant = 'header' }: { variant?: AccountMenuVariant }) {
    const { isAuthenticated, user } = useSession();
    const groups = useAccountLinks();
    const logout = useLogout();

    if (!isAuthenticated) {
        if (variant === 'sidebar' || variant === 'floating') {
            return (
                <Button
                    asChild
                    variant="default"
                    size="sm"
                    className={variant === 'sidebar' ? 'md:w-full' : 'shadow-md'}
                >
                    <Link to="/login" className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Login
                    </Link>
                </Button>
            );
        }
        return (
            <div className={`flex items-center gap-2 ${variant === 'compact' ? '' : 'ml-2'}`}>
                {/* Login carries mobile; the login page links to registration, so Sign up can yield */}
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link to="/register">Sign up</Link>
                </Button>
                <Button asChild variant="default" size="sm">
                    <Link to="/login" className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Login
                    </Link>
                </Button>
            </div>
        );
    }

    const who = user?.name || user?.email;
    const trigger =
        variant === 'sidebar' ? (
            <Button
                variant="ghost"
                size="sm"
                className="h-auto gap-2 px-2 py-1.5 md:w-full md:justify-start"
                title="Account menu"
            >
                <UserAvatar className="h-7 w-7 ring-1 ring-border" />
                {/* The sidebar is a strip on narrow screens: the avatar alone, the name from md up */}
                <span className="hidden min-w-0 flex-1 truncate text-left text-sm font-medium md:inline">{who}</span>
                <ChevronsUpDown className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />
            </Button>
        ) : variant === 'floating' ? (
            <Button
                variant="outline"
                size="sm"
                className="h-10 w-10 rounded-full bg-background/95 p-0 shadow-md backdrop-blur"
                title="Account menu"
            >
                <UserAvatar className="h-8 w-8" />
            </Button>
        ) : (
            <Button variant="ghost" size="sm" className="flex items-center gap-2" title="Account menu">
                <UserAvatar className="h-6 w-6 ring-1 ring-border" />
                {/* The avatar identifies the user on narrow headers; the name returns from md up */}
                {variant === 'header' && <span className="hidden max-w-[10rem] truncate md:inline">{who}</span>}
            </Button>
        );

    return (
        <>
            <div className={variant === 'header' ? 'ml-2 flex items-center border-l border-border/60 pl-2' : 'flex'}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                    <DropdownMenuContent
                        align={variant === 'sidebar' ? 'start' : 'end'}
                        side={variant === 'sidebar' ? 'top' : 'bottom'}
                        className="w-52"
                    >
                        <DropdownMenuLabel className="truncate">{who}</DropdownMenuLabel>
                        {groups.map((group, index) => (
                            <Fragment key={index}>
                                <DropdownMenuSeparator />
                                {group.map((link) => (
                                    <DropdownMenuItem key={link.to} asChild>
                                        <Link to={link.to}>
                                            <link.icon />
                                            {link.label}
                                            {link.pro ? <ProMark /> : null}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </Fragment>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={logout.ask}>
                            <LogOut />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {logout.dialog}
        </>
    );
});

const LIST_ITEM =
    'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-subtle-foreground transition duration-fast ease-theme hover:bg-muted hover:text-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0';

/** The same destinations as a plain list, for the drawer: it already is a menu. */
export function AccountLinks({ onNavigate }: { onNavigate?: () => void }) {
    const { isAuthenticated, user } = useSession();
    const groups = useAccountLinks();
    const logout = useLogout(onNavigate);

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col gap-2">
                <Button asChild variant="default" size="sm">
                    <Link to="/login" onClick={onNavigate} className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Login
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link to="/register" onClick={onNavigate}>
                        Sign up
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center gap-2.5 px-2.5 pb-2">
                <UserAvatar className="h-7 w-7 ring-1 ring-border" />
                <span className="min-w-0 truncate text-sm font-medium">{user?.name || user?.email}</span>
            </div>
            <nav aria-label="Account" className="flex flex-col gap-0.5">
                {groups.flat().map((link) => (
                    <Link key={link.to} to={link.to} onClick={onNavigate} className={LIST_ITEM}>
                        <link.icon />
                        {link.label}
                        {link.pro ? <ProMark /> : null}
                    </Link>
                ))}
                <button type="button" onClick={logout.ask} className={LIST_ITEM}>
                    <LogOut />
                    Log out
                </button>
            </nav>
            {logout.dialog}
        </>
    );
}
