/**
 * Tabler Icons - A set of over 5000+ pixel-perfect icons
 * @see https://tabler.io/icons
 */

import * as TablerIcons from '@tabler/icons-react';
import { createTablerWrapper } from './utils';
import type { IconComponent } from './types';

// Re-export all Tabler icons with proper typing
export * from '@tabler/icons-react';

// Commonly used Tabler icons with consistent naming
export const TablerIconSet = {
  // Navigation & UI
  Menu: TablerIcons.IconMenu2,
  Close: TablerIcons.IconX,
  ChevronDown: TablerIcons.IconChevronDown,
  ChevronUp: TablerIcons.IconChevronUp,
  ChevronLeft: TablerIcons.IconChevronLeft,
  ChevronRight: TablerIcons.IconChevronRight,
  ArrowLeft: TablerIcons.IconArrowLeft,
  ArrowRight: TablerIcons.IconArrowRight,
  ArrowUp: TablerIcons.IconArrowUp,
  ArrowDown: TablerIcons.IconArrowDown,
  Home: TablerIcons.IconHome,
  Search: TablerIcons.IconSearch,
  Settings: TablerIcons.IconSettings,
  Dots: TablerIcons.IconDots,
  DotsVertical: TablerIcons.IconDotsVertical,

  // Actions
  Plus: TablerIcons.IconPlus,
  Minus: TablerIcons.IconMinus,
  Edit: TablerIcons.IconEdit,
  Trash: TablerIcons.IconTrash,
  DeviceFloppy: TablerIcons.IconDeviceFloppy,
  Copy: TablerIcons.IconCopy,
  Download: TablerIcons.IconDownload,
  Upload: TablerIcons.IconUpload,
  Share: TablerIcons.IconShare,
  ExternalLink: TablerIcons.IconExternalLink,
  Refresh: TablerIcons.IconRefresh,
  Check: TablerIcons.IconCheck,
  CircleCheck: TablerIcons.IconCircleCheck,

  // Files & Folders
  File: TablerIcons.IconFile,
  FileText: TablerIcons.IconFileText,
  Folder: TablerIcons.IconFolder,
  FolderOpen: TablerIcons.IconFolderOpen,
  Photo: TablerIcons.IconPhoto,

  // Communication
  Mail: TablerIcons.IconMail,
  Send: TablerIcons.IconSend,
  Message: TablerIcons.IconMessage,
  Bell: TablerIcons.IconBell,
  Phone: TablerIcons.IconPhone,

  // Users & Auth
  User: TablerIcons.IconUser,
  Users: TablerIcons.IconUsers,
  UserPlus: TablerIcons.IconUserPlus,
  Lock: TablerIcons.IconLock,
  LockOpen: TablerIcons.IconLockOpen,
  Login: TablerIcons.IconLogin,
  Logout: TablerIcons.IconLogout,

  // Status & Feedback
  InfoCircle: TablerIcons.IconInfoCircle,
  AlertCircle: TablerIcons.IconAlertCircle,
  AlertTriangle: TablerIcons.IconAlertTriangle,
  HelpCircle: TablerIcons.IconHelpCircle,
  CircleX: TablerIcons.IconCircleX,
  Loader: TablerIcons.IconLoader,
  Loader2: TablerIcons.IconLoader2,

  // Data & Database
  Database: TablerIcons.IconDatabase,
  Table: TablerIcons.IconTable,
  Grid: TablerIcons.IconGrid3x3,
  List: TablerIcons.IconList,
  ChartBar: TablerIcons.IconChartBar,
  ChartPie: TablerIcons.IconChartPie,
  ChartLine: TablerIcons.IconChartLine,

  // Development
  Code: TablerIcons.IconCode,
  Terminal: TablerIcons.IconTerminal,
  GitBranch: TablerIcons.IconGitBranch,
  Package: TablerIcons.IconPackage,
  Cpu: TablerIcons.IconCpu,
  Server: TablerIcons.IconServer,

  // UI Elements
  Eye: TablerIcons.IconEye,
  EyeOff: TablerIcons.IconEyeOff,
  Star: TablerIcons.IconStar,
  Heart: TablerIcons.IconHeart,
  Bookmark: TablerIcons.IconBookmark,
  Filter: TablerIcons.IconFilter,
  Calendar: TablerIcons.IconCalendar,
  Clock: TablerIcons.IconClock,
  Sun: TablerIcons.IconSun,
  Moon: TablerIcons.IconMoon,

  // Media
  PlayerPlay: TablerIcons.IconPlayerPlay,
  PlayerPause: TablerIcons.IconPlayerPause,
  Volume: TablerIcons.IconVolume,
  VolumeOff: TablerIcons.IconVolumeOff,
  Camera: TablerIcons.IconCamera,

  // Commerce
  ShoppingCart: TablerIcons.IconShoppingCart,
  CreditCard: TablerIcons.IconCreditCard,
  CurrencyDollar: TablerIcons.IconCurrencyDollar,
} as const;

// Type for all available Tabler icon names
export type TablerIconName = keyof typeof TablerIcons;

/**
 * Get a Tabler icon component by name
 * @param name - The name of the Tabler icon (should start with 'Icon')
 * @returns The icon component or undefined if not found
 */
export function getTablerIcon(name: TablerIconName): IconComponent | undefined {
  const icon = TablerIcons[name];
  return icon ? createTablerWrapper(icon) : undefined;
}

/**
 * Check if a Tabler icon exists
 * @param name - The name to check
 * @returns True if the icon exists
 */
export function hasTablerIcon(name: string): name is TablerIconName {
  return name in TablerIcons;
}
