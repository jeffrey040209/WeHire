import { cn } from "@/components/ui/styles";

/** WeHire logo mark: a "W" built from two rising strokes, tinted by the active theme. */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return <span aria-hidden className={cn("grid size-9 place-items-center rounded-[0.7rem] shadow-brand", inverted ? "bg-white/10 ring-1 ring-white/20 backdrop-blur" : "bg-gradient-to-br from-brand-500 to-brand-700", className)}>
    <svg viewBox="0 0 24 24" className="size-[58%]" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 6.5 7.6 17.5 12 9l4.4 8.5 4.1-11" />
    </svg>
  </span>;
}

export function Brand({ inverted = false, caption, className }: { inverted?: boolean; caption?: string; className?: string }) {
  return <span className={cn("flex items-center gap-3", className)}>
    <LogoMark inverted={inverted} />
    <span className="leading-none">
      <span className={cn("block text-[1.15rem] font-bold tracking-tight", inverted ? "text-white" : "text-slate-900")}>We<span className={inverted ? "text-brand-300" : "text-brand-600"}>Hire</span></span>
      {caption && <span className={cn("mt-1 block text-[0.65rem] font-semibold uppercase tracking-[0.16em]", inverted ? "text-white/55" : "text-slate-400")}>{caption}</span>}
    </span>
  </span>;
}
