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
  type LucideIcon,
} from "lucide-react";
import type { CardContent, CardSettings } from "@/lib/api";

// ----------------------------------------------------------------------------
// Icon library — items store a plain key (persisted in Neon) resolved here
// ----------------------------------------------------------------------------
export const ICON_LIBRARY: Record<string, LucideIcon> = {
  zap: Zap,
  rocket: Rocket,
  code: Code2,
  palette: Palette,
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
  "#2563eb",
  "#f97316",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#eab308",
  "#06b6d4",
  "#ec4899",
] as const;

export const DEFAULT_SETTINGS: CardSettings = {
  font: "schibsted",
  accent: "#e7e5e4",
};

export function fontCssVar(font: string): string {
  const match = FONT_OPTIONS.find((f) => f.id === font);
  return match ? match.cssVar : FONT_OPTIONS[0].cssVar;
}

// ----------------------------------------------------------------------------
// Page tabs — each one is a real route (Home / Inspiration / Blog / Sponsor)
// ----------------------------------------------------------------------------
export type CardTab = "home" | "inspiration" | "blog" | "sponsor";

export const CARD_TABS: { id: CardTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "inspiration", label: "Inspiration" },
  { id: "blog", label: "Blog" },
  { id: "sponsor", label: "Sponsor" },
];

export const TAB_TO_SECTION: Record<CardTab, string> = {
  home: "things_i_do",
  inspiration: "companies",
  blog: "writings",
  sponsor: "work_with_me",
};

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
    (content.writings?.length ?? 0) === 0
  );
}

let idCounter = 0;
export function newItemId(): string {
  idCounter += 1;
  return `item-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Optional starter layout the owner can explicitly install (never auto-seeded):
 * the section scaffolding of the reference design with blank copy to fill in.
 */
export function starterTemplate(): CardContent {
  return {
    ...emptyContent(),
    bio_paragraphs: [
      "I'm a freelancer at heart — tell everyone what you build and who you build it for.",
      "When I'm not coding, I usually talk about design engineering and the tools I ship.",
    ],
    things_i_do: [
      {
        id: newItemId(),
        title: "Freelance OS",
        description: "Products + dev studio for startups.",
        link: "",
        icon: "zap",
        color: ITEM_COLORS[0],
      },
      {
        id: newItemId(),
        title: "Component Library",
        description: "UI kit for modern websites.",
        link: "",
        icon: "layers",
        color: ITEM_COLORS[1],
      },
      {
        id: newItemId(),
        title: "YouTube",
        description: "I talk about freelancing and SaaS.",
        link: "",
        icon: "youtube",
        color: ITEM_COLORS[3],
      },
    ],
    companies: [
      {
        id: newItemId(),
        title: "Company One",
        description: "What you did there in one line.",
        link: "",
        icon: "building",
        color: ITEM_COLORS[0],
      },
      {
        id: newItemId(),
        title: "Company Two",
        description: "What you did there in one line.",
        link: "",
        icon: "building",
        color: ITEM_COLORS[2],
      },
      {
        id: newItemId(),
        title: "Company Three",
        description: "What you did there in one line.",
        link: "",
        icon: "building",
        color: ITEM_COLORS[4],
      },
    ],
    work_with_me: [
      {
        id: newItemId(),
        title: "Consultation",
        description: "Get on a paid call with me to discuss your things.",
        link: "",
        icon: "video",
        color: ITEM_COLORS[0],
      },
      {
        id: newItemId(),
        title: "Hire me and my team",
        description: "Let's build a world class product for your business.",
        link: "",
        icon: "video",
        color: ITEM_COLORS[1],
      },
    ],
    writings: [
      {
        id: newItemId(),
        title: "How to freelance and make money as a developer",
        date: "",
        link: "",
      },
    ],
  };
}
