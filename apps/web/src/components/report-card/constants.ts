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

export const DEFAULT_SETTINGS: CardSettings = {
  font: "schibsted",
  accent: "#e7e5e4",
};

export function fontCssVar(font: string): string {
  const match = FONT_OPTIONS.find((f) => f.id === font);
  return match ? match.cssVar : FONT_OPTIONS[0].cssVar;
}

// ----------------------------------------------------------------------------
// Page tabs — each one is a real route (Home / Inspiration / Projects / Sponsor)
// ----------------------------------------------------------------------------
export type CardTab = "home" | "inspiration" | "projects" | "sponsor";

export const CARD_TABS: { id: CardTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "inspiration", label: "Inspiration" },
  { id: "projects", label: "Projects" },
  { id: "sponsor", label: "Sponsor" },
];

export const TAB_TO_SECTION: Record<CardTab, string> = {
  home: "things_i_do",
  inspiration: "inspirations",
  projects: "projects",
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
    inspirations: [],
    inspiration_intro: [],
    projects: [],
    projects_intro: [],
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
    !content.quote?.text?.trim() &&
    !content.footer?.signature_name?.trim()
  );
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

/**
 * Starter layout matching the exact design, inspirations, and projects:
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
        title: "Design Engineering and Taste",
        description: "I break down designs, talk about developing design taste and share trends.",
        link: "https://manuarora.in",
        icon: "paintbrush",
        color: "#65a30d",
      },
      {
        id: newItemId(),
        title: "AI Tools, Workflows and Processes",
        description: "I use AI tools and check their usablility in my daily workflow. I share my learnings and tips on how to use them effectively.",
        link: "https://ui.aceternity.com",
        icon: "wand",
        color: "#e11d48",
      },
      {
        id: newItemId(),
        title: "SaaS and Product Development",
        description: "I build products and apps that can impact millions of lives. As I build, I talk about it.",
        link: "https://algochurn.com",
        icon: "appwindow",
        color: "#9333ea",
      },
    ],
    companies: [
      {
        id: newItemId(),
        title: "Cursor",
        description: "AI first code editor and development environment.",
        link: "https://cursor.com",
        icon: "cursor",
        color: "#1e1e1e",
      },
      {
        id: newItemId(),
        title: "Replit",
        description: "AI-powered platform to build and ship software.",
        link: "https://replit.com",
        icon: "replit",
        color: "#f26207",
      },
      {
        id: newItemId(),
        title: "Neon",
        description: "Fast Postgres Databases for Teams and Agents.",
        link: "https://neon.tech",
        icon: "neon",
        color: "#00e599",
      },
      {
        id: newItemId(),
        title: "Strapi",
        description: "Open-Source headless CMS for apps.",
        link: "https://strapi.io",
        icon: "strapi",
        color: "#4945ff",
      },
      {
        id: newItemId(),
        title: "Hostinger",
        description: "Web hosting and domains platform.",
        link: "https://hostinger.com",
        icon: "hostinger",
        color: "#673ab7",
      },
      {
        id: newItemId(),
        title: "Posthog",
        description: "Open-Source product analytics platform.",
        link: "https://posthog.com",
        icon: "posthog",
        color: "#f5a623",
      },
      {
        id: newItemId(),
        title: "Fireworks",
        description: "Open-source AI models at blazing speed.",
        link: "https://fireworks.ai",
        icon: "fireworks",
        color: "#3b82f6",
      },
    ],
    inspiration_intro: [
      "A list of all the people that I look up to, websites that I admire, tools that I use and everything else that follows.",
      "I will keep on updating this list as I find more inspiration.",
    ],
    inspirations: [
      {
        id: newItemId(),
        title: "Klack",
        description: "Neat product and website",
        link: "https://klack.app",
        icon: "klack",
        color: "#18181b",
      },
      {
        id: newItemId(),
        title: "Oğuz",
        description: "Designer with god level skills",
        link: "https://oguz.design",
        icon: "oguz",
        color: "#27272a",
      },
      {
        id: newItemId(),
        title: "Interface Craft",
        description: "Amazing resource to learn motion",
        link: "https://interfacecraft.design",
        icon: "interfacecraft",
        color: "#000000",
      },
      {
        id: newItemId(),
        title: "Shadcn UI",
        description: "A library that changed my life",
        link: "https://ui.shadcn.com",
        icon: "shadcn",
        color: "#18181b",
      },
      {
        id: newItemId(),
        title: "Tailwind Plus",
        description: "Where it all started",
        link: "https://tailwindui.com",
        icon: "tailwindplus",
        color: "#e0f2fe",
      },
      {
        id: newItemId(),
        title: "Posthog",
        description: "Analytics tool that has made my life so much easier.",
        link: "https://posthog.com",
        icon: "posthog",
        color: "#fef3c7",
      },
      {
        id: newItemId(),
        title: "Derek Briggs",
        description: "Designer I look up to",
        link: "https://derekbriggs.com",
        icon: "derekbriggs",
        color: "#18181b",
      },
      {
        id: newItemId(),
        title: "Fireship",
        description: "All time favourite YouTuber",
        link: "https://youtube.com/@fireship",
        icon: "fireship",
        color: "#ffedd5",
      },
      {
        id: newItemId(),
        title: "Rauno",
        description: "God level design engineer",
        link: "https://rauno.me",
        icon: "rauno",
        color: "#334155",
      },
      {
        id: newItemId(),
        title: "Naval",
        description: "Entrepreneur, philosopher and investor I look up to",
        link: "https://navalinstitute.com",
        icon: "naval",
        color: "#e2e8f0",
      },
      {
        id: newItemId(),
        title: "Autosend",
        description: "Landing page that I love, software that I admire.",
        link: "https://autosend.app",
        icon: "autosend",
        color: "#f4f4f5",
      },
    ],
    projects_intro: [
      "Selected freelance and personal projects across Web Development, Mobile Apps, UI/UX Design, and Graphic Design.",
      "Each project is crafted with high attention to detail, performance, and user experience.",
    ],
    projects: [
      {
        id: newItemId(),
        title: "Aceternity UI",
        description: "Modern animated component library for Next.js & Tailwind CSS powering over 200k developers worldwide.",
        category: "Web Dev",
        link: "https://ui.aceternity.com",
        icon: "globe",
        color: "#3b82f6",
        tags: ["Next.js", "React", "Tailwind CSS", "Framer Motion"],
        year: "2024",
      },
      {
        id: newItemId(),
        title: "FinFlow SaaS Banking",
        description: "High-conversion SaaS banking dashboard, multi-currency wallet flow, and complete mobile UX architecture.",
        category: "UI/UX Design",
        link: "https://figma.com",
        icon: "palette",
        color: "#8b5cf6",
        tags: ["Figma", "Design Systems", "Prototyping", "Fintech"],
        year: "2024",
      },
      {
        id: newItemId(),
        title: "Pulse Mobile Health Tracker",
        description: "Cross-platform mobile wellness and biometric tracking app with Apple Health sync and offline charts.",
        category: "App Dev",
        link: "https://github.com",
        icon: "appwindow",
        color: "#10b981",
        tags: ["React Native", "Expo", "TypeScript", "Tailwind"],
        year: "2024",
      },
      {
        id: newItemId(),
        title: "Vanguard Brand Identity",
        description: "Comprehensive visual identity, typography system, 3D asset guidelines, packaging, and custom logo suite.",
        category: "Graphic Design",
        link: "https://dribbble.com",
        icon: "paintbrush",
        color: "#f97316",
        tags: ["Illustrator", "Brand Identity", "Vector", "3D Art"],
        year: "2023",
      },
      {
        id: newItemId(),
        title: "AlgoChurn Platform",
        description: "Developer technical interview preparation platform with interactive coding playgrounds and real-time execution.",
        category: "Web Dev",
        link: "https://algochurn.com",
        icon: "terminal",
        color: "#ec4899",
        tags: ["Next.js", "PostgreSQL", "Tailwind", "Docker"],
        year: "2023",
      },
      {
        id: newItemId(),
        title: "Nova AI Studio",
        description: "Next-gen creative generative canvas interface for product design teams and art directors.",
        category: "UI/UX Design",
        link: "https://figma.com",
        icon: "sparkles",
        color: "#06b6d4",
        tags: ["UI/UX", "Generative AI", "Figma", "Framer"],
        year: "2024",
      },
    ],
    work_with_me: [
      {
        id: newItemId(),
        title: "Consultation",
        description: "Get on a paid call with me to discuss your things.",
        link: "https://cal.com",
        icon: "video",
        color: "#2563eb",
      },
      {
        id: newItemId(),
        title: "Hire me and my team",
        description: "Let's build a world class website for your business.",
        link: "mailto:hello@example.com",
        icon: "folder",
        color: "#f97316",
      },
      {
        id: newItemId(),
        title: "Sponsor my video",
        description: "Get your brand in front of my audience.",
        link: "https://sponsor.example.com",
        icon: "video",
        color: "#10b981",
      },
    ],
    writings: [
      {
        id: newItemId(),
        title: "How to freelance and make money as a developer",
        date: "24-03-2022",
        link: "https://blog.example.com/how-to-freelance",
      },
    ],
    quote: {
      text: "Ship quality code, stay curious, and build things that genuinely help people move faster.",
      author: "Daily Manifesto",
      emoji: "⚡",
    },
    footer: {
      signature_name: "Manu",
      code_link: "https://github.com",
      video_link: "https://youtube.com",
      inspired_by_name: "Akash Bhadange",
      inspired_by_link: "https://bhadangeakash.com",
    },
  };
}
