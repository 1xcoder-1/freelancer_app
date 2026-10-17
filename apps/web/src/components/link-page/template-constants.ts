export interface LinkPageRenderItem {
  id: string;
  label: string;
  url: string;
  item_type?: string | null;
  icon?: string | null;
  description?: string | null;
  image_url?: string | null;
}

export interface LinkPageRenderData {
  display_name: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  background_image_url?: string | null;
  background_overlay?: number | null;
  items: LinkPageRenderItem[];
}

export type ItemRole = "header" | "divider" | "link";

/* Rows saved before item_type existed marked headings with magic icon/url
   values; keep honouring those, new data wins via item_type. */
export function itemRole(item: LinkPageRenderItem): ItemRole {
  const type = (item.item_type || "").toLowerCase();
  if (type === "header" || type === "divider") return type;
  if (item.icon === "heading" || item.icon === "section" || item.icon === "divider") {
    return item.icon === "divider" ? "divider" : "header";
  }
  if (item.url && (item.url.includes("#header") || item.url.includes("#section"))) {
    return "header";
  }
  return "link";
}

/* Platforms rendered as compact round icon buttons below the link list — the
   social row every reference design shows. Everything else is a full-width
   row. Utility targets (website, booking, store...) stay full-width buttons
   so a main CTA never shrinks into the icon row. */
const SOCIAL_ICON_KEYS = new Set([
  "instagram", "tiktok", "youtube", "twitter", "x", "github", "linkedin",
  "discord", "spotify", "whatsapp", "mail", "email", "facebook", "substack",
]);

const SOCIAL_URL_HOSTS = [
  "instagram.com", "tiktok.com", "youtube.com", "youtu.be", "x.com",
  "twitter.com", "github.com", "linkedin.com", "discord", "spotify.com",
  "wa.me", "whatsapp.com", "facebook.com", "substack.com",
];

export function isSocialItem(item: LinkPageRenderItem): boolean {
  if (itemRole(item) !== "link") return false;
  const icon = (item.icon || "").trim().toLowerCase();
  if (icon && SOCIAL_ICON_KEYS.has(icon)) return true;
  const url = (item.url || "").toLowerCase();
  return SOCIAL_URL_HOSTS.some((host) => url.includes(host));
}

export const LINK_TEMPLATES = [
  {
    key: "fresh-press",
    name: "Fresh Press",
    archetype: "Juice Bar Fresh",
    blurb: "Sage green canvas with soft pill buttons and a laid-back market feel",
    palette: ["#5A6753", "#C9CDC4", "#FFFFFF"],
    fontFamily: "Inter / Modern Sans",
    category: "light",
    backdrop: "linear-gradient(180deg, #4d5946 0%, #3c463a 100%)",
  },
  {
    key: "honeyed",
    name: "Honeyed",
    archetype: "Mono Blue Pastry",
    blurb: "Powdery blue canvas, mono type and fine outlined buttons around a coral mark",
    palette: ["#E9EAF3", "#F2827B", "#2B3AA5"],
    fontFamily: "JetBrains / Mono",
    category: "light",
    backdrop: "linear-gradient(180deg, #dcddeb 0%, #c9cce0 100%)",
  },
  {
    key: "studio-cloud",
    name: "Studio Cloud",
    archetype: "Doodle Sketchbook",
    blurb: "Airy sketchbook page with hand-drawn clouds and outlined pill links",
    palette: ["#F3F2F8", "#4A5BD0", "#FFFFFF"],
    fontFamily: "Inter / Geometric Sans",
    category: "light",
    backdrop: "linear-gradient(180deg, #e4e3ef 0%, #d3d2e4 100%)",
  },
  {
    key: "hardwave",
    name: "Hardwave",
    archetype: "Sunset Techno",
    blurb: "Stage-light orange burning into charcoal, clean white bars over grain",
    palette: ["#D2702F", "#191715", "#FFFFFF"],
    fontFamily: "Inter / Grotesk",
    category: "dark",
    backdrop: "linear-gradient(180deg, #191715 0%, #0d0c0b 100%)",
  },
  {
    key: "prism",
    name: "Prism",
    archetype: "Holographic Pastel",
    blurb: "Iridescent foil gradient with crisp white cards and airy type",
    palette: ["#C9D2F0", "#F2C9DC", "#23222E"],
    fontFamily: "Inter / Soft Sans",
    category: "light",
    backdrop: "linear-gradient(150deg, #c5c3dd 0%, #a9a8c4 100%)",
  },
  {
    key: "paper",
    name: "Paper",
    archetype: "Torn Paper Serif",
    blurb: "Warm grey stock with serif type and torn-paper link strips",
    palette: ["#B7B4AD", "#FCFCFA", "#2B2A26"],
    fontFamily: "Georgia / Editorial Serif",
    category: "light",
    backdrop: "linear-gradient(180deg, #8f8c85 0%, #7c7972 100%)",
  },
] as const;

export type LinkTemplateKey = (typeof LINK_TEMPLATES)[number]["key"];

/* Backdrop painted behind the centered card on desktop viewports (mobile is
   fullscreen, so the backdrop is only visible md+). */
export function getTemplateBackdrop(template: string): string {
  return LINK_TEMPLATES.find((t) => t.key === template)?.backdrop ?? "#0f1115";
}

/* Scrim used when a page has a background photo: keeps text readable on busy
   images. Overlay 0-1 comes from the page settings; this is the fallback. */
export const DEFAULT_BACKGROUND_OVERLAY = 0.35;
