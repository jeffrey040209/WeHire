"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useSyncExternalStore, type ChangeEvent } from "react";
import { cn } from "@/components/ui/styles";
import { getPreference, setPreference, subscribe, type ThemePreference } from "@/lib/theme";

const options = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "Match system theme", Icon: Laptop },
] as const satisfies readonly { value: ThemePreference; label: string; Icon: typeof Sun }[];

/** Current preference; null during server render and hydration (storage is client-only). */
function useThemePreference() {
  return useSyncExternalStore(subscribe, getPreference, () => null);
}

/** Keeps "System" in sync with OS changes and other tabs on pages without a toggle. */
export function ThemeWatcher() {
  useEffect(() => subscribe(() => {}), []);
  return null;
}

/** Light / Dark / System segmented control (native radios, so arrow keys work). */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemePreference();
  const name = useId();

  function choose(event: ChangeEvent<HTMLInputElement>, value: ThemePreference) {
    const rect = (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect();
    setPreference(value, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return <fieldset className={cn("glass inline-flex shrink-0 items-center gap-0.5 rounded-full p-1", className)}>
    <legend className="sr-only">Colour theme</legend>
    {options.map(({ value, label, Icon }) => <label key={value} title={label} className="relative grid size-7 cursor-pointer place-items-center rounded-full text-slate-500 transition-colors hover:text-slate-900 has-[:checked]:text-slate-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600">
      <input type="radio" name={name} value={value} checked={preference === value} onChange={event => choose(event, value)} className="peer sr-only" />
      {preference === value && <motion.span aria-hidden layoutId={`${name}-pill`} transition={{ type: "spring", stiffness: 520, damping: 36 }} className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/15 dark:ring-white/10" />}
      <Icon aria-hidden className="relative size-3.5" />
      <span className="sr-only">{label}</span>
    </label>)}
  </fieldset>;
}
