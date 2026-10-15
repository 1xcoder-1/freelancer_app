"use client";

import React from "react";

export * from "./template-constants";
import {
  LINK_TEMPLATES,
  type LinkTemplateKey,
  type LinkPageRenderData,
  type LinkPageRenderItem,
} from "./template-constants";

interface TemplateProps {
  data: LinkPageRenderData;
  onLinkClick?: (item: LinkPageRenderItem) => void;
  // Preview mode: links render but never navigate.
  inert?: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "★";
}

function Avatar({ data, size, ring, fallbackBg, fg }: { data: LinkPageRenderData; size: number; ring: string; fallbackBg: string; fg: string }) {
  if (data.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data.avatar_url}
        alt={data.display_name}
        style={{ width: size, height: size, border: `2px solid ${ring}` }}
        className="rounded-full object-cover mx-auto"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, background: fallbackBg, color: fg, border: `2px solid ${ring}` }}
      className="rounded-full mx-auto flex items-center justify-center font-bold"
    >
      <span style={{ fontSize: size * 0.38 }}>{initials(data.display_name)}</span>
    </div>
  );
}

function guard(inert: boolean | undefined, fn: () => void) {
  return (e: React.MouseEvent) => {
    if (inert) {
      e.preventDefault();
      return;
    }
    fn();
  };
}

