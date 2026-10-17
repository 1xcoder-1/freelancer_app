/* Desktop chrome QR chip ("View on mobile") — presentational, shared by the
   published page and the live preview bridge. The SVG string is generated on
   the server by the qrcode lib. */
export function QrChip({ svg, publicUrl }: { svg: string; publicUrl: string }) {
  return (
    <div className="hidden md:flex flex-col items-center gap-2 fixed bottom-6 right-6 z-40 select-none">
      <span className="text-xs font-medium text-fg/70 drop-shadow-xs">View on mobile</span>
      <div
        className="rounded-2xl bg-white p-2.5 shadow-lg ring-1 ring-black/10"
        role="img"
        aria-label={`QR code opening ${publicUrl}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
