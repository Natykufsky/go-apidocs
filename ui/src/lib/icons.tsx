import React from 'react';
import {
  BookOpen,
  Terminal,
  Activity,
  FileCode,
  CheckCircle2,
  Layers,
  ArrowRight,
  Hash,
  Box,
  FileText,
  Search,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  Plus,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronRight,
  Cpu,
  Lock,
  Server,
  Cloud,
  Code2,
  Boxes,
  Database,
  Sliders,
  Workflow,
  KeyRound,
  PlayCircle,
  Globe,
  Radio,
  Users,
  Building,
  Tag,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Trash2,
  Download,
  Edit3,
  FileSpreadsheet,
  Save,
  MessageSquare,
  RefreshCw,
  Flame,
  Filter,
  Gauge,
  GitBranch,
  ListOrdered,
  Folder,
  FolderOpen,
  UserPlus,
  Edit2,
  Unlock,
  Send,
  X,
  Command,
  CornerDownLeft,
  Gift,
  Key,
  Play,
  CheckCheck,
  Shield,
  ChevronDown,
  GitCompare,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';

export type { LucideIcon };

/**
 * Map of semantic icon keys AND legacy emoji glyphs to their Lucide components.
 *
 * The application historically transported icons as raw emoji strings across
 * component boundaries (nav config, workspaces, services, personas, etc.).
 * This registry lets us render a consistent, vector-based icon set regardless
 * of whether a caller supplies a semantic name ("book") or a legacy emoji ("📖").
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // --- Legacy emoji glyphs (aliases so existing data keeps working) ---
  '📖': BookOpen,
  '⚡': Zap,
  '📊': Activity,
  '📄': FileText,
  '🏠': Building,
  '🛡️': ShieldCheck,
  '🤖': Sparkles,
  '🏢': Building,
  '📁': Folder,
  '📥': UploadCloud,
  '🧪': FlaskConical,
  '📋': FileSpreadsheet,
  '🔮': Sparkles,
  '🌪️': Zap,
  '🐳': Cloud,
  '🦙': Server,
  '🐙': Code2,
  '🤗': Sparkles,
  '✨': Sparkles,
  '🌟': Sparkles,

  // --- Semantic names ---
  book: BookOpen,
  terminal: Terminal,
  activity: Activity,
  fileCode: FileCode,
  checkCircle: CheckCircle2,
  layers: Layers,
  arrowRight: ArrowRight,
  hash: Hash,
  box: Box,
  fileText: FileText,
  search: Search,
  sparkles: Sparkles,
  externalLink: ExternalLink,
  shieldAlert: ShieldAlert,
  shieldCheck: ShieldCheck,
  uploadCloud: UploadCloud,
  plus: Plus,
  zap: Zap,
  eye: Eye,
  eyeOff: EyeOff,
  copy: Copy,
  check: Check,
  checkCheck: CheckCheck,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  cpu: Cpu,
  lock: Lock,
  unlock: Unlock,
  server: Server,
  cloud: Cloud,
  code: Code2,
  boxes: Boxes,
  database: Database,
  sliders: Sliders,
  workflow: Workflow,
  keyRound: KeyRound,
  key: Key,
  play: Play,
  playCircle: PlayCircle,
  globe: Globe,
  radio: Radio,
  users: Users,
  building: Building,
  tag: Tag,
  clock: Clock,
  alertTriangle: AlertTriangle,
  xCircle: XCircle,
  helpCircle: HelpCircle,
  trash: Trash2,
  download: Download,
  edit: Edit3,
  edit2: Edit2,
  spreadsheet: FileSpreadsheet,
  save: Save,
  message: MessageSquare,
  refresh: RefreshCw,
  flame: Flame,
  filter: Filter,
  gauge: Gauge,
  gitBranch: GitBranch,
  listOrdered: ListOrdered,
  folder: Folder,
  folderOpen: FolderOpen,
  userPlus: UserPlus,
  send: Send,
  x: X,
  command: Command,
  cornerDownLeft: CornerDownLeft,
  gift: Gift,
  shield: Shield,
  gitCompare: GitCompare,
  flask: FlaskConical,
};

export interface IconProps {
  /** Semantic name (e.g. "book") or legacy emoji glyph (e.g. "📖"). */
  name?: string | null;
  /** Tailwind / CSS classes applied to the rendered SVG. */
  className?: string;
  /** Accessible label. When omitted the icon is treated as decorative. */
  title?: string;
  strokeWidth?: number;
}

/**
 * Renders a Lucide icon for a given semantic name or legacy emoji glyph.
 * Unknown values fall back to a neutral `Box` icon so the layout never breaks.
 */
export const Icon: React.FC<IconProps> = ({ name, className = 'w-4 h-4', title, strokeWidth }) => {
  const Cmp = (name && ICON_MAP[name]) || ICON_MAP[name || ''] || Box;
  return (
    <Cmp
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? 'img' : undefined}
    />
  );
};

/**
 * Helper form for callers that need an icon component type rather than an
 * element (e.g. to pass into a config object). Returns `undefined` for unknown
 * keys so callers can gracefully fall back.
 */
export const resolveIcon = (name?: string | null): LucideIcon | undefined => {
  if (!name) return undefined;
  return ICON_MAP[name];
};
