export interface LinkPageRenderItem {
  id: string;
  label: string;
  url: string;
  icon?: string | null;
  description?: string | null;
}

export interface LinkPageRenderData {
  display_name: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  items: LinkPageRenderItem[];
}

export const LINK_TEMPLATES = [
  { key: "classic", name: "Classic Dark", blurb: "Timeless Linktree-style dark page with pill buttons" },
  { key: "minimal", name: "Editorial Minimal", blurb: "Quiet light layout with serif type and underline links" },
  { key: "split", name: "Split Cover", blurb: "Brand-orange cover beside numbered link rows" },
  { key: "bold", name: "Studio Bold", blurb: "Black canvas, oversized type and numbered rows" },
  { key: "cards", name: "Warm Cards", blurb: "Soft two-column cards with descriptions" },
  { key: "neon", name: "Terminal Neon", blurb: "Monospace glow for developers and designers" },
] as const;

export type LinkTemplateKey = (typeof LINK_TEMPLATES)[number]["key"];
