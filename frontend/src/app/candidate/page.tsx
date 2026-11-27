import { BadgeCheck, CloudOff, FileText, Image as ImageIcon, LockKeyhole, MessageSquareReply } from "lucide-react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader, PageSkeleton, StatePanel } from "@/components/app-frame";
import { Badge } from "@/components/ui/feedback";
import { HeroTrail } from "@/components/ui/hero-trail";
import { Item, Stagger } from "@/components/ui/motion";
import { cardClass, cn } from "@/components/ui/styles";
import { Avatar, UserMenu } from "@/components/user-menu";
import type { Identity } from "@/lib/api";
import { SERVER_API_URL } from "@/lib/server-api";

const tones = ["from-indigo-400 to-indigo-700", "from-sky-400 to-blue-700", "from-fuchsia-400 to-purple-700"];

const capabilities = [
  { label: "Resume Submission", text: "Upload a PDF or DOCX resume for the vacancy HR has set up for you.", icon: <FileText /> },
  { label: "DISC Result Upload", text: "Optionally attach a completed external DISC result screenshot to the same application.", icon: <ImageIcon /> },
  { label: "Clarification Response", text: "Answer an HR-approved request for missing evidence.", icon: <MessageSquareReply /> },
];

async function CandidateAccount() {
  const token = (await cookies()).get("wehire_session")?.value;
  if (!token) redirect("/sign-in");
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_URL}/auth/me`, { headers: { Cookie: `wehire_session=${token}` }, cache: "no-store" });
  } catch { return <StatePanel theme="candidate" icon={<CloudOff />} title="Account unavailable" message="Your account is temporarily unavailable. Please try again shortly." retryHref="/candidate" />; }
  if (response.status === 401) redirect("/sign-in");
  if (!response.ok) return <StatePanel theme="candidate" icon={<CloudOff />} title="Account unavailable" message="Unable to verify your account. Please try again." retryHref="/candidate" />;
  const user: Identity = await response.json();
  if (user.roles.length !== 1 || user.roles[0] !== "candidate") redirect("/access-denied");

  return <div data-theme="candidate" className="min-h-dvh text-slate-900">
    <AppHeader caption="Candidate account" account={<UserMenu user={user} />} />
    <main id="main" className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <Stagger as="section" aria-labelledby="candidate-heading" className="feature-panel relative overflow-hidden rounded-[2rem] p-6 text-white shadow-lift ring-1 ring-white/10 sm:p-9">
        <div aria-hidden className="grid-fade absolute inset-0" />
        <HeroTrail />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Item className="relative w-fit">
            <Avatar email={user.email} size="lg" className="size-16 text-xl ring-white/25" />
            <span aria-hidden className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-white shadow-sm"><BadgeCheck className="size-5 text-[#4f46e5]" /></span>
          </Item>
          <div className="min-w-0">
            <Item><p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur"><span aria-hidden className="size-1.5 rounded-full bg-white shadow-[0_0_10px_white]" />Candidate account</p></Item>
            <Item><h1 id="candidate-heading" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">You’re signed in</h1></Item>
            <Item><p className="mt-2 break-all text-white/70">{user.email}</p></Item>
          </div>
        </div>
      </Stagger>

      <Stagger as="section" aria-labelledby="ready-heading" className={cn(cardClass, "mt-5 p-6 sm:p-8")} delay={0.25}>
        <Item className="flex items-start gap-4">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><BadgeCheck className="size-5" /></span>
          <div><h2 id="ready-heading" className="text-lg font-semibold">Your account is ready</h2><p className="mt-1.5 text-sm leading-7 text-slate-500">The input pages below will be available in a later update. Your account does not provide access to other candidates’ information.</p></div>
        </Item>
        <Stagger as="ul" className="mt-6 grid gap-3" delay={0.4} gap={0.08}>
          {capabilities.map(({ label, text, icon }, index) => <Item as="li" key={label} lift className="spotlight flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 transition-shadow hover:shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md [&_svg]:size-[18px] ${tones[index]}`}>{icon}</span>
              <div><p className="text-sm font-medium text-slate-900"><span className="mr-2 font-mono text-xs text-slate-400">0{index + 1}</span>{label}</p><p className="mt-0.5 text-sm leading-6 text-slate-500">{text}</p></div>
            </div>
            <Badge tone="neutral" className="w-fit sm:shrink-0"><LockKeyhole aria-hidden className="size-3" />Not available yet</Badge>
          </Item>)}
        </Stagger>
      </Stagger>
    </main>
  </div>;
}

export default function CandidatePage() {
  return <Suspense fallback={<PageSkeleton theme="candidate" label="Loading your account…" />}><CandidateAccount /></Suspense>;
}
