"use client";

import React from "react";

export interface CompanyPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  link: string;
  category: string;
  keywords?: string[];
}

// ----------------------------------------------------------------------------
// Authentic Brand SVGs matching the exact logos from reference image & brands
// ----------------------------------------------------------------------------
export const BRAND_SVGS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
  // Cursor — AI Code Editor (3D Cube with shaded facets)
  cursor: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 7.2V16.8L12 22L21 16.8V7.2L12 2Z" fill="#1e1e1e" stroke="currentColor" strokeWidth="0.5" />
      <path d="M12 2L21 7.2L12 12.4L3 7.2L12 2Z" fill="#ffffff" fillOpacity="0.9" />
      <path d="M3 7.2L12 12.4V22L3 16.8V7.2Z" fill="#ffffff" fillOpacity="0.5" />
      <path d="M21 7.2L12 12.4V22L21 16.8V7.2Z" fill="#ffffff" fillOpacity="0.75" />
      <path d="M12 12.4L21 7.2M12 12.4L3 7.2M12 12.4V22" stroke="#1e1e1e" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),

  // Replit — 3 orange blocks
  replit: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3.5C4 2.67 4.67 2 5.5 2H11.5C12.33 2 13 2.67 13 3.5V8H5.5C4.67 8 4 7.33 4 6.5V3.5Z" fill="white" />
      <path d="M11 9.5C11 8.67 11.67 8 12.5 8H18.5C19.33 8 20 8.67 20 9.5V14.5C20 15.33 19.33 16 18.5 16H12.5C11.67 16 11 15.33 11 14.5V9.5Z" fill="white" />
      <path d="M4 17.5C4 16.67 4.67 16 5.5 16H11.5C12.33 16 13 16.67 13 17.5V22H5.5C4.67 22 4 21.33 4 20.5V17.5Z" fill="white" />
    </svg>
  ),

  // Neon — Postgres green glowing N polygon
  neon: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 4.5C5 3.67 5.67 3 6.5 3H9.5C10.33 3 11 3.67 11 4.5V19.5C11 20.33 10.33 21 9.5 21H6.5C5.67 21 5 20.33 5 19.5V4.5Z" fill="white" />
      <path d="M13 4.5C13 3.67 13.67 3 14.5 3H17.5C18.33 3 19 3.67 19 4.5V19.5C19 20.33 18.33 21 17.5 21H14.5C13.67 21 13 20.33 13 19.5V4.5Z" fill="white" />
      <path d="M9 4L15 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),

  // Strapi — Indigo Headless CMS portal
  strapi: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M3 13L12 4L21 13L12 22L3 13Z" fill="white" fillOpacity="0.2" />
      <path d="M7 13L12 8L17 13L12 18L7 13Z" fill="white" />
      <path d="M12 4L21 13H12V4Z" fill="white" fillOpacity="0.7" />
    </svg>
  ),

  // Hostinger — Purple geometric faceted H
  hostinger: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3.5C6 2.67 6.67 2 7.5 2H9.5C10.33 2 11 2.67 11 3.5V20.5C11 21.33 10.33 22 9.5 22H7.5C6.67 22 6 21.33 6 20.5V3.5Z" fill="white" />
      <path d="M13 3.5C13 2.67 13.67 2 14.5 2H16.5C17.33 2 18 2.67 18 3.5V20.5C18 21.33 17.33 22 16.5 22H14.5C13.67 22 13 21.33 13 20.5V3.5Z" fill="white" />
      <path d="M6 10H18V14H6V10Z" fill="white" fillOpacity="0.9" />
    </svg>
  ),

  // PostHog — Yellow hedgehog analytics
  posthog: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 14C4 10.5 6.5 7 11 7C14 7 16.5 8.5 18 11C19.5 13.5 19 16 17 17.5C15 19 12 19 8 19C5.5 19 4 16.5 4 14Z" fill="white" />
      <circle cx="15.5" cy="11.5" r="1.5" fill="#eab308" />
      <path d="M4 11L2 9M6 7L5 4M10 5L10 2M15 6L17 3M19 9L22 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  // Fireworks — Blue AI flare/spark
  fireworks: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="white" />
      <path d="M19 15L20 18L23 19L20 20L19 23L18 20L15 19L18 18L19 15Z" fill="white" fillOpacity="0.8" />
    </svg>
  ),

  // GitHub — Invertocat
  github: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fill="white" />
    </svg>
  ),

  // Supabase — Emerald Bolt
  supabase: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 2L4 13.5H11.5L10.5 22L20 10.5H12.5L13.5 2Z" fill="white" />
    </svg>
  ),

  // Vercel — Triangle
  vercel: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L22 20H2L12 3Z" fill="white" />
    </svg>
  ),

  // Stripe — S
  stripe: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M14.5 9.5C14.5 8.7 13.7 8.2 12.4 8.2C10.7 8.2 9.2 8.8 8.2 9.4V6.2C9.4 5.7 11 5.4 12.6 5.4C16.2 5.4 18.6 7.2 18.6 10.2C18.6 14.8 12.2 14.1 12.2 16.1C12.2 17 13.2 17.5 14.7 17.5C16.6 17.5 18.4 16.8 19.5 16.1V19.4C18.2 20 16.4 20.3 14.6 20.3C10.8 20.3 8.3 18.5 8.3 15.4C8.3 10.7 14.5 11.5 14.5 9.5Z" fill="white" />
    </svg>
  ),

  // OpenAI — Rosette Swirl
  openai: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2a4 4 0 0 1 4 4v3.5l1.5-.866a4 4 0 0 1 4 6.928l-3 1.732V19a4 4 0 0 1-6 3.464l-3-1.732a4 4 0 0 1-2-5.464V12l-1.5.866a4 4 0 0 1-4-6.928l3-1.732V3a4 4 0 0 1 4.5-1z" strokeLinejoin="round" />
    </svg>
  ),

  // Linear — Arc Rings
  linear: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" />
      <path d="M7 17L17 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M5.5 12C5.5 8.41 8.41 5.5 12 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  // Figma — 5 Color Shapes
  figma: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2H12V6.8H8C6.45 6.8 5.2 5.55 5.2 4C5.2 2.45 6.45 2 8 2Z" fill="#F24E1E" />
      <path d="M12 2H16C17.55 2 18.8 3.25 18.8 4.8C18.8 6.35 17.55 7.6 16 7.6H12V2Z" fill="#FF7262" />
      <path d="M12 7.6H16C17.55 7.6 18.8 8.85 18.8 10.4C18.8 11.95 17.55 13.2 16 13.2H12V7.6Z" fill="#1ABCFE" />
      <path d="M12 13.2H8C6.45 13.2 5.2 11.95 5.2 10.4C5.2 8.85 6.45 7.6 8 7.6H12V13.2Z" fill="#0ACF83" />
      <path d="M8 13.2H12V18.8C12 20.35 10.75 21.6 9.2 21.6C7.65 21.6 6.4 20.35 6.4 18.8C6.4 17.25 7.65 13.2 8 13.2Z" fill="#A259FF" />
    </svg>
  ),

  // AWS — Cloud & Smile
  aws: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 14C8 17.5 16 17.5 20 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.5 13.5L20.5 14L19.5 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8.5C6 11 11 11.5 11 9C11 7 8 6.5 7 8.5Z" fill="white" />
      <path d="M14 6.5V11M14 8.5C15 7 18 7.5 18 10V11" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),

  // Google — Multi-color G
  google: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M21.35 11.1H12V14.9H17.38C16.8 16.8 14.8 18.2 12 18.2C8.6 18.2 5.8 15.4 5.8 12C5.8 8.6 8.6 5.8 12 5.8C13.5 5.8 14.8 6.3 15.9 7.2L18.7 4.4C16.9 2.8 14.6 1.9 12 1.9C6.4 1.9 1.9 6.4 1.9 12C1.9 17.6 6.4 22.1 12 22.1C17.8 22.1 21.6 18 21.6 12.3C21.6 11.8 21.5 11.4 21.35 11.1Z" fill="white" />
    </svg>
  ),

  // Discord — Clyde
  discord: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" fill="white" />
    </svg>
  ),

  // Notion — N Box
  notion: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 3.5C4.5 2.67 5.17 2 6 2H18C18.83 2 19.5 2.67 19.5 3.5V20.5C19.5 21.33 18.83 22 18 22H6C5.17 22 4.5 21.33 4.5 20.5V3.5Z" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5" />
      <path d="M8 7V17M8 8L16 16M16 7V17" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Shopify — Shopping Bag
  shopify: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M19 8H5L3 21H21L19 8Z" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 8V5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5V8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 11C11 11 10 11.5 10 12.5C10 14 14 13.5 14 15.5C14 16.5 13 17 12 17" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),

  // Cloudflare — Cloud
  cloudflare: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M18.5 10C17.9 6.6 15 4 11.5 4C8.6 4 6.2 5.8 5.3 8.4C2.3 8.9 0 11.4 0 14.5C0 18.1 2.9 21 6.5 21H18.5C21.5 21 24 18.5 24 15.5C24 12.7 21.8 10.3 19 10H18.5Z" fill="white" />
    </svg>
  ),

  // Tailwind CSS — Wave Crests
  tailwind: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5 1.05.26 1.8 1.03 2.63 1.88C14.48 11.75 16.03 13.33 20 13.33c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-1.05-.26-1.8-1.03-2.63-1.88C17.52 7.58 15.97 6 12 6zM4 13.33c-2.67 0-4.33 1.34-5 4 1-1.33 2.17-1.83 3.5-1.5 1.05.26 1.8 1.03 2.63 1.88C6.48 19.08 8.03 20.67 12 20.67c2.67 0 4.33-1.34 5-4-1 1.33-2.17 1.83-3.5 1.5-1.05-.26-1.8-1.03-2.63-1.88C9.52 14.92 7.97 13.33 4 13.33z" fill="white" />
    </svg>
  ),

  // Docker — Whale & Boxes
  docker: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M22.5 11.5C21.7 10.5 20.5 9.8 19.3 9.7L18.8 9.6C18.6 7.4 17.2 6.5 16 6.5V7.5C16.8 7.5 17.7 8.1 17.8 9.8C16.8 9.9 14.5 10.1 13 11.5H2C1.5 11.5 1 12 1 12.5C1 16.6 4.4 20 8.5 20C13.2 20 17 16.8 18.2 13.5C19.8 13.5 21.6 13.5 23 12.5L22.5 11.5ZM5 8.5H7V10.5H5V8.5ZM8 8.5H10V10.5H8V8.5ZM11 8.5H13V10.5H11V8.5ZM8 5.5H10V7.5H8V5.5ZM11 5.5H13V7.5H11V5.5ZM11 2.5H13V4.5H11V2.5Z" fill="white" />
    </svg>
  ),

  // Next.js — N Monogram
  nextjs: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="black" stroke="white" strokeWidth="1" />
      <path d="M8 8V16M8 8L16 16.5M14.5 8H16V13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Apple
  apple: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.85c.65-.8 1.1-1.92.97-3.04-.96.04-2.12.65-2.8 1.44-.6.69-1.12 1.83-.98 2.92 1.07.08 2.16-.52 2.81-1.32z" fill="white" />
    </svg>
  ),

  // Klack — Black Bold K in light square
  klack: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 4.5C5 3.67 5.67 3 6.5 3H8.5C9.33 3 10 3.67 10 4.5V19.5C10 20.33 9.33 21 8.5 21H6.5C5.67 21 5 20.33 5 19.5V4.5Z" fill="currentColor" />
      <path d="M10 13L17.2 4.6C17.7 4 18.5 3.8 19.2 4.3C19.9 4.8 20 5.6 19.5 6.2L13.8 13L20 20.2C20.5 20.8 20.3 21.7 19.6 22.1C18.9 22.5 18 22.3 17.5 21.6L10 13Z" fill="currentColor" />
    </svg>
  ),

  // Oğuz — Designer portrait circle
  oguz: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <path d="M8.5 14.5C9.5 16.5 14.5 16.5 15.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 6.5C9 4 15 4 17 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),

  // Interface Craft — Multi-color Motion Pill Layers
  interfacecraft: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="5.5" rx="2.5" fill="#ef4444" />
      <rect x="3" y="9.25" width="18" height="5.5" rx="2.5" fill="#06b6d4" />
      <rect x="3" y="15.5" width="18" height="5.5" rx="2.5" fill="#eab308" />
    </svg>
  ),

  // Shadcn UI — Minimalist Forward Slash
  shadcn: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <line x1="16" y1="4" x2="8" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),

  // Tailwind Plus — Cyan wave crests
  tailwindplus: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 9C7 7 10 11 13 9C16 7 18 10 20 9" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 15C7 13 10 17 13 15C16 13 18 16 20 15" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),

  // Derek Briggs — Heisenberg fedora & glasses
  derekbriggs: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 10H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 10V6.5C7 5.5 8 4.5 9.5 4.5H14.5C16 4.5 17 5.5 17 6.5V10" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="12" width="4.5" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="12" width="4.5" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="13.5" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 18.5C10.5 19.5 13.5 19.5 15 18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),

  // Fireship — Orange Flame
  fireship: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C10.5 6 7 8 7 12C7 15.5 9.2 18 12 18C14.8 18 17 15.5 17 12C17 9 14.5 6.5 13.8 5.5C13.5 5 12.8 3.5 12 2Z" fill="#f97316" />
      <path d="M12 9C11 11 9.5 12 9.5 14C9.5 15.5 10.6 16.5 12 16.5C13.4 16.5 14.5 15.5 14.5 14C14.5 12.5 13 11 12 9Z" fill="#fbbf24" />
    </svg>
  ),

  // Rauno — Design Engineer Monogram / Bevel
  rauno: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 7V17M9 7H13.5C15 7 16 8 16 9.5C16 11 15 12 13.5 12H9M13 12L16 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Naval — Philosopher Crest
  naval: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 17V7L16 17V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Autosend — 4-Leaf Propeller / Flower
  autosend: ({ className = "w-5 h-5" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12C9 7 6 9 6 12C6 15 9 17 12 12Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12C15 7 18 9 18 12C18 15 15 17 12 12Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12C7 9 9 6 12 6C15 6 17 9 12 12Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12C7 15 9 18 12 18C15 18 17 15 12 12Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
};

// ----------------------------------------------------------------------------
// Curated list of popular companies with authentic branding
// ----------------------------------------------------------------------------
export const COMPANY_PRESETS: CompanyPreset[] = [
  {
    id: "cursor",
    name: "Cursor",
    description: "AI first code editor and development environment.",
    icon: "cursor",
    color: "#1e1e1e",
    link: "https://cursor.com",
    category: "AI & Dev Tools",
    keywords: ["ai", "editor", "ide", "coding", "cursor"],
  },
  {
    id: "replit",
    name: "Replit",
    description: "AI-powered platform to build and ship software.",
    icon: "replit",
    color: "#f26207",
    link: "https://replit.com",
    category: "AI & Dev Tools",
    keywords: ["replit", "cloud", "ide", "agent", "software"],
  },
  {
    id: "neon",
    name: "Neon",
    description: "Fast Postgres Databases for Teams and Agents.",
    icon: "neon",
    color: "#00e599",
    link: "https://neon.tech",
    category: "Database & Backend",
    keywords: ["postgres", "database", "neon", "serverless", "sql"],
  },
  {
    id: "strapi",
    name: "Strapi",
    description: "Open-Source headless CMS for apps.",
    icon: "strapi",
    color: "#4945ff",
    link: "https://strapi.io",
    category: "CMS & Backend",
    keywords: ["cms", "headless", "strapi", "api", "content"],
  },
  {
    id: "hostinger",
    name: "Hostinger",
    description: "Web hosting and domains platform.",
    icon: "hostinger",
    color: "#673ab7",
    link: "https://hostinger.com",
    category: "Cloud & Hosting",
    keywords: ["hosting", "web", "domains", "vps", "hostinger"],
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Open-Source product analytics platform.",
    icon: "posthog",
    color: "#f5a623",
    link: "https://posthog.com",
    category: "Analytics & Product",
    keywords: ["analytics", "product", "posthog", "events", "session"],
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    description: "Open-source AI models at blazing speed.",
    icon: "fireworks",
    color: "#3b82f6",
    link: "https://fireworks.ai",
    category: "AI & Dev Tools",
    keywords: ["ai", "llm", "fireworks", "inference", "models"],
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "The Open Source Firebase alternative.",
    icon: "supabase",
    color: "#3ecf8e",
    link: "https://supabase.com",
    category: "Database & Backend",
    keywords: ["supabase", "postgres", "auth", "realtime", "storage"],
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Frontend cloud platform for Next.js and web apps.",
    icon: "vercel",
    color: "#000000",
    link: "https://vercel.com",
    category: "Cloud & Hosting",
    keywords: ["vercel", "nextjs", "deploy", "serverless", "edge"],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Development platform to build, scale, and deliver software.",
    icon: "github",
    color: "#24292e",
    link: "https://github.com",
    category: "AI & Dev Tools",
    keywords: ["git", "code", "repo", "actions", "github"],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Financial infrastructure for the internet.",
    icon: "stripe",
    color: "#635bff",
    link: "https://stripe.com",
    category: "Payments & SaaS",
    keywords: ["stripe", "payments", "billing", "checkout", "finance"],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Pioneering research and deployment of generative AI.",
    icon: "openai",
    color: "#10a37f",
    link: "https://openai.com",
    category: "AI & Dev Tools",
    keywords: ["openai", "gpt", "chatgpt", "api", "ai"],
  },
  {
    id: "linear",
    name: "Linear",
    description: "Purpose-built tool for modern product teams.",
    icon: "linear",
    color: "#5e6ad2",
    link: "https://linear.app",
    category: "Productivity",
    keywords: ["linear", "issue", "tracker", "project", "product"],
  },
  {
    id: "figma",
    name: "Figma",
    description: "Collaborative interface design tool.",
    icon: "figma",
    color: "#0acf83",
    link: "https://figma.com",
    category: "Design",
    keywords: ["figma", "design", "ui", "ux", "prototype"],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Connected workspace for docs, wikis, and tasks.",
    icon: "notion",
    color: "#18181b",
    link: "https://notion.so",
    category: "Productivity",
    keywords: ["notion", "docs", "notes", "wiki", "workspace"],
  },
  {
    id: "aws",
    name: "Amazon Web Services",
    description: "Comprehensive and broadly adopted cloud platform.",
    icon: "aws",
    color: "#ff9900",
    link: "https://aws.amazon.com",
    category: "Cloud & Hosting",
    keywords: ["aws", "cloud", "amazon", "server", "s3"],
  },
  {
    id: "google",
    name: "Google",
    description: "Search, cloud computing, and developer software.",
    icon: "google",
    color: "#4285f4",
    link: "https://google.com",
    category: "Cloud & Hosting",
    keywords: ["google", "cloud", "search", "gcp", "android"],
  },
  {
    id: "discord",
    name: "Discord",
    description: "Voice, video and text chat platform for communities.",
    icon: "discord",
    color: "#5865f2",
    link: "https://discord.com",
    category: "Community",
    keywords: ["discord", "community", "chat", "bot", "voice"],
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Complete commerce platform to start and run a business.",
    icon: "shopify",
    color: "#95bf47",
    link: "https://shopify.com",
    category: "Commerce",
    keywords: ["shopify", "store", "ecommerce", "merchant", "checkout"],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Global cloud network for security and speed.",
    icon: "cloudflare",
    color: "#f38020",
    link: "https://cloudflare.com",
    category: "Cloud & Hosting",
    keywords: ["cloudflare", "dns", "cdn", "workers", "security"],
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    description: "Utility-first CSS framework for rapid UI development.",
    icon: "tailwind",
    color: "#0ea5e9",
    link: "https://tailwindcss.com",
    category: "Design & Dev",
    keywords: ["tailwind", "css", "styling", "ui", "web"],
  },
  {
    id: "docker",
    name: "Docker",
    description: "Accelerate how you build, share, and run applications.",
    icon: "docker",
    color: "#2496ed",
    link: "https://docker.com",
    category: "DevOps & Containers",
    keywords: ["docker", "container", "devops", "kubernetes", "image"],
  },
  {
    id: "nextjs",
    name: "Next.js",
    description: "The React framework for the web.",
    icon: "nextjs",
    color: "#000000",
    link: "https://nextjs.org",
    category: "Design & Dev",
    keywords: ["nextjs", "react", "vercel", "ssr", "web"],
  },
  {
    id: "apple",
    name: "Apple",
    description: "Software, iOS, macOS, and hardware ecosystems.",
    icon: "apple",
    color: "#18181b",
    link: "https://apple.com",
    category: "Tech Giant",
    keywords: ["apple", "ios", "macos", "swift", "appstore"],
  },
  {
    id: "klack",
    name: "Klack",
    description: "Neat product and website",
    icon: "klack",
    color: "#f4f4f5",
    link: "https://klack.app",
    category: "Inspiration & Tools",
    keywords: ["klack", "mac", "audio", "keystroke", "app"],
  },
  {
    id: "oguz",
    name: "Oğuz",
    description: "Designer with god level skills",
    icon: "oguz",
    color: "#27272a",
    link: "https://oguz.design",
    category: "Designers & People",
    keywords: ["oguz", "designer", "portfolio", "craft"],
  },
  {
    id: "interfacecraft",
    name: "Interface Craft",
    description: "Amazing resource to learn motion",
    icon: "interfacecraft",
    color: "#000000",
    link: "https://interfacecraft.design",
    category: "Inspiration & Motion",
    keywords: ["motion", "interface", "animation", "learn"],
  },
  {
    id: "shadcn",
    name: "Shadcn UI",
    description: "A library that changed my life",
    icon: "shadcn",
    color: "#18181b",
    link: "https://ui.shadcn.com",
    category: "Design & Dev",
    keywords: ["shadcn", "ui", "react", "tailwind", "components"],
  },
  {
    id: "tailwindplus",
    name: "Tailwind Plus",
    description: "Where it all started",
    icon: "tailwindplus",
    color: "#e0f2fe",
    link: "https://tailwindui.com",
    category: "Design & Dev",
    keywords: ["tailwind", "plus", "ui", "templates"],
  },
  {
    id: "derekbriggs",
    name: "Derek Briggs",
    description: "Designer I look up to",
    icon: "derekbriggs",
    color: "#18181b",
    link: "https://derekbriggs.com",
    category: "Designers & People",
    keywords: ["derek", "briggs", "designer", "craft"],
  },
  {
    id: "fireship",
    name: "Fireship",
    description: "All time favourite YouTuber",
    icon: "fireship",
    color: "#ffedd5",
    link: "https://youtube.com/@fireship",
    category: "Creators & Media",
    keywords: ["fireship", "youtube", "code", "tutorials", "dev"],
  },
  {
    id: "rauno",
    name: "Rauno",
    description: "God level design engineer",
    icon: "rauno",
    color: "#334155",
    link: "https://rauno.me",
    category: "Designers & People",
    keywords: ["rauno", "design", "engineer", "craft", "vercel"],
  },
  {
    id: "naval",
    name: "Naval",
    description: "Entrepreneur, philosopher and investor I look up to",
    icon: "naval",
    color: "#e2e8f0",
    link: "https://navalinstitute.com",
    category: "Thinkers & Mentors",
    keywords: ["naval", "ravikant", "philosophy", "investor"],
  },
  {
    id: "autosend",
    name: "Autosend",
    description: "Landing page that I love, software that I admire.",
    icon: "autosend",
    color: "#f4f4f5",
    link: "https://autosend.app",
    category: "Inspiration & Tools",
    keywords: ["autosend", "landing", "saas", "software"],
  },
];
