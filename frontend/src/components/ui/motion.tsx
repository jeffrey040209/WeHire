"use client";

import { MotionConfig, animate, motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

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

/** Animated number for dashboards. Screen readers get the final value only. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const start = from.current;
    from.current = value;
    if (reduce || start === value) { element.textContent = value.toLocaleString(); return; }
    const controls = animate(start, value, { duration: 1.1, ease, onUpdate: latest => { element.textContent = Math.round(latest).toLocaleString(); } });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={className}><span aria-hidden ref={node}>0</span><span className="sr-only">{value.toLocaleString()}</span></span>;
}

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
