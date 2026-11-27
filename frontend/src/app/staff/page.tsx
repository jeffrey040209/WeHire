import { ArrowUpRight, BriefcaseBusiness, CloudOff, FileSearch, Inbox, LayoutDashboard, ShieldCheck, Sparkles, UserRoundCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader, PageSkeleton, StatePanel } from "@/components/app-frame";
import { SignOut } from "@/components/sign-out";
import { Badge } from "@/components/ui/feedback";
import { Item, RollingNumber, Stagger } from "@/components/ui/motion";
import { HeroTrail } from "@/components/ui/hero-trail";
import { buttonClass, cardClass, cn } from "@/components/ui/styles";
import { UserMenu } from "@/components/user-menu";
import type { Identity } from "@/lib/api";
import { SERVER_API_URL } from "@/lib/server-api";
import { roleLabel } from "@/lib/roles";

async function StaffWorkspace() {
  const jar = await cookies();
  const token = jar.get("wehire_session")?.value;
  if (!token) redirect("/sign-in");
  let identityResponse: Response;
  let accessResponse: Response;
  try {
    const options = { headers: { Cookie: `wehire_session=${token}` }, cache: "no-store" as const };
    [identityResponse, accessResponse] = await Promise.all([
      fetch(`${SERVER_API_URL}/auth/me`, options), fetch(`${SERVER_API_URL}/staff/access`, options),
    ]);
  } catch {
    return <StatePanel icon={<CloudOff />} title="Workspace temporarily unavailable" message="Please try again shortly." retryHref="/staff"><SignOut variant="ghost" /></StatePanel>;
  }
  if (identityResponse.status === 401 || accessResponse.status === 401) redirect("/sign-in");
  if (accessResponse.status === 403) redirect("/access-denied");
  if (!identityResponse.ok || !accessResponse.ok) return <StatePanel icon={<CloudOff />} title="Workspace unavailable" message="Unable to load your workspace. Please try again." retryHref="/staff" />;
  const user: Identity = await identityResponse.json();
  const { vacancies }: { vacancies: { id: number; title: string }[] } = await accessResponse.json();

  const nav = [
    { href: "/staff", label: "Workspace", icon: <LayoutDashboard />, current: true },
    { href: "/staff/vacancies", label: "Vacancies", icon: <BriefcaseBusiness /> },
    ...(user.is_admin ? [{ href: "/admin", label: "Administration", icon: <ShieldCheck /> }] : []),
  ];
  const tiles = [
    { label: "Assigned vacancies", value: vacancies.length, detail: vacancies.length === 1 ? "Vacancy you can access" : "Vacancies you can access", icon: <BriefcaseBusiness />, tone: "from-amber-400 to-orange-600" },
    { label: "Your roles", value: user.roles.length, detail: user.roles.map(roleLabel).join(" · ") || "No roles", icon: <UsersRound />, tone: "from-sky-400 to-indigo-600" },
  ];
  const tints = ["from-violet-500/25", "from-amber-500/25", "from-sky-500/25", "from-emerald-500/25", "from-fuchsia-500/25"];

  return <div className="min-h-dvh text-slate-900">
    <AppHeader caption="Staff workspace" nav={nav} account={<UserMenu user={user} links={user.is_admin ? [{ href: "/admin", label: "Administration", icon: <ShieldCheck /> }] : []} />} />
    <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <Stagger as="section" aria-labelledby="workspace-heading" className="feature-panel relative overflow-hidden rounded-[2rem] p-6 text-white shadow-lift ring-1 ring-white/10 sm:p-10">
        <div aria-hidden className="grid-fade absolute inset-0" />
        <HeroTrail />
        <div className="relative max-w-2xl">
          <Item><p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur"><span className="size-1.5 rounded-full bg-white shadow-[0_0_10px_white]" />Staff workspace</p></Item>
          <Item><h1 id="workspace-heading" className="mt-5 text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">Your recruitment workspace</h1></Item>
          <Item><p className="mt-3 break-all text-white/70">Signed in as <span className="font-medium text-white">{user.email}</span></p></Item>
          <Item className="mt-5 flex flex-wrap gap-2">{user.roles.map(role => <span key={role} className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/15"><span aria-hidden className="size-1.5 rounded-full bg-white/80" />{roleLabel(role)}</span>)}{user.is_admin && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-[#d1fae5] ring-1 ring-inset ring-emerald-300/30"><ShieldCheck aria-hidden className="size-3" />Administrator</span>}</Item>
          <Item className="mt-8 flex flex-wrap gap-3">
            <Link href="/staff/vacancies" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-px hover:shadow-xl active:scale-[0.97] dark:text-[#1c171d]"><BriefcaseBusiness aria-hidden className="size-4" />Open vacancies</Link>
            {user.is_admin && <Link href="/admin" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 active:scale-[0.97]"><ShieldCheck aria-hidden className="size-4" />Administration</Link>}
          </Item>
        </div>
      </Stagger>

      <Stagger as="ul" aria-label="Workspace summary" className="mt-5 grid gap-4 sm:grid-cols-3" delay={0.25}>
        {tiles.map(tile => <Item as="li" key={tile.label} lift className={cn(cardClass, "spotlight p-5")}>
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{tile.label}</p><span aria-hidden className={cn("grid size-9 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md [&_svg]:size-[18px]", tile.tone)}>{tile.icon}</span></div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums"><RollingNumber value={tile.value} delay={400} /></p>
          <p className="mt-1 truncate text-xs text-slate-500" title={tile.detail}>{tile.detail}</p>
        </Item>)}
        <Item as="li" lift className={cn(cardClass, "spotlight p-5")}>
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">Access level</p><span aria-hidden className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md [&_svg]:size-[18px]"><UserRoundCheck /></span></div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{user.is_admin ? "Administrator" : "Staff"}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{user.is_admin ? "Can manage accounts and access" : "Assigned vacancies only"}</p>
        </Item>
      </Stagger>

      <Stagger as="section" aria-labelledby="assigned-heading" className={cn(cardClass, "mt-5 overflow-hidden")} delay={0.4}>
        <Item className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-5 py-4 sm:px-6">
          <div><h2 id="assigned-heading" className="text-base font-semibold">Assigned vacancies</h2><p className="mt-0.5 text-sm text-slate-500">Vacancies your administrator has given you access to.</p></div>
          <Link href="/staff/vacancies" className={buttonClass({ variant: "soft", size: "sm" })}>Manage vacancies<ArrowUpRight aria-hidden /></Link>
        </Item>
        {vacancies.length ? <Stagger as="ul" className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3" delay={0.5} gap={0.05}>
          {vacancies.map((v, index) => <Item as="li" key={v.id} lift className="spotlight group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50 p-4 transition-shadow hover:shadow-lift">
            <span aria-hidden className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-70 transition-opacity group-hover:opacity-100", tints[index % tints.length])} />
            <div className="relative flex items-start gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/70 text-slate-700 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:text-white dark:ring-white/10"><BriefcaseBusiness className="size-[18px]" /></span>
              <div className="min-w-0"><Link href={`/staff/vacancies?id=${v.id}`} className="break-words font-medium leading-6 text-slate-900 after:absolute after:inset-0 hover:underline">{v.title}</Link><p className="mt-0.5 font-mono text-xs text-slate-500">#{v.id}</p></div>
            </div>
            <div className="relative mt-4 flex items-center justify-between"><Badge tone="success" dot>Assigned access</Badge><ArrowUpRight aria-hidden className="size-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" /></div>
          </Item>)}
        </Stagger> : <Item className="px-6 py-14 text-center">
          <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 motion-safe:animate-float"><Inbox className="size-6" /></span>
          <p className="mt-5 font-medium text-slate-800">No vacancies assigned yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Your administrator can assign vacancies to your account.</p>
          {user.is_admin && <Link href="/admin" className={buttonClass({ variant: "soft", className: "mt-6" })}><ShieldCheck aria-hidden />Open administration</Link>}
        </Item>}
      </Stagger>

      <Stagger delay={0.55}>
        <Item className="mt-5 flex items-start gap-4 rounded-3xl border border-dashed border-slate-300 bg-surface p-5 backdrop-blur-md">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Sparkles className="size-[18px]" /></span>
          <div><p className="text-sm font-medium text-slate-800">Coming next</p><p className="mt-1 text-sm leading-6 text-slate-500">Candidate submissions, screening results and DISC records will be added in later steps.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1"><FileSearch aria-hidden className="size-3.5" />Candidate submissions</span><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1"><UserRoundCheck aria-hidden className="size-3.5" />Screening results</span><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1"><Sparkles aria-hidden className="size-3.5" />DISC records</span></div>
          </div>
        </Item>
      </Stagger>
    </main>
  </div>;
}

export default function StaffPage() {
  return <Suspense fallback={<PageSkeleton label="Loading your workspace…" />}><StaffWorkspace /></Suspense>;
}
