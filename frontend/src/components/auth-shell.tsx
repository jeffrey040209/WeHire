"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { Item, Stagger, ease } from "@/components/ui/motion";
import { cn } from "@/components/ui/styles";

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

/** Split-screen layout for sign-in, sign-up and setup: themed story panel + focused form. */
export function AuthShell({ theme = "workspace", caption, eyebrow, headline, lead, highlights, footnote, children }: Props) {
  return <main data-theme={theme === "candidate" ? "candidate" : undefined} className="grid min-h-dvh bg-[#f6f7fb] text-slate-900 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    {/* Story panel (desktop) */}
    <section aria-label="About WeHire" className="brand-mesh relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div aria-hidden className="grid-fade absolute inset-0" />
      <div aria-hidden className="absolute -right-24 top-1/4 size-[28rem] rounded-full bg-brand-500/25 blur-3xl animate-drift" />
      <div aria-hidden className="absolute -bottom-32 -left-20 size-[22rem] rounded-full bg-brand-400/20 blur-3xl animate-drift [animation-delay:-6s]" />

      <Link href="/sign-in" className="relative w-fit rounded-xl"><Brand inverted caption={caption} /></Link>

      <Stagger className="relative max-w-xl py-12" delay={0.1}>
        <Item><p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-200 backdrop-blur"><span className="size-1.5 rounded-full bg-brand-300" />{eyebrow}</p></Item>
        <Item><h1 className="mt-7 text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.03em] xl:text-[3.2rem]">{headline}</h1></Item>
        <Item><p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">{lead}</p></Item>
        <Item className="mt-10 grid max-w-lg gap-3">
          {highlights.map((highlight, index) => <motion.div
            key={highlight.title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.45 + index * 0.12 }}
            className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md"
          >
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-brand-200 ring-1 ring-white/15 [&_svg]:size-5">{highlight.icon}</span>
            <span><span className="block font-medium text-white">{highlight.title}</span><span className="mt-0.5 block text-sm leading-6 text-white/60">{highlight.text}</span></span>
          </motion.div>)}
        </Item>
      </Stagger>

      <p className="relative text-sm text-white/50">{footnote}</p>
    </section>

    {/* Form column */}
    <section className="page-glow relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pt-5 sm:px-8 lg:hidden">
        <Link href="/sign-in" className="rounded-xl"><Brand caption={caption} /></Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
            {/* Only one of the two h1s is ever displayed (the other is display:none). */}
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-slate-900">{headline}</h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease, delay: 0.05 }}
            className={cn("rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-lift sm:p-9")}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </section>
  </main>;
}
