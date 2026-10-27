"use client";

import React from "react";
import {
  LINK_TEMPLATES,
  DEFAULT_BACKGROUND_OVERLAY,
  isSocialItem,
  itemRole,
  type LinkTemplateKey,
  type LinkPageRenderData,
  type LinkPageRenderItem,
} from "./template-constants";
import { PlatformIconRenderer, detectPlatformFromUrl } from "./PlatformIcons";

export * from "./template-constants";

const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, 'JetBrains Mono', 'SF Mono', 'Courier New', monospace";

/* Render-time scheme allowlist: rows in the DB predate backend URL validation,
   and <a href> is the one sink where a planted javascript:/data: URL becomes
   stored XSS on a public page. Anything not http(s)/mailto renders inert. */
const SAFE_HREF_RE = /^(https?:\/\/|mailto:)/i;
function safeHref(url: string | null | undefined): string | undefined {
  const trimmed = (url ?? "").trim();
  return SAFE_HREF_RE.test(trimmed) ? trimmed : undefined;
}

interface TemplateProps {
  data: LinkPageRenderData;
  onLinkClick?: (item: LinkPageRenderItem) => void;
  // Preview mode: links render but never navigate.
  inert?: boolean;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "★"
  );
}

function Avatar({
  data,
  size,
  ring,
  fallbackBg,
  fg,
  fontSize = 0.38,
}: {
  data: LinkPageRenderData;
  size: number;
  ring: string;
  fallbackBg: string;
  fg: string;
  fontSize?: number;
}) {
  if (data.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data.avatar_url}
        alt={data.display_name}
        style={{ width: size, height: size, border: `2.5px solid ${ring}` }}
        className="rounded-full object-cover mx-auto shadow-md select-none"
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        background: fallbackBg,
        color: fg,
        border: `2.5px solid ${ring}`,
      }}
      className="rounded-full mx-auto flex items-center justify-center font-bold shadow-md select-none"
    >
      <span style={{ fontSize: size * fontSize }}>{initials(data.display_name)}</span>
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

/* Page background photo (Cloudinary) behind everything, with a scrim so text
   stays readable. Overlay 0-1; blank = template default. */
function TemplateBackground({ data }: { data: LinkPageRenderData }) {
  if (!data.background_image_url) return null;
  const overlay = Math.min(
    1,
    Math.max(0, data.background_overlay ?? DEFAULT_BACKGROUND_OVERLAY)
  );
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.background_image_url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover select-none"
        draggable={false}
      />
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
    </div>
  );
}

function Grain({ opacity = 0.16 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
        opacity,
      }}
    />
  );
}

function socialIconOf(item: LinkPageRenderItem): string {
  return item.icon || detectPlatformFromUrl(item.url)?.icon || "globe";
}

/* The compact round icon row every reference design shows — sits ABOVE the
   link cards so icon-only platform links lead the page. */
