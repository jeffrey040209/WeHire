"use client";

import { ChevronDown, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SignOut } from "@/components/sign-out";
import { Badge } from "@/components/ui/feedback";
import { cn } from "@/components/ui/styles";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Identity } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

/** Gradient pairs for avatars; the darker stop keeps white initials readable. */
const avatarGradients = [
  ["#8b5cf6", "#5b21b6"], // violet
  ["#6366f1", "#3730a3"], // indigo
  ["#3b82f6", "#1d4ed8"], // blue
  ["#06b6d4", "#0e7490"], // cyan
  ["#14b8a6", "#0f766e"], // teal
  ["#10b981", "#047857"], // emerald
  ["#f59e0b", "#b45309"], // amber
  ["#f97316", "#c2410c"], // orange
  ["#f43f5e", "#be123c"], // rose
  ["#d946ef", "#a21caf"], // fuchsia
] as const;

/**
 * Stable colour per person: the same email always maps to the same gradient.
 * FNV-1a, then a murmur3 finaliser so near-identical emails (staff1, staff2…) spread out.
 */
function avatarGradient(email: string) {
  let hash = 0x811c9dc5;
  for (const char of email.trim().toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  const [from, to] = avatarGradients[(hash >>> 0) % avatarGradients.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function Avatar({ email, size = "md", className }: { email: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return <span aria-hidden style={{ backgroundImage: avatarGradient(email) }} className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold uppercase text-white ring-2 ring-white/70 [text-shadow:0_1px_2px_rgb(0_0_0/0.25)] dark:ring-white/15", { sm: "size-8 text-xs", md: "size-9 text-sm", lg: "size-12 text-base" }[size], className)}>
    <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent to-60%" />
    <span className="relative">{email.trim().slice(0, 1)}</span>
  </span>;
}

/**
 * Account disclosure popover: identity, roles, quick links and sign out.
 * A disclosure (not role="menu") because it contains status text as well as actions.
 */
export function UserMenu({ user, links = [], align = "right" }: { user: Identity; links?: { href: string; label: string; icon?: ReactNode }[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <div ref={root} className="relative">
    <button ref={button} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} className="glass flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-left transition hover:shadow-lift active:scale-[0.98]">
      <Avatar email={user.email} size="sm" />
      <span className="hidden max-w-44 truncate text-sm font-medium text-slate-700 sm:block">{user.email}</span>
      <span className="sr-only sm:hidden">Account menu for {user.email}</span>
      <ChevronDown aria-hidden className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")} />
    </button>
    <AnimatePresence>
      {open && <motion.div
        id={panelId}
        initial={{ opacity: 0, y: -6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn("glass-solid absolute z-40 mt-2 w-72 rounded-2xl p-2", align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left")}
      >
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Avatar email={user.email} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900" title={user.email}>{user.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {user.roles.map(role => <Badge key={role} tone="brand">{roleLabel(role)}</Badge>)}
              {user.is_admin && <Badge tone="success"><ShieldCheck aria-hidden className="size-3" />Administrator</Badge>}
            </div>
          </div>
        </div>
        {links.length > 0 && <nav aria-label="Account" className="mt-1.5 border-b border-slate-100 pb-1.5">
          {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 [&_svg]:size-4 [&_svg]:text-slate-400">{link.icon}{link.label}</Link>)}
        </nav>}
        <div className="mt-1.5 flex items-center justify-between gap-3 border-b border-slate-100 px-3 pb-2.5 pt-1"><span className="text-sm font-medium text-slate-700">Appearance</span><ThemeToggle /></div>
        <SignOut variant="menu" className="mt-1.5" />
      </motion.div>}
    </AnimatePresence>
  </div>;
}
