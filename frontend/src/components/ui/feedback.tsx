import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/styles";

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn("size-4 motion-safe:animate-spin", className)} />;
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200/70",
  brand: "bg-brand-50 text-brand-700 ring-brand-200/70",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  warning: "bg-amber-50 text-amber-800 ring-amber-200/70",
  danger: "bg-red-50 text-red-700 ring-red-200/70",
  info: "bg-sky-50 text-sky-700 ring-sky-200/70",
};

export function Badge({ tone = "neutral", dot = false, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone], className)}>
    {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />}
    {children}
  </span>;
}

const alertTones = {
  danger: { box: "border-red-200 bg-red-50 text-red-800", icon: AlertCircle },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: TriangleAlert },
  info: { box: "border-slate-200 bg-slate-50 text-slate-700", icon: Info },
};

/** Inline message. Errors use role="alert"; everything else is a polite status. */
export function Alert({ tone = "danger", title, children, action, className }: { tone?: keyof typeof alertTones; title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  const { box, icon: Icon } = alertTones[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6", box, className)}>
    <Icon aria-hidden className="mt-0.5 size-[18px] shrink-0" />
    <div className="min-w-0 flex-1">{title && <p className="font-semibold">{title}</p>}<div>{children}</div></div>
    {action}
  </div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block", className)} />;
}
