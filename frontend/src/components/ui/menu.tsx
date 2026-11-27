"use client";

import { MoreHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/styles";

const menuItems = (menu: RefObject<HTMLDivElement | null>) => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

export type MenuAction = { label: string; icon?: ReactNode; onSelect: () => void; tone?: "danger"; separatorBefore?: boolean };

/**
 * Accessible row-actions menu (WAI-ARIA menu button pattern).
 * Rendered in a portal with fixed positioning so table scroll containers never clip it.
 */
export function ActionMenu({ label, actions, disabled = false }: { label: string; actions: MenuAction[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus = true) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); }, []);

  // Position against the trigger before paint (flipping above when there is no room below).
  useLayoutEffect(() => {
    const element = menu.current;
    if (!open || !trigger.current || !element) return;
    const rect = trigger.current.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = element;
    const below = rect.bottom + 6 + height <= window.innerHeight - 8;
    element.style.top = `${below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height)}px`;
    element.style.left = `${Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)}px`;
    element.style.transformOrigin = below ? "top right" : "bottom right";
    menuItems(menu)[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close(false);
    };
    const dismiss = () => close(false);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open, close]);

  function onMenuKeyDown(event: KeyboardEvent) {
    const list = menuItems(menu);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (next: number) => { event.preventDefault(); list[(next + list.length) % list.length]?.focus(); };
    if (event.key === "ArrowDown") focus(index + 1);
    else if (event.key === "ArrowUp") focus(index - 1);
    else if (event.key === "Home") focus(0);
    else if (event.key === "End") focus(list.length - 1);
    else if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Tab") close(false);
  }

  return <>
    <button
      ref={trigger}
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => (open ? close() : setOpen(true))}
      onKeyDown={event => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true); } }}
      className={cn("grid size-9 place-items-center rounded-xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900 hover:shadow-sm active:scale-95 disabled:pointer-events-none disabled:opacity-40", open && "border-slate-200 bg-white text-slate-900 shadow-sm")}
    >
      <MoreHorizontal aria-hidden className="size-[18px]" />
    </button>
    {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {open && <motion.div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="fixed left-0 top-0 z-50 min-w-52 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-lift"
        >
          {actions.map(action => <div key={action.label}>
            {action.separatorBefore && <div role="separator" className="my-1.5 h-px bg-slate-100" />}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { close(); action.onSelect(); }}
              className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium outline-none transition [&_svg]:size-4 [&_svg]:shrink-0", action.tone === "danger" ? "text-red-700 hover:bg-red-50 focus:bg-red-50" : "text-slate-700 hover:bg-slate-100 focus:bg-slate-100")}
            >
              {action.icon}{action.label}
            </button>
          </div>)}
        </motion.div>}
      </AnimatePresence>,
      document.body,
    )}
  </>;
}
