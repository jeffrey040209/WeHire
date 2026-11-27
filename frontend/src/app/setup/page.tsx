"use client";

import { ArrowLeft, ArrowRight, Check, CircleSlash, KeyRound, LockKeyhole, Mail, ServerCrash, ShieldCheck, UserCog } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type SubmitEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { FormMessage, PasswordField, SubmitButton, TextField } from "@/components/ui/form";
import { ease } from "@/components/ui/motion";
import { buttonClass, cn } from "@/components/ui/styles";
import { API_URL } from "@/lib/api";

type Status = "loading" | "available" | "closed" | "error";

function Steps({ status, complete }: { status: Status; complete: boolean }) {
  const steps = ["Check availability", "Create administrator", "Sign in"];
  const state = (index: number) => {
    if (complete) return index < 2 ? "done" : "current";
    if (status === "loading") return index === 0 ? "current" : "todo";
    if (status === "available") return index === 0 ? "done" : index === 1 ? "current" : "todo";
    return index === 0 ? "blocked" : "todo";
  };
  return <ol aria-label="Setup progress" className="mt-6 grid grid-cols-3 gap-2">
    {steps.map((label, index) => {
      const value = state(index);
      return <li key={label} aria-current={value === "current" ? "step" : undefined}>
        <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
          <motion.span className={cn("block h-full rounded-full", value === "blocked" ? "bg-amber-400" : "bg-brand-500")} initial={false} animate={{ width: value === "done" || value === "blocked" ? "100%" : value === "current" ? "45%" : "0%" }} transition={{ duration: 0.6, ease }} />
        </span>
        <span className={cn("mt-2 flex items-center gap-1 text-[0.7rem] font-medium leading-4", value === "todo" ? "text-slate-400" : "text-slate-700")}>
          {value === "done" && <Check aria-hidden className="size-3 text-brand-600" />}{label}
          <span className="sr-only">{value === "done" ? " (complete)" : value === "current" ? " (current step)" : value === "blocked" ? " (unavailable)" : ""}</span>
        </span>
      </li>;
    })}
  </ol>;
}

export default function SetupPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/setup/status`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active) setStatus(data.enabled ? "available" : "closed");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    if (data.get("password") !== data.get("confirm")) { setError("The passwords do not match."); return; }
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/setup/admin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.get("token"), email: data.get("email"), password: data.get("password") }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : "Initial setup could not be completed.");
      }
      form.reset();
      setComplete(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to reach WeHire."); }
    finally { setPending(false); }
  }

  const view = complete ? "complete" : status;

  return <AuthShell
    caption="Workspace setup"
    eyebrow="One-time setup"
    headline="Set up your WeHire workspace."
    lead="Create the first administrator, then add your team and manage access from the administration console."
    footnote="Setup is available once and closes permanently after use."
    highlights={[
      { icon: <KeyRound />, title: "Private setup key", text: "Supplied by your system administrator. It is never public." },
      { icon: <UserCog />, title: "One administrator", text: "Creates a new HR administrator. Existing accounts are not changed." },
      { icon: <LockKeyhole />, title: "Closes after use", text: "Once an administrator exists, setup cannot be reopened." },
    ]}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">One-time setup</p>
    <h2 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900">{complete ? "Your workspace is ready" : "Create your first administrator"}</h2>
    <Steps status={status} complete={complete} />

    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease }} className="mt-7">
        {view === "complete" && <>
          <Alert tone="success">Your administrator account has been created. Sign in to add your team and manage access.</Alert>
          <Link href="/sign-in" className={buttonClass({ size: "lg", className: "mt-6 w-full" })}>Continue to sign in<ArrowRight aria-hidden /></Link>
        </>}

        {view === "loading" && <div role="status" aria-live="polite">
          <span className="sr-only">Checking setup availability…</span>
          <div aria-hidden className="space-y-4"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div>
          <p aria-hidden className="mt-4 text-sm text-slate-500">Checking setup availability…</p>
        </div>}

        {view === "closed" && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"><CircleSlash className="size-5" /></span>
          <p className="mt-4 text-sm leading-7 text-slate-600">Initial setup is unavailable or has already been completed. Sign in with an existing account, or contact your system administrator.</p>
        </div>}

        {view === "error" && <Alert tone="danger" title="Setup check failed" action={<ServerCrash aria-hidden className="size-5 shrink-0 opacity-60" />}>Unable to check setup. Verify that the backend is running and its database migrations have been applied.</Alert>}

        {view === "available" && <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
          <p className="flex gap-3 rounded-xl bg-brand-50/70 p-3.5 text-sm leading-6 text-slate-600 ring-1 ring-brand-100"><ShieldCheck aria-hidden className="mt-0.5 size-[18px] shrink-0 text-brand-600" />Use the private setup key supplied by your system administrator. This creates one administrator account; it is not public registration.</p>
          <PasswordField name="token" label="Setup key" icon={<KeyRound />} required minLength={32} autoComplete="off" disabled={pending} />
          <TextField name="email" type="email" label="Administrator email" icon={<Mail />} required maxLength={254} autoComplete="username" disabled={pending} />
          <PasswordField name="password" label="Password" icon={<LockKeyhole />} required minLength={6} maxLength={128} autoComplete="new-password" showRequirement disabled={pending} />
          <PasswordField name="confirm" label="Confirm password" icon={<LockKeyhole />} required minLength={6} maxLength={128} autoComplete="new-password" disabled={pending} />
          <FormMessage message={error} />
          <SubmitButton pending={pending} pendingLabel="Creating account…">Create administrator<ArrowRight aria-hidden /></SubmitButton>
        </form>}
      </motion.div>
    </AnimatePresence>

    {!complete && <Link href="/sign-in" className="mt-7 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand-700 underline-offset-4 hover:underline"><ArrowLeft aria-hidden className="size-4" />Back to sign in</Link>}
  </AuthShell>;
}
