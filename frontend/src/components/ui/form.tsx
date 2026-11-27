"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Alert, Spinner } from "@/components/ui/feedback";
import { ease } from "@/components/ui/motion";
import { buttonClass, cn, inputClass } from "@/components/ui/styles";

type InputProps = Omit<ComponentProps<"input">, "className"> & {
  label: string;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  trailing?: ReactNode;
};

/** Labelled input with optional leading icon and hint, wired up with aria-describedby. */
export function TextField({ label, hint, icon, className, trailing, id, ...props }: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return <div className={className}>
    <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    <div className="relative">
      {icon && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400 [&_svg]:size-[18px]">{icon}</span>}
      <input id={inputId} aria-describedby={hintId} className={cn(inputClass, "h-12", Boolean(icon) && "pl-11", Boolean(trailing) && "pr-12")} {...props} />
      {trailing}
    </div>
    {hint && <div id={hintId} className="mt-1.5 text-xs text-slate-500">{hint}</div>}
  </div>;
}

/** Password input with a show/hide toggle and an optional live length requirement. */
export function PasswordField({ minLength, maxLength, showRequirement = false, onValueChange, hint, ...props }: InputProps & { showRequirement?: boolean; onValueChange?: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [length, setLength] = useState(0);
  const min = Number(minLength ?? 0);
  const max = Number(maxLength ?? Infinity);
  const met = length >= min && length <= max;
  const requirement = showRequirement && min > 0
    ? <span className={cn("inline-flex items-center gap-1.5 transition-colors", met ? "text-emerald-700" : "text-slate-500")}>
        <span className={cn("grid size-4 place-items-center rounded-full transition-colors", met ? "bg-emerald-100" : "bg-slate-100")}><Check aria-hidden className={cn("size-3 transition-opacity", met ? "opacity-100" : "opacity-30")} /></span>
        {min}–{maxLength} characters{length > 0 && <span className="tabular-nums text-slate-400">· {length}</span>}
      </span>
    : hint;
  return <TextField
    {...props}
    hint={requirement}
    type={visible ? "text" : "password"}
    minLength={minLength}
    maxLength={maxLength}
    onChange={event => { setLength(event.target.value.length); onValueChange?.(event.target.value); props.onChange?.(event); }}
    trailing={<button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="absolute inset-y-1.5 right-1.5 grid w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
      {visible ? <EyeOff aria-hidden className="size-[18px]" /> : <Eye aria-hidden className="size-[18px]" />}
    </button>}
  />;
}

/** Error/success message that animates its height in and out. */
export function FormMessage({ message, tone = "danger" }: { message: string; tone?: "danger" | "success" | "info" }) {
  return <AnimatePresence initial={false}>
    {message && <motion.div key={message} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
      <motion.div initial={{ x: tone === "danger" ? -6 : 0 }} animate={{ x: 0 }} transition={{ type: "spring", stiffness: 600, damping: 18 }}>
        <Alert tone={tone}>{message}</Alert>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}

export function SubmitButton({ pending, pendingLabel, children, className, size = "lg", disabled }: { pending: boolean; pendingLabel: string; children: ReactNode; className?: string; size?: "md" | "lg"; disabled?: boolean }) {
  return <button type="submit" disabled={pending || disabled} aria-busy={pending} className={buttonClass({ size, className: cn("w-full", className) })}>
    {pending ? <><Spinner />{pendingLabel}</> : children}
  </button>;
}
