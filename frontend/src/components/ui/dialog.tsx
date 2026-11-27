"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ease } from "@/components/ui/motion";
import { buttonClass, cn } from "@/components/ui/styles";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** When false, Escape, the close button and backdrop clicks are ignored (e.g. while saving). */
  dismissible?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
};

/**
 * Modal dialog built on the native <dialog> element (focus trap, Escape and top layer
 * come from the browser) with Motion enter/exit animations.
 */
export function Dialog(props: DialogProps) {
  return <AnimatePresence>{props.open && <DialogSurface {...props} />}</AnimatePresence>;
}

function DialogSurface({ onClose, title, description, icon, dismissible = true, size = "md", children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      root.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return <dialog
    ref={ref}
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); if (dismissible) onClose(); }}
    className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-transparent p-0 text-slate-900"
  >
    <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => { if (dismissible) onClose(); }} className="fixed inset-0 bg-slate-950/45 backdrop-blur-[3px]" />
    <div className="pointer-events-none relative flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } }}
        transition={{ duration: 0.32, ease }}
        className={cn("pointer-events-auto relative w-full rounded-3xl border border-slate-200/70 bg-white shadow-2xl shadow-slate-950/20", size === "sm" ? "max-w-md" : "max-w-lg")}
      >
        <div className="flex items-start gap-4 px-6 pb-2 pt-6 sm:px-7 sm:pt-7">
          {icon && <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 [&_svg]:size-5">{icon}</span>}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
            {description && <div id={descriptionId} className="mt-1 break-words text-sm leading-6 text-slate-500">{description}</div>}
          </div>
          <button type="button" disabled={!dismissible} onClick={onClose} aria-label="Close dialog" className="-mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3 sm:px-7 sm:pb-7">{children}</div>
      </motion.div>
    </div>
  </dialog>;
}

type ConfirmOptions = { title: string; message: string; confirmLabel?: string; tone?: "danger" | "default"; icon?: ReactNode };

/**
 * Promise-based confirmation dialog: `if (!(await confirm({...}))) return;`
 * Replaces window.confirm with an accessible, on-brand dialog while keeping the same safeguard.
 */
export function useConfirm() {
  // `open` is separate from the request so the content stays visible during the exit animation.
  const [state, setState] = useState<{ open: boolean; request?: ConfirmOptions & { resolve: (value: boolean) => void } }>({ open: false });
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setState({ open: true, request: { ...options, resolve } })), []);
  const settle = (value: boolean) => {
    if (!state.open) return;
    state.request?.resolve(value);
    setState(current => ({ ...current, open: false }));
  };
  const request = state.request;
  const element = <Dialog open={state.open} onClose={() => settle(false)} title={request?.title ?? ""} description={request?.message} icon={request?.icon} size="sm">
    <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" autoFocus onClick={() => settle(false)} className={buttonClass({ variant: "secondary" })}>Cancel</button>
      <button type="button" onClick={() => settle(true)} className={buttonClass({ variant: request?.tone === "danger" ? "danger" : "primary" })}>{request?.confirmLabel ?? "Confirm"}</button>
    </div>
  </Dialog>;
  return [confirm, element] as const;
}
