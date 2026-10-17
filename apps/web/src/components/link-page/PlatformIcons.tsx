"use client";

import React from "react";
import {
  Github,
  Linkedin,
  Youtube,
  Calendar,
  Globe,
  Mail,
  FileText,
  Sparkles,
  Link2,
  Heading,
  ShoppingBag,
  Mic,
  Palette,
  Phone,
} from "lucide-react";

export interface PlatformPreset {
  id: string;
  name: string;
  icon: string;
  category: "social" | "work" | "contact" | "content";
  placeholderUrl: string;
  suggestedTitle: string;
  brandColor: string;
  bgColor: string;
}

// Curated platform presets for modern freelancers, designers, and creators
export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: "github",
    name: "GitHub",
    icon: "github",
    category: "work",
    placeholderUrl: "https://github.com/username",
    suggestedTitle: "GitHub Profile & Code",
    brandColor: "#ffffff",
    bgColor: "#24292e",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: "twitter",
    category: "social",
    placeholderUrl: "https://x.com/username",
    suggestedTitle: "Follow on X",
    brandColor: "#1DA1F2",
    bgColor: "#0f1419",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "linkedin",
    category: "work",
    placeholderUrl: "https://linkedin.com/in/username",
    suggestedTitle: "Connect on LinkedIn",
    brandColor: "#0A66C2",
    bgColor: "#0A66C220",
  },
  {
    id: "calendar",
    name: "Calendly / Meeting",
    icon: "calendar",
    category: "contact",
    placeholderUrl: "https://cal.com/username or calendly.com/...",
    suggestedTitle: "Book a Consultation Call",
    brandColor: "#10b981",
    bgColor: "#10b98120",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "youtube",
    category: "content",
    placeholderUrl: "https://youtube.com/@channel",
    suggestedTitle: "Watch Latest Videos",
    brandColor: "#FF0000",
    bgColor: "#FF000020",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "instagram",
    category: "social",
    placeholderUrl: "https://instagram.com/username",
    suggestedTitle: "Follow on Instagram",
    brandColor: "#E1306C",
    bgColor: "#E1306C20",
  },
  {
    id: "figma",
    name: "Figma / Portfolio",
    icon: "figma",
    category: "work",
    placeholderUrl: "https://figma.com/@username",
    suggestedTitle: "Design Portfolio & Systems",
    brandColor: "#F24E1E",
    bgColor: "#F24E1E20",
  },
  {
    id: "dribbble",
    name: "Dribbble",
    icon: "dribbble",
    category: "work",
    placeholderUrl: "https://dribbble.com/username",
    suggestedTitle: "Visual Showcase on Dribbble",
    brandColor: "#EA4C89",
    bgColor: "#EA4C8920",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "discord",
    category: "social",
    placeholderUrl: "https://discord.gg/invite",
    suggestedTitle: "Join Discord Community",
    brandColor: "#5865F2",
    bgColor: "#5865F220",
  },
  {
    id: "spotify",
    name: "Spotify / Music",
    icon: "spotify",
    category: "content",
    placeholderUrl: "https://open.spotify.com/...",
    suggestedTitle: "Listen on Spotify",
    brandColor: "#1DB954",
    bgColor: "#1DB95420",
  },
  {
    id: "substack",
    name: "Substack / Blog",
    icon: "substack",
    category: "content",
    placeholderUrl: "https://username.substack.com",
    suggestedTitle: "Read Weekly Newsletter",
    brandColor: "#FF6719",
    bgColor: "#FF671920",
  },
  {
    id: "globe",
    name: "Personal Website",
    icon: "globe",
    category: "work",
    placeholderUrl: "https://mywebsite.com",
    suggestedTitle: "Official Website",
    brandColor: "#38bdf8",
    bgColor: "#38bdf820",
  },
  {
    id: "mail",
    name: "Direct Email",
    icon: "mail",
    category: "contact",
    placeholderUrl: "mailto:hello@example.com",
    suggestedTitle: "Get in Touch via Email",
    brandColor: "#f59e0b",
    bgColor: "#f59e0b20",
  },
  {
    id: "store",
    name: "Digital Store / Gumroad",
    icon: "store",
    category: "work",
    placeholderUrl: "https://store.example.com",
    suggestedTitle: "Shop Templates & Products",
    brandColor: "#ec4899",
    bgColor: "#ec489920",
  },
  {
    id: "podcast",
    name: "Podcast",
    icon: "podcast",
    category: "content",
    placeholderUrl: "https://podcast.example.com",
    suggestedTitle: "Listen to the Podcast",
    brandColor: "#a855f7",
    bgColor: "#a855f720",
  },
  {
    id: "resume",
    name: "Resume / CV",
    icon: "resume",
    category: "work",
    placeholderUrl: "https://readcv.com/... or pdf link",
    suggestedTitle: "Download Resume / CV",
    brandColor: "#64748b",
    bgColor: "#64748b20",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "whatsapp",
    category: "contact",
    placeholderUrl: "https://wa.me/1234567890",
    suggestedTitle: "Chat on WhatsApp",
    brandColor: "#25D366",
    bgColor: "#25D36620",
  },
];

