"use client";

import { MotionConfig, motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

/** Honours the operating-system "reduce motion" setting for every Motion animation. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const ease = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

const container = (delay: number, gap: number): Variants => ({
  hidden: {},
  show: { transition: { delayChildren: delay, staggerChildren: gap } },
});

type Tag = "div" | "section" | "ul" | "ol" | "li" | "header" | "main" | "aside";
type Props = { children: ReactNode; className?: string; as?: Tag; id?: string; "aria-labelledby"?: string; "aria-label"?: string };

/** Parent that reveals its <Item> children one after another. */
export function Stagger({ children, className, as = "div", delay = 0, gap = 0.07, ...rest }: Props & { delay?: number; gap?: number }) {
  const Component = motion[as] as typeof motion.div;
  return <Component className={className} variants={container(delay, gap)} initial="hidden" animate="show" {...rest}>{children}</Component>;
}

/** A single staggered child; inherits timing from the nearest <Stagger>. */
export function Item({ children, className, as = "div", ...rest }: Props) {
  const Component = motion[as] as typeof motion.div;
  return <Component className={className} variants={fadeUp} {...rest}>{children}</Component>;
}

/** Stand-alone entrance animation. */
export function Reveal({ children, className, as = "div", delay = 0, ...rest }: Props & { delay?: number }) {
  const Component = motion[as] as typeof motion.div;
  return <Component className={className} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay }} {...rest}>{children}</Component>;
}