// 1. Classic Dark -------------------------------------------------------------
function ClassicDark({ data, onLinkClick, inert }: TemplateProps) {
  return (
    <div style={{ background: "#0F0F10", minHeight: "100%" }} className="px-6 py-12 text-center">
      <Avatar data={data} size={92} ring="#27272a" fallbackBg="#18181b" fg="#fafafa" />
      <h1 style={{ color: "#fafafa" }} className="text-2xl font-bold mt-5 tracking-tight">{data.display_name}</h1>
      {data.headline && <p style={{ color: "#a1a1aa" }} className="text-sm mt-1.5">{data.headline}</p>}
      {data.bio && <p style={{ color: "#71717a" }} className="text-xs mt-3 max-w-md mx-auto leading-relaxed whitespace-pre-line">{data.bio}</p>}
      <div className="mt-8 space-y-3.5 max-w-sm mx-auto">
        {data.items.map((item) => (
          <a
            key={item.id}
            href={inert ? undefined : item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={guard(inert, () => onLinkClick?.(item))}
            style={{ background: "#fafafa", color: "#09090b" }}
            className="block rounded-full px-5 py-3.5 text-sm font-semibold transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]"
          >
            {item.icon && <span className="mr-2">{item.icon}</span>}
            {item.label}
          </a>
        ))}
      </div>
      {data.items.length === 0 && (
        <p style={{ color: "#3f3f46" }} className="mt-10 text-sm">No links yet.</p>
      )}
    </div>
  );
}

// 2. Editorial Minimal ---------------------------------------------------------
function EditorialMinimal({ data, onLinkClick, inert }: TemplateProps) {
  return (
    <div style={{ background: "#FAFAF8", minHeight: "100%" }} className="px-6 py-16">
      <div className="max-w-md mx-auto text-center">
        <Avatar data={data} size={72} ring="#E4E2DC" fallbackBg="#EFEEE8" fg="#3A3833" />
        <h1 style={{ color: "#26251F", fontFamily: "Georgia, 'Times New Roman', serif" }} className="text-3xl font-semibold mt-5">
          {data.display_name}
        </h1>
        {data.headline && (
          <p style={{ color: "#8A867B" }} className="text-sm mt-2 uppercase tracking-[0.2em]">{data.headline}</p>
        )}
        {data.bio && <p style={{ color: "#5C584F" }} className="text-sm mt-4 leading-relaxed whitespace-pre-line">{data.bio}</p>}
        <div style={{ background: "#DAD7CE", height: 1 }} className="my-8" />
        <div className="space-y-4 text-left">
          {data.items.map((item) => (
            <a
              key={item.id}
              href={inert ? undefined : item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={guard(inert, () => onLinkClick?.(item))}
              className="group block"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span style={{ color: "#26251F", fontFamily: "Georgia, serif" }} className="text-[15px] border-b border-transparent group-hover:border-[#26251F] transition-colors pb-0.5">
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </span>
                <span style={{ color: "#B5B1A6" }} className="text-xs shrink-0">↗</span>
              </div>
              {item.description && <p style={{ color: "#8A867B" }} className="text-xs mt-0.5">{item.description}</p>}
            </a>
          ))}
          {data.items.length === 0 && <p style={{ color: "#B5B1A6" }} className="text-sm text-center">No links yet.</p>}
        </div>
      </div>
    </div>
  );
}

// 3. Split Cover -----------------------------------------------------------------
// Orange cover column beside a numbered link list — stacks to a top band on
// narrow render slots (phone preview, thumbnails).
function SplitCover({ data, onLinkClick, inert }: TemplateProps) {
  return (
    <div style={{ background: "#0E0F11", minHeight: "100%" }} className="grid sm:grid-cols-[40%_minmax(0,1fr)]">
      <div
        style={{ background: "linear-gradient(165deg, #D25611 0%, #A94309 100%)" }}
        className="px-6 py-12 text-center sm:flex sm:flex-col sm:justify-center"
      >
        <Avatar data={data} size={72} ring="rgba(255,255,255,0.7)" fallbackBg="rgba(0,0,0,0.25)" fg="#ffffff" />
        <h1 className="text-xl font-bold text-white mt-4 tracking-tight">{data.display_name}</h1>
        {data.headline && (
          <p className="text-[10px] mt-1.5 uppercase tracking-[0.2em] font-semibold text-white/75">{data.headline}</p>
        )}
        {data.bio && <p className="text-[11px] mt-3 text-white/70 leading-relaxed whitespace-pre-line">{data.bio}</p>}
      </div>
      <div className="px-5 sm:px-7 py-10">
        <p style={{ color: "#6b6f76" }} className="font-mono text-[10px] uppercase tracking-[0.2em]">Links</p>
        <div className="mt-3">
          {data.items.map((item, idx) => (
            <a
              key={item.id}
              href={inert ? undefined : item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={guard(inert, () => onLinkClick?.(item))}
              style={{ borderColor: "#1d1f23" }}
              className="group flex items-center gap-3 py-3 border-b transition-colors"
            >
              <span style={{ color: "#D25611" }} className="font-mono text-[10px] w-6 shrink-0">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-white truncate">
                  {item.icon && <span className="mr-1.5">{item.icon}</span>}{item.label}
                </span>
                {item.description && (
                  <span style={{ color: "#8a8f98" }} className="block text-[11px] mt-0.5 truncate">{item.description}</span>
                )}
              </span>
              <span style={{ color: "#D25611" }} className="text-sm shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </a>
          ))}
          {data.items.length === 0 && <p style={{ color: "#4a4e56" }} className="text-sm py-6">No links yet.</p>}
        </div>
      </div>
    </div>
  );
}

// 4. Studio Bold ----------------------------------------------------------------
function StudioBold({ data, onLinkClick, inert }: TemplateProps) {
  return (
    <div style={{ background: "#0A0A0A", minHeight: "100%" }} className="px-6 py-12">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-4">
          <Avatar data={data} size={64} ring="#BEF264" fallbackBg="#1C1C1B" fg="#BEF264" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-none">
              {data.display_name}
            </h1>
            {data.headline && <p style={{ color: "#BEF264" }} className="text-xs mt-2 uppercase tracking-[0.25em] font-semibold">{data.headline}</p>}
          </div>
        </div>
        {data.bio && <p style={{ color: "#A3A3A3" }} className="text-sm mt-5 leading-relaxed whitespace-pre-line">{data.bio}</p>}
        <div className="mt-9">
          {data.items.map((item, idx) => (
            <a
              key={item.id}
              href={inert ? undefined : item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={guard(inert, () => onLinkClick?.(item))}
              style={{ borderColor: "#262626" }}
              className="group flex items-center gap-4 py-4 border-b transition-colors hover:bg-white/5"
            >
              <span style={{ color: "#525252" }} className="font-mono text-xs w-7 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-base sm:text-lg font-bold text-white group-hover:text-[#BEF264] transition-colors truncate">
                  {item.icon && <span className="mr-2">{item.icon}</span>}{item.label}
                </span>
                {item.description && <span style={{ color: "#737373" }} className="block text-xs mt-0.5 truncate">{item.description}</span>}
              </span>
              <span style={{ color: "#BEF264" }} className="text-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </a>
          ))}
          {data.items.length === 0 && <p style={{ color: "#525252" }} className="text-sm py-8 text-center">No links yet.</p>}
        </div>
      </div>
    </div>
  );
}

// 5. Warm Cards ------------------------------------------------------------------
function WarmCards({ data, onLinkClick, inert }: TemplateProps) {
  return (
    <div style={{ background: "#F6F1E7", minHeight: "100%" }} className="px-6 py-12">
      <div className="max-w-xl mx-auto text-center">
        <Avatar data={data} size={84} ring="#E7DECC" fallbackBg="#EDE5D3" fg="#57534E" />
        <h1 style={{ color: "#292524" }} className="text-2xl font-bold mt-4">{data.display_name}</h1>
        {data.headline && <p style={{ color: "#78716C" }} className="text-sm mt-1">{data.headline}</p>}
        {data.bio && <p style={{ color: "#57534E" }} className="text-sm mt-3 leading-relaxed whitespace-pre-line">{data.bio}</p>}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          {data.items.map((item) => (
            <a
              key={item.id}
              href={inert ? undefined : item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={guard(inert, () => onLinkClick?.(item))}
              style={{ background: "#FFFDF7", borderColor: "#E7DECC" }}
              className="block rounded-2xl border p-5 shadow-[0_1px_3px_rgba(41,37,36,0.06)] transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="text-2xl mb-2">{item.icon || "🔗"}</div>
              <div style={{ color: "#292524" }} className="text-sm font-bold">{item.label}</div>
              {item.description && <div style={{ color: "#78716C" }} className="text-xs mt-1 leading-relaxed">{item.description}</div>}
              <div style={{ color: "#A8A29E" }} className="text-[11px] font-mono mt-2 truncate">{item.url.replace(/^https?:\/\//, "")}</div>
            </a>
          ))}
        </div>
        {data.items.length === 0 && <p style={{ color: "#A8A29E" }} className="text-sm mt-8">No links yet.</p>}
      </div>
    </div>
  );
}

// 6. Terminal Neon -----------------------------------------------------------------
function TerminalNeon({ data, onLinkClick, inert }: TemplateProps) {
  return (
    <div
      style={{
        minHeight: "100%",
        background: "#05060A",
        backgroundImage: "radial-gradient(rgba(56,189,248,0.07) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
      className="px-6 py-12"
    >
      <div className="max-w-md mx-auto">
        <p style={{ color: "#22D3EE" }} className="font-mono text-xs">~/links</p>
        <h1 className="font-mono text-2xl font-bold text-white mt-2">
          {data.display_name}
          <span style={{ color: "#F472B6" }} className="ml-1 animate-pulse">_</span>
        </h1>
        {data.headline && <p style={{ color: "#94A3B8" }} className="font-mono text-xs mt-1.5">{"// "}{data.headline}</p>}
        {data.bio && <p style={{ color: "#64748B" }} className="font-mono text-[11px] mt-3 leading-relaxed whitespace-pre-line">{data.bio}</p>}
        <div className="mt-8 space-y-3">
          {data.items.map((item) => (
            <a
              key={item.id}
              href={inert ? undefined : item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={guard(inert, () => onLinkClick?.(item))}
              style={{ borderColor: "rgba(34,211,238,0.35)", color: "#E2E8F0", boxShadow: "0 0 14px rgba(34,211,238,0.08)" }}
              className="block rounded-xl border bg-[#0B0F16]/80 px-4 py-3 font-mono text-sm transition-all duration-150 hover:border-[#F472B6] hover:shadow-[0_0_18px_rgba(244,114,182,0.25)]"
            >
              <span><span style={{ color: "#22D3EE" }}>&gt;</span> {item.icon && <span className="mr-1.5">{item.icon}</span>}{item.label}</span>
              {item.description && <span style={{ color: "#475569" }} className="block text-[11px] mt-0.5">{"  "}{"// " + item.description}</span>}
            </a>
          ))}
          {data.items.length === 0 && <p style={{ color: "#334155" }} className="font-mono text-xs mt-6">$ no links configured</p>}
        </div>
      </div>
    </div>
  );
}

const REGISTRY: Record<LinkTemplateKey, React.ComponentType<TemplateProps>> = {
  classic: ClassicDark,
  minimal: EditorialMinimal,
  split: SplitCover,
  bold: StudioBold,
  cards: WarmCards,
  neon: TerminalNeon,
};

export function LinkPageRender({ template, data, onLinkClick, inert }: TemplateProps & { template: string }) {
  const key = (LINK_TEMPLATES.find((t) => t.key === template)?.key ?? "classic") as LinkTemplateKey;
  const Component = REGISTRY[key];
  return <Component data={data} onLinkClick={onLinkClick} inert={inert} />;
}