// Clean brand SVG definitions for logos not available in basic icon sets
export function BrandSvg({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  switch (name) {
    case "instagram":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      );
    case "facebook":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"/>
        </svg>
      );
    case "x":
    case "twitter":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case "figma":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4zM4 12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4zm0-8c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4zm8-4h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0zm0 8h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V8z"/>
        </svg>
      );
    case "dribbble":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94" />
          <path d="M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32" />
          <path d="M8.56 2.75c4.37 6 6 9.42 8 17.72" />
        </svg>
      );
    case "discord":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      );
    case "spotify":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.281c-.6.18-1.2-.179-1.38-.779-.18-.6.18-1.2.78-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.619.359z"/>
        </svg>
      );
    case "substack":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
        </svg>
      );
    case "whatsapp":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
      );
    default:
      return <Link2 className={className} />;
  }
}

/**
 * Universal Platform Icon Renderer.
 * Accepts an icon key (e.g. "github", "twitter", "calendar", "heading")
 * or an emoji string (e.g. "🚀", "✨") and renders appropriately.
 */
export function PlatformIconRenderer({
  icon,
  className = "w-4 h-4",
  fallback = null,
}: {
  icon?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}) {
  if (!icon || !icon.trim()) {
    return fallback ? <>{fallback}</> : <Link2 className={className} />;
  }

  const clean = icon.trim().toLowerCase();

  // If it's an emoji (single or multi-byte unicode)
  if (/\p{Extended_Pictographic}/u.test(icon)) {
    return (
      <span className="inline-flex items-center justify-center text-base leading-none select-none transition-transform hover:scale-110">
        {icon}
      </span>
    );
  }

  // Brand / Vector Platforms
  switch (clean) {
    case "github":
      return <Github className={className} />;
    case "twitter":
    case "x":
      return <BrandSvg name="x" className={className} />;
    case "linkedin":
      return <Linkedin className={className} />;
    case "youtube":
      return <Youtube className={className} />;
    case "instagram":
      return <BrandSvg name="instagram" className={className} />;
    case "tiktok":
      return <BrandSvg name="tiktok" className={className} />;
    case "facebook":
      return <BrandSvg name="facebook" className={className} />;
    case "figma":
      return <BrandSvg name="figma" className={className} />;
    case "dribbble":
      return <BrandSvg name="dribbble" className={className} />;
    case "discord":
      return <BrandSvg name="discord" className={className} />;
    case "spotify":
      return <BrandSvg name="spotify" className={className} />;
    case "substack":
      return <BrandSvg name="substack" className={className} />;
    case "whatsapp":
      return <BrandSvg name="whatsapp" className={className} />;
    case "calendar":
    case "booking":
    case "calendly":
      return <Calendar className={className} />;
    case "globe":
    case "website":
    case "web":
      return <Globe className={className} />;
    case "mail":
    case "email":
    case "newsletter":
      return <Mail className={className} />;
    case "store":
    case "shop":
      return <ShoppingBag className={className} />;
    case "podcast":
    case "audio":
      return <Mic className={className} />;
    case "resume":
    case "cv":
    case "doc":
      return <FileText className={className} />;
    case "heading":
    case "header":
    case "section":
      return <Heading className={className} />;
    case "sparkles":
      return <Sparkles className={className} />;
    case "design":
      return <Palette className={className} />;
    case "phone":
      return <Phone className={className} />;
    default:
      return <Link2 className={className} />;
  }
}

export function detectPlatformFromUrl(rawUrl: string): PlatformPreset | null {
  if (!rawUrl) return null;
  const url = rawUrl.toLowerCase().trim();
  if (url.includes("github.com")) return PLATFORM_PRESETS.find((p) => p.id === "github") || null;
  if (url.includes("twitter.com") || url.includes("x.com")) return PLATFORM_PRESETS.find((p) => p.id === "twitter") || null;
  if (url.includes("linkedin.com")) return PLATFORM_PRESETS.find((p) => p.id === "linkedin") || null;
  if (url.includes("cal.com") || url.includes("calendly.com")) return PLATFORM_PRESETS.find((p) => p.id === "calendar") || null;
  if (url.includes("youtube.com") || url.includes("youtu.be")) return PLATFORM_PRESETS.find((p) => p.id === "youtube") || null;
  if (url.includes("instagram.com")) return PLATFORM_PRESETS.find((p) => p.id === "instagram") || null;
  if (url.includes("figma.com")) return PLATFORM_PRESETS.find((p) => p.id === "figma") || null;
  if (url.includes("dribbble.com")) return PLATFORM_PRESETS.find((p) => p.id === "dribbble") || null;
  if (url.includes("discord.gg") || url.includes("discord.com")) return PLATFORM_PRESETS.find((p) => p.id === "discord") || null;
  if (url.includes("spotify.com")) return PLATFORM_PRESETS.find((p) => p.id === "spotify") || null;
  if (url.includes("substack.com")) return PLATFORM_PRESETS.find((p) => p.id === "substack") || null;
  if (url.includes("wa.me") || url.includes("whatsapp.com")) return PLATFORM_PRESETS.find((p) => p.id === "whatsapp") || null;
  if (url.startsWith("mailto:")) return PLATFORM_PRESETS.find((p) => p.id === "mail") || null;
  return null;
}
