"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/feedback";
import { buttonClass, cn } from "@/components/ui/styles";
import { API_URL } from "@/lib/api";

export function SignOut({ variant = "secondary", block = false, className }: { variant?: "secondary" | "ghost" | "menu"; block?: boolean; className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setPending(true);
    setError("");
    try {
      const csrf = await fetch(`${API_URL}/auth/csrf`, { credentials: "include", cache: "no-store" });
      if (csrf.status === 401) {
        window.location.replace("/sign-in");
        return;
      }
      if (!csrf.ok) throw new Error();
      const { csrf_token } = await csrf.json();
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrf_token },
      });
      if (!response.ok) throw new Error();
      window.location.replace("/sign-in");
    } catch {
      setError("Could not sign out. Please try again.");
      setPending(false);
    }
  }

  const style = variant === "menu"
    ? "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 [&_svg]:size-4"
    : buttonClass({ variant, className: cn(block && "w-full") });

  return <div className={cn("flex flex-col gap-2", variant === "menu" || block ? "items-stretch" : "items-end", className)}>
    <button type="button" onClick={signOut} disabled={pending} aria-busy={pending} className={style}>
      {pending ? <Spinner /> : <LogOut aria-hidden />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
