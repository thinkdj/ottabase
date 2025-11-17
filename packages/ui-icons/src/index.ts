/**
 * @ottabase/ui-icons
 *
 * Unified icon package for Ottabase applications
 * Provides direct access to Lucide and Tabler icon libraries
 *
 * @example
 * ```tsx
 * // Option 1: Use curated common icons
 * import { Icon } from '@ottabase/ui-icons';
 * <Icon.Search size={20} />
 *
 * // Option 2: Import directly from Lucide
 * import { Home, Search, Settings } from '@ottabase/ui-icons/lucide';
 * <Home size={24} />
 *
 * // Option 3: Import directly from Tabler
 * import { IconHome, IconSearch } from '@ottabase/ui-icons/tabler';
 * <IconHome size={24} />
 * ```
 */

import * as LucideIcons from 'lucide-react';

/**
 * Curated set of commonly used icons
 * Uses Lucide icons as the default for consistency
 *
 * Feel free to import any icon directly from:
 * - '@ottabase/ui-icons/lucide' for all Lucide icons
 * - '@ottabase/ui-icons/tabler' for all Tabler icons
 */
export const Icon = {
  // Navigation & UI
  Menu: LucideIcons.Menu,
  Close: LucideIcons.X,
  ChevronDown: LucideIcons.ChevronDown,
  ChevronUp: LucideIcons.ChevronUp,
  ChevronLeft: LucideIcons.ChevronLeft,
  ChevronRight: LucideIcons.ChevronRight,
  ArrowLeft: LucideIcons.ArrowLeft,
  ArrowRight: LucideIcons.ArrowRight,
  ArrowUp: LucideIcons.ArrowUp,
  ArrowDown: LucideIcons.ArrowDown,
  Home: LucideIcons.Home,
  Search: LucideIcons.Search,
  Settings: LucideIcons.Settings,
  MoreVertical: LucideIcons.MoreVertical,
  MoreHorizontal: LucideIcons.MoreHorizontal,

  // Actions
  Plus: LucideIcons.Plus,
  Minus: LucideIcons.Minus,
  Edit: LucideIcons.Edit,
  Trash: LucideIcons.Trash,
  Save: LucideIcons.Save,
  Copy: LucideIcons.Copy,
  Download: LucideIcons.Download,
  Upload: LucideIcons.Upload,
  Share: LucideIcons.Share,
  ExternalLink: LucideIcons.ExternalLink,
  Refresh: LucideIcons.RefreshCw,
  Check: LucideIcons.Check,
  CheckCircle: LucideIcons.CheckCircle,

  // Files & Folders
  File: LucideIcons.File,
  FileText: LucideIcons.FileText,
  Folder: LucideIcons.Folder,
  FolderOpen: LucideIcons.FolderOpen,
  Image: LucideIcons.Image,

  // Communication
  Mail: LucideIcons.Mail,
  Send: LucideIcons.Send,
  MessageSquare: LucideIcons.MessageSquare,
  Bell: LucideIcons.Bell,
  Phone: LucideIcons.Phone,

  // Users & Auth
  User: LucideIcons.User,
  Users: LucideIcons.Users,
  UserPlus: LucideIcons.UserPlus,
  Lock: LucideIcons.Lock,
  Unlock: LucideIcons.Unlock,
  LogIn: LucideIcons.LogIn,
  LogOut: LucideIcons.LogOut,

  // Status & Feedback
  Info: LucideIcons.Info,
  AlertCircle: LucideIcons.AlertCircle,
  AlertTriangle: LucideIcons.AlertTriangle,
  HelpCircle: LucideIcons.HelpCircle,
  XCircle: LucideIcons.XCircle,
  Loader: LucideIcons.Loader,
  Loader2: LucideIcons.Loader2,

  // Data & Database
  Database: LucideIcons.Database,
  Table: LucideIcons.Table,
  Grid: LucideIcons.Grid,
  List: LucideIcons.List,
  BarChart: LucideIcons.BarChart,
  PieChart: LucideIcons.PieChart,
  LineChart: LucideIcons.LineChart,

  // Development
  Code: LucideIcons.Code,
  Terminal: LucideIcons.Terminal,
  GitBranch: LucideIcons.GitBranch,
  Package: LucideIcons.Package,
  Cpu: LucideIcons.Cpu,
  Server: LucideIcons.Server,

  // UI Elements
  Eye: LucideIcons.Eye,
  EyeOff: LucideIcons.EyeOff,
  Star: LucideIcons.Star,
  Heart: LucideIcons.Heart,
  Bookmark: LucideIcons.Bookmark,
  Filter: LucideIcons.Filter,
  Calendar: LucideIcons.Calendar,
  Clock: LucideIcons.Clock,
  Sun: LucideIcons.Sun,
  Moon: LucideIcons.Moon,

  // Media
  Play: LucideIcons.Play,
  Pause: LucideIcons.Pause,
  Volume: LucideIcons.Volume,
  VolumeX: LucideIcons.VolumeX,
  Camera: LucideIcons.Camera,

  // Commerce
  ShoppingCart: LucideIcons.ShoppingCart,
  CreditCard: LucideIcons.CreditCard,
  DollarSign: LucideIcons.DollarSign,
} as const;

// Default export for convenience
export default Icon;