function SocialRow({
  items,
  color,
  onLinkClick,
  inert,
  hoverColor,
}: {
  items: LinkPageRenderItem[];
  color: string;
  hoverColor?: string;
  onLinkClick?: (item: LinkPageRenderItem) => void;
  inert?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-5 pb-6">
      {items.slice(0, 8).map((item) => (
        <a
          key={item.id}
          href={inert ? undefined : safeHref(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.label || "Social link"}
          onClick={guard(inert, () => onLinkClick?.(item))}
          className="transition-transform duration-150 hover:scale-110 active:scale-95"
          style={{ color }}
          onMouseEnter={(e) => {
            if (hoverColor) e.currentTarget.style.color = hoverColor;
          }}
          onMouseLeave={(e) => {
            if (hoverColor) e.currentTarget.style.color = color;
          }}
        >
          <PlatformIconRenderer icon={socialIconOf(item)} className="w-[22px] h-[22px]" />
        </a>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-center text-xs py-8 opacity-60">{text}</p>;
}

/* One full-width link row. Variants feed the six designs; thumbs render when
   the item carries an image_url (e.g. "latest video" cards). Two layouts:
   "bar"  — classic single-line button (text left, arrow right)
   "card" — big stacked card with the platform icon ON TOP of the title */
interface RowStyle {
  /* bar layout */
  height?: number;
  radius: number;
  bg: string;
  border?: string;
  textColor: string;
  descriptionColor: string;
  titleFont?: string;
  titleWeight?: string;
  titleSize?: string;
  arrowColor: string;
  hoverBg?: string;
  hoverBorder?: string;
  shadow?: string;
  clipPath?: string;
  /* card layout */
  layout?: "bar" | "card";
  padding?: string;
  titleSizeCard?: string;
  descFont?: string;
  iconBoxSize?: number;
  iconBg?: string;
  iconColor?: string;
}

function LinkIconChip({
  item,
  style,
  size = 28,
  className = "",
}: {
  item: LinkPageRenderItem;
  style: RowStyle;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`flex items-center justify-center shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: style.iconBg ?? "rgba(0,0,0,0.06)",
        color: style.iconColor ?? style.textColor,
      }}
    >
      <PlatformIconRenderer icon={item.icon} className="w-[55%] h-[55%]" />
    </span>
  );
}

function LinkRow({
  item,
  style,
  tilt,
  onLinkClick,
  inert,
}: {
  item: LinkPageRenderItem;
  style: RowStyle;
  tilt?: number;
  onLinkClick?: (item: LinkPageRenderItem) => void;
  inert?: boolean;
}) {
  const thumb = item.image_url;
  const hasIcon = Boolean(item.icon);

  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (style.hoverBg) e.currentTarget.style.background = style.hoverBg;
      if (style.hoverBorder) e.currentTarget.style.borderColor = style.hoverBorder;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (style.hoverBg) e.currentTarget.style.background = style.bg;
      if (style.hoverBorder) e.currentTarget.style.borderColor = style.border || "transparent";
    },
  };

  const baseStyle: React.CSSProperties = {
    background: style.bg,
    border: style.border ? `1px solid ${style.border}` : undefined,
    color: style.textColor,
    boxShadow: style.shadow,
    clipPath: style.clipPath,
    filter: style.clipPath ? "drop-shadow(0 1px 2px rgba(0,0,0,0.18))" : undefined,
  };

  /* Big stacked card: platform icon sits on TOP, title and description below. */
  if (style.layout === "card") {
    return (
      <a
        href={inert ? undefined : safeHref(item.url)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={guard(inert, () => onLinkClick?.(item))}
        className="group relative flex flex-col items-start w-full select-none transition-all duration-150 hover:-translate-y-px"
        style={{
          ...baseStyle,
          borderRadius: style.radius,
          padding: style.padding ?? "14px 16px",
          transform: tilt ? `rotate(${tilt}deg)` : undefined,
        }}
        {...hoverHandlers}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="rounded-lg object-cover select-none mb-2.5"
            style={{ width: style.iconBoxSize ?? 34, height: style.iconBoxSize ?? 34 }}
            draggable={false}
          />
        ) : hasIcon ? (
          <LinkIconChip item={item} style={style} size={style.iconBoxSize ?? 34} className="mb-2.5" />
        ) : null}

        <span
          className={`block ${style.titleSizeCard ?? "text-[14px]"} leading-snug break-words`}
          style={{
            fontFamily: style.titleFont,
            fontWeight: style.titleWeight ?? 600,
            color: style.textColor,
          }}
        >
          {item.label}
        </span>
        {item.description && (
          <span
            className="block text-[11px] mt-1 leading-snug"
            style={{ color: style.descriptionColor, fontFamily: style.descFont }}
          >
            {item.description}
          </span>
        )}

        <span
          className="absolute top-2.5 right-3 text-xs opacity-50 group-hover:opacity-100 transition-opacity"
          style={{ color: style.arrowColor }}
        >
          ↗
        </span>
      </a>
    );
  }

  /* Classic single-line bar. */
  return (
    <a
      href={inert ? undefined : safeHref(item.url)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={guard(inert, () => onLinkClick?.(item))}
      className="group relative flex items-center w-full px-4 select-none transition-all duration-150 hover:-translate-y-px"
      style={{
        ...baseStyle,
        minHeight: style.height ?? 44,
        borderRadius: style.radius,
      }}
      {...hoverHandlers}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="w-8 h-8 rounded-lg object-cover shrink-0 mr-3 select-none"
          draggable={false}
        />
      ) : hasIcon ? (
        <LinkIconChip item={item} style={style} size={26} className="mr-3" />
      ) : null}

      <div className="min-w-0 w-full">
        <span
          className={`block truncate ${style.titleSize ?? "text-[13px]"}`}
          style={{
            fontFamily: style.titleFont,
            fontWeight: style.titleWeight ?? 600,
            color: style.textColor,
          }}
        >
          {item.label}
        </span>
        {item.description && (
          <span
            className="block text-[10px] truncate"
            style={{ color: style.descriptionColor }}
          >
            {item.description}
          </span>
        )}
      </div>

      <span
        className="ml-2 text-xs opacity-70 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ color: style.arrowColor }}
      >
        ↗
      </span>
    </a>
  );
}

/* Shared page skeleton: centered column, ordered roles, social row last. */
function TemplateShell({
  data,
  background,
  grain,
  children,
}: {
  data: LinkPageRenderData;
  background: string;
  grain?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ background, minHeight: "100%" }}
      className="relative overflow-hidden flex flex-col"
    >
      <TemplateBackground data={data} />
      {grain !== undefined && <Grain opacity={grain} />}
      <div className="relative px-6 py-12 flex flex-col grow">{children}</div>
    </div>
  );
}

function useRows(data: LinkPageRenderData) {
  const rows: LinkPageRenderItem[] = [];
  const socials: LinkPageRenderItem[] = [];
  for (const item of data.items) {
    if (itemRole(item) === "link" && isSocialItem(item)) socials.push(item);
    else rows.push(item);
  }
  return { rows, socials };
}

/* ---------------------------------------------------------------------------
   1. Fresh Press — sage green juice-bar canvas, soft pill buttons
--------------------------------------------------------------------------- */
function FreshPress({ data, onLinkClick, inert }: TemplateProps) {
  const { rows, socials } = useRows(data);
  const rowStyle: RowStyle = {
    layout: "card",
    radius: 18,
    bg: "#C9CDC4",
    textColor: "#33402C",
    descriptionColor: "#5C6B54",
    arrowColor: "#33402C",
    hoverBg: "#D6DAD1",
    padding: "15px 18px 14px",
    titleSizeCard: "text-[15px]",
    titleWeight: "600",
    iconBoxSize: 36,
    iconBg: "#5F6B57",
    iconColor: "#FFFFFF",
  };
  return (
    <TemplateShell data={data} background="linear-gradient(180deg, #5F6B57 0%, #525E49 100%)">
      <div className="max-w-xs mx-auto w-full text-center flex flex-col grow">
        <Avatar data={data} size={84} ring="rgba(255,255,255,0.25)" fallbackBg="#2E3A28" fg="#E8A33D" />
        <h1 className="text-[17px] font-semibold mt-4 text-white tracking-tight">
          {data.display_name}
        </h1>
        {data.headline && (
          <p className="text-xs mt-1 text-white/75 font-medium">{data.headline}</p>
        )}
        {data.bio && (
          <p className="text-xs mt-2.5 max-w-[260px] mx-auto leading-relaxed text-white/70 whitespace-pre-line">
            {data.bio}
          </p>
        )}

        <SocialRow items={socials} color="#FFFFFF" hoverColor="#D6DAD1" onLinkClick={onLinkClick} inert={inert} />

        <div className="mt-1 space-y-4">
          {rows.map((item) => {
            const role = itemRole(item);
            if (role === "header") {
              return (
                <div key={item.id} className="pt-4 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {item.label}
                  </span>
                </div>
              );
            }
            if (role === "divider") {
              return <div key={item.id} className="my-2 h-px bg-white/20" />;
            }
            return (
              <LinkRow key={item.id} item={item} style={rowStyle} onLinkClick={onLinkClick} inert={inert} />
            );
          })}
          {rows.length === 0 && socials.length === 0 && <EmptyState text="No links added yet." />}
        </div>
      </div>
    </TemplateShell>
  );
}

/* ---------------------------------------------------------------------------
   2. Honeyed — powdery blue pastry shop, mono type, fine outlined buttons
--------------------------------------------------------------------------- */
function Honeyed({ data, onLinkClick, inert }: TemplateProps) {
  const { rows, socials } = useRows(data);
  const rowStyle: RowStyle = {
    radius: 10,
    bg: "rgba(255,255,255,0.55)",
    border: "#2B3AA5",
    hoverBorder: "#1D2A8A",
    textColor: "#2B3AA5",
    descriptionColor: "#5A66C0",
    arrowColor: "#2B3AA5",
    height: 42,
    titleFont: MONO,
    titleWeight: "500",
    iconBg: "rgba(43,58,165,0.08)",
    iconColor: "#2B3AA5",
  };
  return (
    <TemplateShell data={data} background="#E9EAF3">
      <div className="max-w-xs mx-auto w-full text-center flex flex-col grow">
        <Avatar data={data} size={78} ring="rgba(242,130,123,0.4)" fallbackBg="#F2827B" fg="#2B3AA5" />
        <h1
          className="text-base font-bold mt-4 tracking-tight"
          style={{ fontFamily: MONO, color: "#2B3AA5" }}
        >
          {data.display_name}
        </h1>
        {data.headline && (
          <p className="text-xs mt-1.5" style={{ fontFamily: MONO, color: "#5A66C0" }}>
            {data.headline}
          </p>
        )}
        {data.bio && (
          <p
            className="text-xs mt-2.5 max-w-[260px] mx-auto leading-relaxed whitespace-pre-line"
            style={{ fontFamily: MONO, color: "#5A66C0" }}
          >
            {data.bio}
          </p>
        )}

        <SocialRow items={socials} color="#2B3AA5" hoverColor="#F2827B" onLinkClick={onLinkClick} inert={inert} />

        <div className="mt-1 space-y-2.5">
          {rows.map((item) => {
            const role = itemRole(item);
            if (role === "header") {
              return (
                <div key={item.id} className="pt-4 pb-1">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{ fontFamily: MONO, color: "#2B3AA5" }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            }
            if (role === "divider") {
              return <div key={item.id} className="my-2 h-px" style={{ background: "#2B3AA533" }} />;
            }
            return (
              <LinkRow key={item.id} item={item} style={rowStyle} onLinkClick={onLinkClick} inert={inert} />
            );
          })}
          {rows.length === 0 && socials.length === 0 && <EmptyState text="No links added yet." />}
        </div>
      </div>
    </TemplateShell>
  );
}

/* ---------------------------------------------------------------------------
   3. Studio Cloud — sketchbook page with hand-drawn blue clouds
--------------------------------------------------------------------------- */
function CloudDoodle({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 200 110"
      fill="none"
      className={`absolute pointer-events-none ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M30 82 C12 82 6 68 14 58 C6 46 18 32 32 38 C36 20 58 12 72 24 C82 6 110 6 120 24 C136 12 160 20 162 38 C180 34 192 50 184 64 C192 74 184 86 170 84 Z"
        stroke="#4A5BD0"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const HAND = "var(--font-signature), 'Segoe Script', 'Bradley Hand', cursive";

function StudioCloud({ data, onLinkClick, inert }: TemplateProps) {
  const { rows, socials } = useRows(data);
  const rowStyle: RowStyle = {
    layout: "card",
    /* Hand-cut paper edges instead of a machined radius. */
    radius: 14,
    bg: "#FFFFFF",
    border: "#3D4EC780",
    hoverBorder: "#3D4EC7",
    textColor: "#3D4EC7",
    descriptionColor: "#6A75D6",
    arrowColor: "#3D4EC7",
    padding: "12px 16px 11px",
    titleFont: HAND,
    titleSizeCard: "text-[19px]",
    titleWeight: "600",
    iconBoxSize: 30,
    iconBg: "#EEF0FB",
    iconColor: "#3D4EC7",
  };
  return (
    <TemplateShell data={data} background="#F3F2F8">
      {/* Hand-drawn cloud line art scattered like the reference page */}
      <CloudDoodle className="w-44 -top-3 -right-10 opacity-50" />
      <CloudDoodle className="w-32 top-24 -left-12 opacity-40" style={{ transform: "scaleX(-1)" }} />
      <CloudDoodle className="w-36 bottom-40 -right-12 opacity-40" />
      <CloudDoodle className="w-40 -bottom-6 -left-10 opacity-50" style={{ transform: "rotate(8deg)" }} />

      <div className="max-w-xs mx-auto w-full text-center flex flex-col grow">
        <Avatar data={data} size={80} ring="#C9CFEE" fallbackBg="#DDE2F5" fg="#3D4EC7" />
        <h1 className="text-2xl mt-4" style={{ fontFamily: HAND, color: "#3D4EC7" }}>
          {data.display_name}
        </h1>
        {data.headline && (
          <p className="text-sm mt-1 leading-relaxed" style={{ fontFamily: HAND, color: "#3D4EC799" }}>
            {data.headline}
          </p>
        )}
        {data.bio && (
          <p className="text-xs mt-2 max-w-[270px] mx-auto leading-relaxed whitespace-pre-line" style={{ color: "#3D4EC7B3" }}>
            {data.bio}
          </p>
        )}

        <SocialRow items={socials} color="#3D4EC7" hoverColor="#1D2A8A" onLinkClick={onLinkClick} inert={inert} />

        <div className="mt-1 space-y-3.5">
          {rows.map((item, idx) => {
            const role = itemRole(item);
            if (role === "header") {
              return (
                <div key={item.id} className="pt-3 pb-0.5">
                  <span className="text-lg" style={{ fontFamily: HAND, color: "#3D4EC7" }}>
                    {item.label}
                  </span>
                </div>
              );
            }
            if (role === "divider") {
              return <div key={item.id} className="my-2 h-px" style={{ background: "#3D4EC733" }} />;
            }
            return (
              <LinkRow
                key={item.id}
                item={item}
                style={rowStyle}
                tilt={idx % 2 === 0 ? -0.5 : 0.45}
                onLinkClick={onLinkClick}
                inert={inert}
              />
            );
          })}
          {rows.length === 0 && socials.length === 0 && <EmptyState text="No links added yet." />}
        </div>
      </div>
    </TemplateShell>
  );
}

/* ---------------------------------------------------------------------------
   4. Hardwave — stage-light orange burning into charcoal grain
--------------------------------------------------------------------------- */
/* Sawtooth teeth cut into the top edge of every white bar. */
const ZIGZAG_TOP =
  "polygon(0% 8px, 3.5% 0px, 7% 8px, 10.5% 0px, 14% 8px, 17.5% 0px, 21% 8px, 24.5% 0px, 28% 8px, 31.5% 0px, 35% 8px, 38.5% 0px, 42% 8px, 45.5% 0px, 49% 8px, 52.5% 0px, 56% 8px, 59.5% 0px, 63% 8px, 66.5% 0px, 70% 8px, 73.5% 0px, 77% 8px, 80.5% 0px, 84% 8px, 87.5% 0px, 91% 8px, 94.5% 0px, 98% 8px, 100% 2px, 100% 100%, 0% 100%)";

function Hardwave({ data, onLinkClick, inert }: TemplateProps) {
  const { rows, socials } = useRows(data);
  const rowStyle: RowStyle = {
    height: 54,
    radius: 10,
    bg: "#FFFFFF",
    textColor: "#1A1815",
    descriptionColor: "#6B6560",
    arrowColor: "#1A1815",
    hoverBg: "#F2EFEA",
    titleWeight: "600",
    clipPath: ZIGZAG_TOP,
    iconBg: "#F5EFE8",
    iconColor: "#1A1815",
  };
  return (
    <TemplateShell
      data={data}
      background="linear-gradient(180deg, #D2702F 0%, #A05526 20%, #5C3A20 42%, #2A211A 65%, #171412 100%)"
      grain={0.2}
    >
      <div className="max-w-xs mx-auto w-full text-center flex flex-col grow">
        <Avatar data={data} size={80} ring="rgba(255,255,255,0.35)" fallbackBg="#2A211A" fg="#D2702F" />
        <h1 className="text-[17px] font-semibold mt-4 text-white tracking-tight">
          {data.display_name}
        </h1>
        {data.headline && (
          <p className="text-xs mt-1 text-white/70">{data.headline}</p>
        )}
        {data.bio && (
          <p className="text-xs mt-2.5 max-w-[260px] mx-auto leading-relaxed text-white/65 whitespace-pre-line">
            {data.bio}
          </p>
        )}

        <SocialRow items={socials} color="#FFFFFF" hoverColor="#D2702F" onLinkClick={onLinkClick} inert={inert} />

        <div className="mt-1 space-y-3.5">
          {rows.map((item) => {
            const role = itemRole(item);
            if (role === "header") {
              return (
                <div key={item.id} className="pt-4 pb-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                    {item.label}
                  </span>
                </div>
              );
            }
            if (role === "divider") {
              return <div key={item.id} className="my-2 h-px bg-white/25" />;
            }
            return (
              <LinkRow key={item.id} item={item} style={rowStyle} onLinkClick={onLinkClick} inert={inert} />
            );
          })}
          {rows.length === 0 && socials.length === 0 && <EmptyState text="No links added yet." />}
        </div>
      </div>
    </TemplateShell>
  );
}

/* ---------------------------------------------------------------------------
   5. Prism — holographic foil gradient with crisp white cards
--------------------------------------------------------------------------- */
function Prism({ data, onLinkClick, inert }: TemplateProps) {
  const { rows, socials } = useRows(data);
  const rowStyle: RowStyle = {
    layout: "card",
    radius: 20,
    bg: "rgba(255,255,255,0.9)",
    textColor: "#23222E",
    descriptionColor: "#5A5968",
    arrowColor: "#5F6FD0",
    hoverBg: "#FFFFFF",
    padding: "15px 18px 14px",
    titleSizeCard: "text-[15px]",
    titleWeight: "600",
    shadow: "0 12px 32px -14px rgba(90, 80, 140, 0.4)",
    iconBoxSize: 36,
    iconBg: "#F1EFFB",
    iconColor: "#5F6FD0",
  };
  return (
    <TemplateShell
      data={data}
      background={`linear-gradient(115deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.35) 32%, rgba(255,255,255,0) 44%), linear-gradient(160deg, #F2C9DC 0%, #C9D2F0 28%, #DCCEF2 52%, #F4DECB 76%, #BFCDF2 100%)`}
    >
      <div className="max-w-xs mx-auto w-full text-center flex flex-col grow">
        <Avatar data={data} size={80} ring="rgba(255,255,255,0.8)" fallbackBg="#DCCEF2" fg="#23222E" />
        <h1 className="text-[17px] font-semibold mt-4 tracking-tight" style={{ color: "#23222E" }}>
          {data.display_name}
        </h1>
        {data.headline && (
          <p className="text-xs mt-1" style={{ color: "#4A4956" }}>
            {data.headline}
          </p>
        )}
        {data.bio && (
          <p className="text-xs mt-2 max-w-[270px] mx-auto leading-relaxed whitespace-pre-line" style={{ color: "#3C3B49" }}>
            {data.bio}
          </p>
        )}

        <SocialRow items={socials} color="#FFFFFF" hoverColor="#23222E" onLinkClick={onLinkClick} inert={inert} />

        <div className="mt-1 space-y-4">
          {rows.map((item) => {
            const role = itemRole(item);
            if (role === "header") {
              return (
                <div key={item.id} className="pt-4 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#4A4956" }}>
                    {item.label}
                  </span>
                </div>
              );
            }
            if (role === "divider") {
              return <div key={item.id} className="my-2 h-px bg-black/10" />;
            }
            return (
              <LinkRow key={item.id} item={item} style={rowStyle} onLinkClick={onLinkClick} inert={inert} />
            );
          })}
          {rows.length === 0 && socials.length === 0 && <EmptyState text="No links added yet." />}
        </div>
      </div>
    </TemplateShell>
  );
}

/* ---------------------------------------------------------------------------
   6. Paper — warm grey stock, serif type, torn-paper link strips
--------------------------------------------------------------------------- */
const TORN_CLIP =
  "polygon(0% 5px, 4% 1px, 9% 6px, 15% 2px, 22% 7px, 29% 1px, 36% 5px, 43% 2px, 50% 6px, 57% 1px, 64% 5px, 71% 2px, 78% 6px, 85% 1px, 92% 5px, 100% 2px, 100% calc(100% - 5px), 95% calc(100% - 1px), 89% calc(100% - 6px), 82% calc(100% - 2px), 75% calc(100% - 7px), 68% calc(100% - 1px), 61% calc(100% - 5px), 54% calc(100% - 2px), 47% calc(100% - 6px), 40% calc(100% - 1px), 33% calc(100% - 5px), 26% calc(100% - 2px), 19% calc(100% - 6px), 12% calc(100% - 1px), 5% calc(100% - 5px), 0% calc(100% - 2px))";

function Paper({ data, onLinkClick, inert }: TemplateProps) {
  const { rows, socials } = useRows(data);
  const rowStyle: RowStyle = {
    radius: 2,
    bg: "#FCFCFA",
    textColor: "#22211D",
    descriptionColor: "#6B6960",
    arrowColor: "#22211D",
    hoverBg: "#FFFFFF",
    height: 46,
    titleFont: SERIF,
    titleWeight: "700",
    clipPath: TORN_CLIP,
    iconBg: "#ECEAE3",
    iconColor: "#22211D",
  };
  return (
    <TemplateShell data={data} background="#B7B4AD" grain={0.12}>
      <div className="max-w-xs mx-auto w-full text-center flex flex-col grow">
        <Avatar data={data} size={78} ring="rgba(252,252,250,0.7)" fallbackBg="#8F8C85" fg="#2B2A26" />
        <h1 className="text-lg mt-4 tracking-tight" style={{ fontFamily: SERIF, color: "#2B2A26" }}>
          {data.display_name}
        </h1>
        {data.headline && (
          <p className="text-xs mt-1.5" style={{ fontFamily: SERIF, color: "#4A4841" }}>
            {data.headline}
          </p>
        )}
        {data.bio && (
          <p
            className="text-xs mt-2.5 max-w-[270px] mx-auto leading-relaxed whitespace-pre-line"
            style={{ fontFamily: SERIF, color: "#3C3B36" }}
          >
            {data.bio}
          </p>
        )}

        <SocialRow items={socials} color="#191813" hoverColor="#6B6960" onLinkClick={onLinkClick} inert={inert} />

        <div className="mt-1 space-y-3.5">
          {rows.map((item) => {
            const role = itemRole(item);
            if (role === "header") {
              return (
                <div key={item.id} className="pt-4 pb-1">
                  <span
                    className="text-xs font-bold tracking-wide"
                    style={{ fontFamily: SERIF, color: "#2B2A26" }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            }
            if (role === "divider") {
              return <div key={item.id} className="my-3 h-px bg-black/20" />;
            }
            return (
              <LinkRow key={item.id} item={item} style={rowStyle} onLinkClick={onLinkClick} inert={inert} />
            );
          })}
          {rows.length === 0 && socials.length === 0 && <EmptyState text="No links added yet." />}
        </div>
      </div>
    </TemplateShell>
  );
}

const REGISTRY: Record<LinkTemplateKey, React.ComponentType<TemplateProps>> = {
  "fresh-press": FreshPress,
  honeyed: Honeyed,
  "studio-cloud": StudioCloud,
  hardwave: Hardwave,
  prism: Prism,
  paper: Paper,
};

export function LinkPageRender({
  template,
  data,
  onLinkClick,
  inert,
}: TemplateProps & { template: string }) {
  const key = (LINK_TEMPLATES.find((t) => t.key === template)?.key ?? "paper") as LinkTemplateKey;
  const Component = REGISTRY[key];
  return <Component data={data} onLinkClick={onLinkClick} inert={inert} />;
}
