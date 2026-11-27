import { RotateCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { Skeleton } from "@/components/ui/feedback";
import { Reveal } from "@/components/ui/motion";
import { buttonClass, cardClass, cn } from "@/components/ui/styles";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type NavItem = { href: string; label: string; icon: ReactNode; current?: boolean };

/** Floating glass top bar for the staff workspace and candidate account pages. */
export function AppHeader({ caption, nav = [], account }: { caption: string; nav?: NavItem[]; account: ReactNode }) {
  return <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
    <div className="glass mx-auto max-w-6xl rounded-[1.4rem]">
      <div className="flex h-16 items-center justify-between gap-3 pl-4 pr-2.5 sm:pl-5">
        <div className="flex min-w-0 items-center gap-6">
          <Brand caption={caption} className="shrink-0" />
          {nav.length > 0 && <nav aria-label="Primary" className="hidden items-center gap-1 rounded-full bg-slate-100 p-1 md:flex">
            {nav.map(item => <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined} className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition [&_svg]:size-4", item.current ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5 dark:bg-white/12 dark:ring-white/10" : "text-slate-500 hover:text-slate-900")}>{item.icon}{item.label}</Link>)}
          </nav>}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:contents"><ThemeToggle /></span>
          {account}
        </div>
      </div>
      {nav.length > 1 && <nav aria-label="Primary" className="scrollbar-none flex gap-1 overflow-x-auto border-t border-slate-200/70 px-3 py-2 md:hidden">
        {nav.map(item => <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium [&_svg]:size-4", item.current ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100" : "text-slate-600")}>{item.icon}{item.label}</Link>)}
      </nav>}
    </div>
  </header>;
}

/** Full-page state for unavailable/error conditions on server-rendered pages. */
export function StatePanel({ icon, title, message, retryHref, children, theme }: { icon: ReactNode; title: string; message: string; retryHref?: string; children?: ReactNode; theme?: "candidate" }) {
  return <main data-theme={theme} className="relative flex min-h-dvh items-center justify-center px-5 py-12 text-slate-900">
    <ThemeToggle className="absolute right-4 top-4" />
    <Reveal className={cn(cardClass, "w-full max-w-md p-8 text-center sm:p-10")}>
      <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 [&_svg]:size-6">{icon}</span>
      <h1 className="mt-6 text-xl font-semibold tracking-tight">{title}</h1>
      <p role="alert" className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-7 flex flex-col items-center gap-3">
        {retryHref && <a href={retryHref} className={buttonClass({ className: "w-full sm:w-auto" })}><RotateCw aria-hidden />Try again</a>}
        {children}
      </div>
    </Reveal>
  </main>;
}

/** Skeleton for server-rendered pages while identity/access loads (Suspense fallback). */
export function PageSkeleton({ label, theme, variant = "workspace" }: { label: string; theme?: "candidate"; variant?: "workspace" | "admin" }) {
  return <div data-theme={theme} className="min-h-dvh" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {variant === "admin" ? <div aria-hidden className="lg:grid lg:min-h-dvh lg:grid-cols-[284px_1fr]">
      <div className="hidden p-4 lg:block"><div className={cn(cardClass, "h-full p-6")}><Skeleton className="h-9 w-32" /><div className="mt-10 space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</div></div></div>
      <div className="p-5 sm:p-8 lg:p-10"><Skeleton className="h-4 w-28" /><Skeleton className="mt-4 h-9 w-72 max-w-full" /><div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div><Skeleton className="mt-6 h-96 rounded-3xl" /></div>
    </div> : <div aria-hidden>
      <div className="px-3 pt-3 sm:px-5"><div className={cn(cardClass, "mx-auto flex h-16 max-w-6xl items-center justify-between rounded-[1.4rem] px-5")}><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-40 rounded-full" /></div></div>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><Skeleton className="h-52 rounded-3xl" /><div className="mt-6 grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div><Skeleton className="mt-6 h-72 rounded-3xl" /></div>
    </div>}
  </div>;
}
