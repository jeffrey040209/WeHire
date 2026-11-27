/** Shared class recipes. Plain functions so server and client components can both use them. */

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "btn-accent text-white shadow-brand ring-1 ring-inset ring-white/15 hover:-translate-y-px hover:shadow-[0_14px_30px_-10px_var(--color-accent-glow)]",
  secondary: "glass text-slate-700 hover:-translate-y-px hover:text-slate-900 hover:shadow-lift",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-[linear-gradient(135deg,#dc2626,#991b1b)] text-white shadow-sm ring-1 ring-inset ring-white/15 hover:-translate-y-px hover:shadow-lg",
  soft: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 hover:bg-brand-100",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-4.5 text-sm",
  lg: "h-12 px-6 text-[0.95rem]",
};

export function buttonClass({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export const inputClass =
  "block w-full rounded-xl border border-slate-200 bg-field px-3.5 text-[0.95rem] text-slate-900 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100";

/** Frosted glass card. */
export const cardClass = "glass rounded-3xl";

/** Interactive glass card: cursor spotlight + lift on hover. */
export const interactiveCardClass = "glass spotlight rounded-3xl transition duration-300 hover:-translate-y-1 hover:shadow-lift";
