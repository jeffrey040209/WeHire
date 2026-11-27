"use client";

import NumberFlow, { NumberFlowGroup, continuous } from "@number-flow/react";
import { MotionConfig, motion, type Variants } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/** Honours the operating-system "reduce motion" setting for every Motion animation. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const ease = [0.22, 1, 0.36, 1] as const;

/*
 * Entrance: rise, fade and un-blur. The filter is removed afterwards ("none") because any
 * filter creates a backdrop root, which would stop descendant glass from blurring the page.
 * Reduced motion: MotionConfig skips the movement and globals.css drops the blur, leaving a fade.
 */
/**
 * "Pop" entrance: content rises and scales up on an under-damped spring, so it slightly
 * overshoots and settles (the jump-out feel). Opacity and blur use a slower ease so the
 * reveal reads as calm rather than snappy.
 */
export const popSpring = { type: "spring", stiffness: 120, damping: 11, mass: 1 } as const;
export const popTransition = (delay = 0) => ({
  ...popSpring,
  delay,
  opacity: { duration: 0.7, ease, delay },
  filter: { duration: 0.8, ease, delay },
});
export const popHidden = { opacity: 0, y: 36, scale: 0.9, filter: "blur(10px)" };
export const popShown = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } };

export const fadeUp: Variants = {
  hidden: popHidden,
  show: { ...popShown, transition: popTransition() },
};

const container = (delay: number, gap: number): Variants => ({
  hidden: {},
  show: { transition: { delayChildren: delay, staggerChildren: gap } },
});

type Tag = "div" | "section" | "ul" | "ol" | "li" | "header" | "main" | "aside";
type Props = { children: ReactNode; className?: string; as?: Tag; id?: string; "aria-labelledby"?: string; "aria-label"?: string };

/** Parent that reveals its <Item> children one after another. */
export function Stagger({ children, className, as = "div", delay = 0, gap = 0.1, ...rest }: Props & { delay?: number; gap?: number }) {
  const Component = motion[as] as typeof motion.div;
  return <Component className={className} variants={container(delay, gap)} initial="hidden" animate="show" {...rest}>{children}</Component>;
}

/** A single staggered child; inherits timing from the nearest <Stagger>. `lift` adds a springy hover rise. */
export function Item({ children, className, as = "div", lift = false, ...rest }: Props & { lift?: boolean }) {
  const Component = motion[as] as typeof motion.div;
  return <Component className={className} variants={fadeUp} whileHover={lift ? { y: -5, transition: { type: "spring", stiffness: 380, damping: 24 } } : undefined} {...rest}>{children}</Component>;
}

/** Stand-alone entrance animation. */
export function Reveal({ children, className, as = "div", delay = 0, ...rest }: Props & { delay?: number }) {
  const Component = motion[as] as typeof motion.div;
  return <Component className={className} initial="hidden" animate="show" variants={{ hidden: popHidden, show: { ...popShown, transition: popTransition(delay) } }} {...rest}>{children}</Component>;
}

/*
 * Odometer-style rolling numbers (NumberFlow). Each digit spins like a wheel; with the
 * `continuous` plugin it rolls through every value in between (0 → 1 → … → 6).
 * NumberFlow exposes the value to screen readers (role="img" + aria-label) and respects
 * the reduced-motion setting by default.
 */
const rollTiming = {
  spinTiming: { duration: 1300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  transformTiming: { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  opacityTiming: { duration: 400, easing: "ease-out" },
};

/**
 * Rolling number. Starts at 0 and rolls up to `value` shortly after mount (so it plays with
 * the page entrance), then rolls between values whenever `value` changes.
 */
export function RollingNumber({ value, className, delay = 250 }: { value: number; className?: string; delay?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setShown(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return <NumberFlow value={shown} plugins={[continuous]} willChange className={className} {...rollTiming} />;
}

/** Keeps several rolling numbers in one line (e.g. "1–25 of 80") moving together. */
export { NumberFlowGroup as RollingGroup };

/** Feeds the pointer position to `.spotlight` cards so their glow follows the cursor. */
export function SpotlightTracker() {
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(".spotlight");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
  return null;
}
