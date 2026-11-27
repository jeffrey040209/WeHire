/**
 * Colour-mode preference ("light" | "dark" | "system"), stored in localStorage.
 * The resolved mode is written to <html data-mode>, which globals.css reads.
 * Safe to import from client components only (touches window/document at call time).
 */

export type ThemePreference = "light" | "dark" | "system";
export type ColorMode = "light" | "dark";

const KEY = "wehire-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

/** Runs in <head> before first paint so the stored mode never flashes. Keep in sync with resolve(). */
export const themeScript = `(function(){try{var p=localStorage.getItem("${KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.setAttribute("data-mode",d?"dark":"light");r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function getPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch { return "system"; }
}

export function resolve(preference: ThemePreference): ColorMode {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function apply(mode: ColorMode) {
  const root = document.documentElement;
  root.setAttribute("data-mode", mode);
  root.style.colorScheme = mode;
}

/** Changes the preference. When supported, the new theme grows out from `origin` as a circle. */
export function setPreference(preference: ThemePreference, origin?: { x: number; y: number }) {
  try {
    if (preference === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, preference);
  } catch { /* storage unavailable: still apply for this page view */ }

  const next = resolve(preference);
  const current = document.documentElement.getAttribute("data-mode");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (next !== current && origin && !reduceMotion && typeof document.startViewTransition === "function") {
    const transition = document.startViewTransition(() => apply(next));
    transition.ready.then(() => {
      const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  } else {
    apply(next);
  }
  listeners.forEach(listener => listener());
}

/** Subscribes to preference changes from this tab, other tabs and the OS setting. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  const sync = () => { apply(resolve(getPreference())); listener(); };
  const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) sync(); };
  media.addEventListener("change", sync);
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", sync);
    window.removeEventListener("storage", storage);
  };
}
