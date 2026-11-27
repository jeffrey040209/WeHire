"use client";

import { ArrowRight, BriefcaseBusiness, KeyRound, LockKeyhole, Mail, ScanSearch, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage, PasswordField, SubmitButton, TextField } from "@/components/ui/form";
import { Badge } from "@/components/ui/feedback";
import { API_URL, type Identity } from "@/lib/api";

export default function SignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.get("email"), password: values.get("password") }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? "Too many sign-in attempts. Please wait and try again." : response.status === 401 ? "Invalid email or password." : "Sign-in is unavailable. Please try again.");
        setPending(false);
        return;
      }
      const user: Identity = await response.json();
      form.reset();
      window.location.replace(user.is_admin ? "/admin" : user.roles.some(role => ["hr", "hiring_manager"].includes(role)) ? "/staff" : user.roles.length === 1 && user.roles[0] === "candidate" ? "/candidate" : "/access-denied");
    } catch {
      setError("Unable to reach WeHire. Please try again.");
      setPending(false);
    }
  }

  return <AuthShell
    caption="WeHire access"
    eyebrow="People. Evidence. Clarity."
    headline="A clearer view of your next great hire."
    lead="A focused workspace for your recruitment team, with access to the vacancies assigned to you."
    footnote="Private by design. Access follows your responsibilities."
    highlights={[
      { icon: <BriefcaseBusiness />, title: "Assigned vacancies", text: "Staff see only the vacancies their administrator assigns to them." },
      { icon: <ScanSearch />, title: "Evidence-led screening", text: "Candidate evidence is reviewed by your recruitment team." },
      { icon: <LockKeyhole />, title: "Protected sessions", text: "HTTP-only session cookies and verified requests." },
    ]}
  >
    <Badge tone="brand">Staff & candidates</Badge>
    <h2 className="mt-5 text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900">Welcome back</h2>
    <p className="mt-1.5 text-sm leading-6 text-slate-500">Sign in with your WeHire account.</p>

    <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={pending}>
      <TextField id="email" name="email" type="email" label="Email" icon={<Mail />} autoComplete="username" required maxLength={254} placeholder="you@company.com" disabled={pending} />
      <PasswordField id="password" name="password" label="Password" icon={<KeyRound />} autoComplete="current-password" required maxLength={1024} disabled={pending} />
      <FormMessage message={error} />
      <SubmitButton pending={pending} pendingLabel="Signing in…">Sign in to WeHire<ArrowRight aria-hidden /></SubmitButton>
    </form>

    <p className="mt-6 text-sm leading-6 text-slate-500">Staff accounts are created by your company administrator.</p>
    <div className="mt-6 grid gap-3 border-t border-slate-100 pt-6">
      <p className="text-sm text-slate-600">New candidate? <Link href="/sign-up" className="inline-flex items-center gap-1 rounded font-semibold text-brand-700 underline-offset-4 hover:underline"><UserPlus aria-hidden className="size-4" />Create an account</Link></p>
      <Link href="/setup" className="w-fit rounded text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-brand-700 hover:underline">First-time administrator setup</Link>
    </div>
  </AuthShell>;
}
