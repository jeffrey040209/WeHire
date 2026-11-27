import { cn } from "@/components/ui/styles";

/*
 * WeHire mark: two overlapping chevrons that form a "W". The front chevron is solid and
 * the rear one translucent, giving the mark depth. Geometry lives on a 32×32 grid.
 */
const REAR = "M12.5 9H16.1L19.5 18.15L22.9 9H26.5L21.3 23H17.7Z";
const FRONT = "M5.5 9H9.1L12.5 18.15L15.9 9H19.5L14.3 23H10.7Z";

/** The chevron glyph only (white), for placing on any dark or accent background. */
export function LogoGlyph({ className }: { className?: string }) {
  return <svg aria-hidden viewBox="0 0 32 32" className={className}>
    <path d={REAR} fill="white" fillOpacity={0.5} />
    <path d={FRONT} fill="white" />
  </svg>;
}

/** App-icon style mark: accent gradient tile with a soft top highlight. */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return <span aria-hidden className={cn("relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[0.75rem]", inverted ? "bg-white/10 ring-1 ring-inset ring-white/20 backdrop-blur" : "btn-accent shadow-brand ring-1 ring-inset ring-white/20", className)}>
    <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent to-50%" />
    <LogoGlyph className="relative size-full" />
  </span>;
}

export function Brand({ inverted = false, caption, className }: { inverted?: boolean; caption?: string; className?: string }) {
  return <span className={cn("flex items-center gap-3", className)}>
    <LogoMark inverted={inverted} />
    <span className="leading-none">
      <span className={cn("block text-[1.15rem] font-semibold tracking-[-0.03em]", inverted ? "text-white" : "text-slate-900")}>We<span className={inverted ? "text-white/60" : "text-brand-600"}>Hire</span></span>
      {caption && <span className={cn("mt-1 block text-[0.62rem] font-medium uppercase tracking-[0.18em]", inverted ? "text-white/55" : "text-slate-500")}>{caption}</span>}
    </span>
  </span>;
}
