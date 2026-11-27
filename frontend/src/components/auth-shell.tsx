"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { HeroTrail } from "@/components/ui/hero-trail";
import { Item, Stagger, ease } from "@/components/ui/motion";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export type Highlight = { icon: ReactNode; title: string; text: string };

type Props = {
  theme?: "workspace" | "candidate";
  caption: string;
  eyebrow: string;
  headline: ReactNode;
  lead: string;
  highlights: Highlight[];
  footnote: string;
  children: ReactNode;
};

/** Split-screen layout for sign-in, sign-up and setup: glowing story panel + glass form card. */
export function AuthShell({ theme = "workspace", caption, eyebrow, headline, lead, highlights, footnote, children }: Props) {
  return <main data-theme={theme === "candidate" ? "candidate" : undefined} className="grid min-h-dvh text-slate-900 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    {/* Story panel (desktop) */}
    <div className="hidden p-3 lg:block">
      <section aria-label="About WeHire" className="feature-panel relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] p-12 text-white ring-1 ring-white/10 xl:p-16">
        <div aria-hidden className="grid-fade absolute inset-0" />
        <div aria-hidden className="absolute -right-24 top-1/4 size-[28rem] rounded-full bg-[var(--color-accent)] opacity-25 blur-3xl animate-drift" />
        <HeroTrail />

        <Link href="/sign-in" className="relative w-fit rounded-xl"><Brand inverted caption={caption} /></Link>

        <Stagger className="relative max-w-xl py-12" delay={0.1}>
          <Item><p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur"><span className="size-1.5 rounded-full bg-white shadow-[0_0_10px_white]" />{eyebrow}</p></Item>
          <Item><h1 className="mt-7 text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.03em] xl:text-[3.2rem]">{headline}</h1></Item>
          <Item><p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">{lead}</p></Item>
          <Item className="mt-10 grid max-w-lg gap-3">
            {highlights.map((highlight, index) => <motion.div
              key={highlight.title}
              initial={{ opacity: 0, x: -18, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              whileHover={{ x: 6, transition: { type: "spring", stiffness: 380, damping: 26 } }}
              transition={{ duration: 0.6, ease, delay: 0.45 + index * 0.12 }}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md transition-colors hover:bg-white/[0.11]"
            >
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 [&_svg]:size-5">{highlight.icon}</span>
              <span><span className="block font-medium text-white">{highlight.title}</span><span className="mt-0.5 block text-sm leading-6 text-white/65">{highlight.text}</span></span>
            </motion.div>)}
          </Item>
        </Stagger>

        <p className="relative text-sm text-white/55">{footnote}</p>
      </section>
    </div>

    {/* Form column */}
    <section className="relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-8 lg:justify-end">
        <Link href="/sign-in" className="rounded-xl lg:hidden"><Brand caption={caption} /></Link>
        <ThemeToggle />
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
            {/* Only one of the two h1s is ever displayed (the other is display:none). */}
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-900">{headline}</h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            transition={{ duration: 0.65, ease, delay: 0.05 }}
            className="glass relative rounded-[2rem] p-6 shadow-lift sm:p-9"
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-70" />
            {children}
          </motion.div>
        </div>
      </div>
    </section>
  </main>;
}
