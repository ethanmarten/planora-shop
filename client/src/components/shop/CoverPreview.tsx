type Cfg = { coverNameXPct: number; coverNameYPct: number; coverNameSizePermille: number; stampColor: string; mottoAbove?: boolean };

/** Mirrors what the PDF engine will stamp on page 1, so buyers see their name on the cover before paying. */
export function CoverPreview({ image, title, cfg, name, motto }: { image?: string | null; title: string; cfg: Cfg; name: string; motto?: string }) {
  const size = cfg.coverNameSizePermille / 10; // cqw
  return (
    <div className="relative w-full overflow-hidden rounded-sm shadow-[0_18px_40px_-18px_rgba(10,14,17,0.55)] bg-[var(--brand-deep)]" style={{ containerType: "inline-size", aspectRatio: image ? undefined : "595 / 842" }}>
      {image ? (
        <img src={image} alt={`${title} cover`} className="block w-full h-auto" />
      ) : (
        <div className="absolute inset-0 flex items-start justify-center p-[10cqw]">
          <span className="font-display text-[var(--brand-warm)] text-[9cqw] leading-none text-center">{title}</span>
        </div>
      )}
      {name && (
        <>
          <div className="absolute w-full text-center font-display italic leading-none pointer-events-none"
            style={{ top: `${cfg.coverNameYPct}%`, transform: "translateY(-82%)", fontSize: `${size}cqw`, color: cfg.stampColor, left: `${cfg.coverNameXPct - 50}%` }}>
            {name}
          </div>
          {motto && (
            <div className="absolute w-full text-center font-display italic leading-none pointer-events-none"
              style={{ top: `${cfg.coverNameYPct}%`, transform: `translateY(calc(-82% ${cfg.mottoAbove ? "-" : "+"} ${size * 1.15}cqw))`, fontSize: `${size * 0.55}cqw`, color: cfg.stampColor, opacity: 0.85, left: `${cfg.coverNameXPct - 50}%` }}>
              {motto}
            </div>
          )}
        </>
      )}
    </div>
  );
}
