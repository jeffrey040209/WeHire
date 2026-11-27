"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { ease } from "@/components/ui/motion";

const paths = [
  "M0 300 C 120 260, 200 330, 320 250 S 520 120, 640 150",
  "M0 340 C 140 320, 230 360, 350 300 S 540 210, 640 225",
];

/** Decorative light trails that draw themselves across dark feature panels. Not data. */
export function HeroTrail() {
  const id = useId();
  return <svg aria-hidden viewBox="0 0 640 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 w-full">
    <defs>
      <linearGradient id={`${id}-stroke`} x1="0" x2="1"><stop offset="0" stopColor="white" stopOpacity="0" /><stop offset="0.55" stopColor="white" stopOpacity="0.6" /><stop offset="1" stopColor="white" stopOpacity="0.1" /></linearGradient>
      <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="white" stopOpacity="0.12" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
    </defs>
    <motion.path d={`${paths[0]} L 640 400 L 0 400 Z`} fill={`url(#${id}-fill)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, delay: 1.2 }} />
    {paths.map((d, index) => <motion.path key={d} d={d} fill="none" stroke={`url(#${id}-stroke)`} strokeWidth={index ? 1 : 1.8} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 2.2, ease, delay: 0.4 + index * 0.35 }} />)}
  </svg>;
}
