import {
  Zap,
  Rocket,
  Code2,
  Palette,
  Briefcase,
  Youtube,
  MessageCircle,
  PenTool,
  Building2,
  Sparkles,
  Globe,
  Terminal,
  Heart,
  Coffee,
  BookOpen,
  Camera,
  Video,
  Star,
  Layers,
  Github,
  Linkedin,
  Twitter,
  Mail,
  Play,
  Database,
  Server,
  Folder,
  Boxes,
  Cpu,
  Flame,
  Bot,
  Paintbrush,
  Wand2,
  Laptop,
  AppWindow,
  type LucideIcon,
} from "@/components/animated-icons";
import type { CardContent, ProjectItem, UserProfileContent, WorkExperienceItem, WorkCertificateItem } from "@/lib/api";

// ----------------------------------------------------------------------------
// Icon library — items store a plain key (persisted in Neon) resolved here
// ----------------------------------------------------------------------------
export const ICON_LIBRARY: Record<string, LucideIcon> = {
  zap: Zap,
  rocket: Rocket,
  code: Code2,
  palette: Palette,
  paintbrush: Paintbrush,
  wand: Wand2,
  laptop: Laptop,
  appwindow: AppWindow,
  briefcase: Briefcase,
  youtube: Youtube,
  message: MessageCircle,
  pen: PenTool,
  building: Building2,
  sparkles: Sparkles,
  globe: Globe,
  terminal: Terminal,
  heart: Heart,
  coffee: Coffee,
  book: BookOpen,
  camera: Camera,
  video: Video,
  star: Star,
  layers: Layers,
  github: Github,
  linkedin: Linkedin,
  twitter: Twitter,
  mail: Mail,
  play: Play,
  database: Database,
  server: Server,
  folder: Folder,
  boxes: Boxes,
  cpu: Cpu,
  flame: Flame,
  bot: Bot,
};

export const ICON_KEYS = Object.keys(ICON_LIBRARY);

export function resolveIcon(key: string): LucideIcon {
  return ICON_LIBRARY[key] || Zap;
}

// ----------------------------------------------------------------------------
// Appearance options (settings popover — font pills + colour dots)
// ----------------------------------------------------------------------------
export const FONT_OPTIONS = [
  { id: "schibsted", label: "Schibsted", cssVar: "var(--font-schibsted)" },
  { id: "inter", label: "Inter", cssVar: "var(--font-inter)" },
  { id: "geist", label: "Geist", cssVar: "var(--font-geist-sans)" },
] as const;

export const ACCENT_OPTIONS = [
  "#e7e5e4",
  "#d946ef",
  "#14b8a6",
  "#6366f1",
  "#f97316",
  "#8b5cf6",
] as const;

export const ITEM_COLORS = [
  "#262626", // Dark Slate / Cursor
  "#f97316", // Vibrant Orange / Replit
  "#10b981", // Emerald Green / Neon
  "#6366f1", // Indigo / Strapi
  "#8b5cf6", // Purple / Hostinger
  "#eab308", // Amber Yellow / Posthog
  "#3b82f6", // Royal Blue / Fireworks / Consultation
  "#ef4444", // Red
  "#ec4899", // Pink
  "#06b6d4", // Cyan
] as const;

export function fontCssVar(font: string): string {
  const match = FONT_OPTIONS.find((f) => f.id === font);
  return match ? match.cssVar : FONT_OPTIONS[0].cssVar;
}

// ----------------------------------------------------------------------------
// Profile templates — full-page designs. "classic" is the original card and
// inherits the app theme; "folio" is the second design and overrides the CSS
// variable tokens on the card wrapper so every section restyles itself.
// `id` must stay in sync with the CardSettings whitelist in the API.
// ----------------------------------------------------------------------------
export type HomeSection = "bio" | "things" | "companies" | "work" | "quote";
export type TemplateChrome = "classic" | "folio";

export const PROFILE_TEMPLATES: {
  id: string;
  label: string;
  blurb: string;
  vars: Record<string, string>;
  chrome: TemplateChrome;
  homeOrder: HomeSection[];
}[] = [
  {
    id: "classic",
    label: "Classic",
    blurb: "The original report card — follows your app theme",
    vars: {},
    chrome: "classic",
    homeOrder: ["bio", "things", "companies", "work", "quote"],
  },
  {
    id: "folio",
    label: "Folio",
    blurb: "Ink-and-paper editorial folio with stamped cards and a handwritten sign-off",
    vars: {
      "--bg": "#F4F1EA",
      "--card": "#FFFDF8",
      "--surface": "#EAE5D9",
      "--line": "#D8D0BE",
      "--line-strong": "#B9AE93",
      "--fg": "#211D15",
      "--muted": "#6E6656",
      "--faint": "#A39882",
    },
    chrome: "folio",
    homeOrder: ["quote", "bio", "things", "companies", "work"],
  },
];

/** Themes saved before the classic/folio rework collapse into "classic". */
export function resolveProfileTemplate(theme: string | undefined) {
  const match = PROFILE_TEMPLATES.find((t) => t.id === theme);
  if (match) return match;
  return PROFILE_TEMPLATES[0];
}

// ----------------------------------------------------------------------------
// Page tabs — each one is a real route, deliberately short labels
// (Experience + Certificates live together on Work)
// ----------------------------------------------------------------------------
export type CardTab = "home" | "work" | "projects" | "inspiration" | "sponsor";

