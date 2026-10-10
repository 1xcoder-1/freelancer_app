/* Design tokens mirrored from apps/web/src/app/globals.css (.dark) so the
   marketing mocks render the real product palette, not an approximation. */

export const T = {
  bg: "#0e0e0f",
  fg: "#f0efed",
  muted: "#a19d98",
  faint: "#6f6b66",
  card: "#161617",
  surface: "#1d1d1f",
  line: "#28282a",
  lineStrong: "#38383b",
  accent: "#d46b28",
  accentHi: "#e07730",
  accentSoft: "#261912",
  info: "#6ea8dc",
} as const;

export const chipTones: Record<string, string> = {
  green: "bg-[#062414] text-[#22c55e] border-[#0d542c]",
  blue: "bg-[#082238] text-[#38bdf8] border-[#0e4b7a]",
  red: "bg-[#2f0814] text-[#fb7185] border-[#6b162f]",
  amber: "bg-[#2e1905] text-[#fbbf24] border-[#6d3c0a]",
  purple: "bg-[#240a38] text-[#c084fc] border-[#581c87]",
  violet: "bg-[#240a38] text-[#c084fc] border-[#581c87]",
  neutral: "bg-[#18191d] text-[#d4d4d8] border-[#2d2f36]",
};

export const dotColors = {
  ok: "bg-[#22c55e]",
  danger: "bg-[#ef4444]",
  warn: "bg-[#f59e0b]",
  info: "bg-[#38bdf8]",
};

export const pillTones = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  warn: "border-[#e3a83a]/30 bg-[#e3a83a]/20 text-[#e3a83a]",
  danger: "border-[#ef6f5f]/30 bg-[#ef6f5f]/15 text-[#ef6f5f]",
  accent: "border-[#d46b28]/25 bg-[#261912] text-[#d46b28]",
  neutral: "border-[#28282a] bg-[#1d1d1f] text-[#a19d98]",
} as const;
