import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { SignOut } from "@/components/sign-out";
import { Brand } from "@/components/ui/brand";
import { Reveal } from "@/components/ui/motion";
import { buttonClass, cardClass, cn } from "@/components/ui/styles";

export default function AccessDenied() {
  return <main className="page-glow flex min-h-dvh flex-col items-center justify-center px-5 py-12 text-slate-900">
    <Reveal className={cn(cardClass, "w-full max-w-md p-8 sm:p-10")}>
      <Brand />
      <div className="relative mt-8 w-fit">
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-amber-200/60 motion-safe:animate-ping [animation-iteration-count:2]" />
        <span aria-hidden className="relative grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200"><ShieldAlert className="size-6" /></span>
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Access restricted</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Your account does not have permission to open this page. Contact your administrator if you need access.</p>
      <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6 sm:flex sm:items-start sm:justify-between">
        <Link href="/sign-in" className={buttonClass({ variant: "secondary", className: "w-full sm:w-auto" })}><ArrowLeft aria-hidden />Back to sign in</Link>
        <SignOut block className="sm:[&>button]:w-auto" />
      </div>
    </Reveal>
  </main>;
}