export const CARD_TABS: { id: CardTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "work", label: "Work" },
  { id: "projects", label: "Projects" },
  { id: "inspiration", label: "Inspo" },
  { id: "sponsor", label: "Sponsor" },
];

// ----------------------------------------------------------------------------
// Content helpers — a brand-new account always starts completely EMPTY
// ----------------------------------------------------------------------------
export function emptyContent(): CardContent {
  return {
    name_aka: "",
    bio_paragraphs: [],
    things_i_do: [],
    companies: [],
    work_with_me: [],
    writings: [],
    inspirations: [],
    inspiration_intro: [],
    projects: [],
    projects_intro: [],
    experience: [],
    certificates: [],
    initialized: false,
    quote: null,
    footer: null,
  };
}

export function isEmptyContent(
  content: CardContent | undefined | null,
): boolean {
  if (!content) return true;
  return (
    !content.name_aka?.trim() &&
    (content.bio_paragraphs?.length ?? 0) === 0 &&
    (content.things_i_do?.length ?? 0) === 0 &&
    (content.companies?.length ?? 0) === 0 &&
    (content.work_with_me?.length ?? 0) === 0 &&
    (content.writings?.length ?? 0) === 0 &&
    (content.inspirations?.length ?? 0) === 0 &&
    (content.projects?.length ?? 0) === 0 &&
    (content.experience?.length ?? 0) === 0 &&
    (content.certificates?.length ?? 0) === 0 &&
    !content.quote?.text?.trim() &&
    !content.footer?.signature_name?.trim()
  );
}

/**
 * Detects whether a string is a machine-generated user identifier
 * (e.g. "User_3lhtrrfjnj90d6q3aulxb1wdmo7" or "user_2abc123...").
 */
export function isGeneratedUserId(str?: string | null): boolean {
  if (!str) return true;
  const s = str.trim();
  if (/^user_[a-z0-9_-]{6,}$/i.test(s)) return true;
  if (/^user\s+[a-z0-9_-]{6,}$/i.test(s)) return true;
  return false;
}

/** The portfolio was set up through the New Portfolio screen (template picked). */
export function isInitialized(content: CardContent | undefined | null): boolean {
  return Boolean(content?.initialized);
}

let idCounter = 0;
export function newItemId(): string {
  idCounter += 1;
  return `item-${Date.now().toString(36)}-${idCounter}`;
}

export function blankInspirationItem() {
  return {
    id: newItemId(),
    title: "",
    description: "",
    link: "https://",
    icon: "globe",
    color: "#262626",
    logo_url: null,
  };
}

export function blankProjectItem() {
  return {
    id: newItemId(),
    title: "",
    description: "",
    category: "Web Dev",
    link: "https://",
    icon: "globe",
    color: "#3b82f6",
    logo_url: null,
    tags: ["React", "TypeScript"],
    year: new Date().getFullYear().toString(),
  };
}

export function blankExperienceItem() {
  return {
    id: newItemId(),
    role: "",
    company: "",
    period: "",
    description: "",
    link: "https://",
  };
}

export function blankCertificateItem() {
  return {
    id: newItemId(),
    name: "",
    issuer: "",
    year: new Date().getFullYear().toString(),
    link: "https://",
  };
}

// ----------------------------------------------------------------------------
// Settings → portfolio seeding. The Settings page (Personal / Experience /
// Certifications / Projects tabs) is the source of truth; the portfolio pulls
// from it automatically when a section is still empty, and every imported
// entry becomes a normal, editable, reorderable portfolio item.
// ----------------------------------------------------------------------------
function monthYear(value: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString("en-US", { month: "short", year: "numeric" });
  }
  return raw; // free-text period written in Settings
}

function formatPeriod(
  start: string,
  end: string,
  current: boolean,
): string {
  const from = monthYear(start);
  const to = current ? "Present" : monthYear(end);
  if (from && to) return `${from} — ${to}`;
  return from || to || "";
}

export function experienceFromProfile(
  profile: UserProfileContent | null | undefined,
): WorkExperienceItem[] {
  return (profile?.experiences || [])
    .filter((e) => (e.role || "").trim() || (e.company || "").trim())
    .map((e) => ({
      id: newItemId(),
      role: e.role || "",
      company: e.company || "",
      period: formatPeriod(e.start_date, e.end_date, e.current),
      description: e.description || "",
      link: null,
    }));
}

export function certificatesFromProfile(
  profile: UserProfileContent | null | undefined,
): WorkCertificateItem[] {
  return (profile?.certifications || [])
    .filter((c) => (c.name || "").trim())
    .map((c) => ({
      id: newItemId(),
      name: c.name || "",
      issuer: c.issuer || "",
      year: monthYear(c.issue_date).slice(-4) || "",
      link: c.credential_url || null,
    }));
}

export function projectsFromProfile(
  profile: UserProfileContent | null | undefined,
): ProjectItem[] {
  return (profile?.projects || [])
    .filter((p) => (p.name || "").trim())
    .map((p) => ({
      id: newItemId(),
      title: p.name || "",
      description: p.description || "",
      category: "Web Dev",
      link: p.link || "https://",
      icon: "globe",
      color: "#3b82f6",
      logo_url: null,
      tags: p.tech_stack || [],
      year: p.year || new Date().getFullYear().toString(),
    }));
}
