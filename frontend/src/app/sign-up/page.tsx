"use client";

import { ArrowRight, Check, FileUp, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type SubmitEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Badge } from "@/components/ui/feedback";
import { FormMessage, PasswordField, SubmitButton, TextField } from "@/components/ui/form";
import { ease } from "@/components/ui/motion";
import { buttonClass, cn } from "@/components/ui/styles";
import { API_URL } from "@/lib/api";

export default function CandidateSignUp() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    if (data.get("password") !== data.get("confirm")) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      if (response.status !== 202) {
        throw new Error(response.status === 429 ? "Too many registration attempts. Please wait before trying again." : response.status === 422 ? "Use a valid email and a password of 6–128 characters." : "Registration is unavailable. Please try again later.");
      }
      form.reset();
      setComplete(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to reach WeHire. Please try again.");
    } finally { setPending(false); }
  }

  const matches = confirm.length > 0 && password === confirm;

  return <AuthShell
    theme="candidate"
    caption="Candidate access"
    eyebrow="Candidate access"
    headline="Your next chapter starts with you."
    lead="Create your own candidate account. Keep your sign-in details private and use an email address you control."
    footnote="Your account. Your information."
    highlights={[
      { icon: <UserRound />, title: "An account that is yours", text: "Candidate registration only. Staff accounts are managed separately." },
      { icon: <FileUp />, title: "Focused input pages", text: "Resume, DISC result and clarification inputs for your application." },
      { icon: <ShieldCheck />, title: "Private to you", text: "Your account does not provide access to other candidates’ information." },
    ]}
  >
    <Badge tone="brand">For candidates</Badge>
    <AnimatePresence mode="wait" initial={false}>
      {complete ? <motion.div key="complete" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
        <motion.span aria-hidden initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 }} className="mt-6 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Check className="size-7" strokeWidth={2.5} />
        </motion.span>
        <div role="status">
          <h2 className="mt-5 text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900">Registration request received</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Try signing in with your details. If you already have an account, use its existing password or contact your WeHire administrator for help.</p>
        </div>
        <Link href="/sign-in" className={buttonClass({ size: "lg", className: "mt-7 w-full" })}>Continue to sign in<ArrowRight aria-hidden /></Link>
      </motion.div> : <motion.div key="form" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
        <h2 className="mt-5 text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900">Create your candidate account</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">Already registered? <Link href="/sign-in" className="rounded font-semibold text-brand-700 underline-offset-4 hover:underline">Sign in</Link></p>
        <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={pending}>
          <TextField name="email" type="email" label="Email" icon={<Mail />} required maxLength={254} autoComplete="username" placeholder="you@example.com" disabled={pending} />
          <PasswordField name="password" label="Password" icon={<KeyRound />} required minLength={6} maxLength={128} autoComplete="new-password" showRequirement onValueChange={setPassword} disabled={pending} />
          <PasswordField
            name="confirm"
            label="Confirm password"
            icon={<KeyRound />}
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
            onValueChange={setConfirm}
            disabled={pending}
            hint={confirm.length > 0 && <span aria-live="polite" className={cn("inline-flex items-center gap-1.5", matches ? "text-emerald-700" : "text-slate-500")}>{matches ? <><Check aria-hidden className="size-3.5" />Passwords match</> : "Passwords do not match yet"}</span>}
          />
          <FormMessage message={error} />
          <SubmitButton pending={pending} pendingLabel="Submitting…">Create candidate account<ArrowRight aria-hidden /></SubmitButton>
        </form>
        <p className="mt-6 border-t border-slate-100 pt-5 text-xs leading-6 text-slate-500">This registration is for candidates. Staff accounts and permissions are managed by your company administrator.</p>
      </motion.div>}
    </AnimatePresence>
  </AuthShell>;
}
