import { BriefcaseBusiness, CloudOff, FileSearch, Inbox, LayoutDashboard, ShieldCheck, Sparkles, UserRoundCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader, PageSkeleton, StatePanel } from "@/components/app-frame";
import { SignOut } from "@/components/sign-out";
import { Badge } from "@/components/ui/feedback";
import { Item, Stagger } from "@/components/ui/motion";
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
  const stats = [
    { label: "Assigned vacancies", value: String(vacancies.length), detail: vacancies.length === 1 ? "Vacancy you can access" : "Vacancies you can access", icon: <BriefcaseBusiness /> },
    { label: "Your roles", value: String(user.roles.length), detail: user.roles.map(roleLabel).join(" · ") || "No roles", icon: <UsersRound /> },
    { label: "Access level", value: user.is_admin ? "Administrator" : "Staff", detail: user.is_admin ? "Can manage accounts and access" : "Assigned vacancies only", icon: <UserRoundCheck /> },
  ];

  return <div className="page-glow min-h-dvh text-slate-900">
    <AppHeader caption="Staff workspace" nav={nav} account={<UserMenu user={user} links={user.is_admin ? [{ href: "/admin", label: "Administration", icon: <ShieldCheck /> }] : []} />} />
    <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
      <Stagger>
        <Item><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Staff workspace</p></Item>
        <Item><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your recruitment workspace</h1></Item>
        <Item><p className="mt-3 break-all text-slate-600">Signed in as <span className="font-medium text-slate-800">{user.email}</span></p></Item>
        <Item className="mt-4 flex flex-wrap gap-2">{user.roles.map(role => <Badge key={role} tone="brand" dot>{roleLabel(role)}</Badge>)}{user.is_admin && <Badge tone="success"><ShieldCheck aria-hidden className="size-3" />Administrator</Badge>}</Item>
      </Stagger>

      <Stagger as="ul" aria-label="Workspace summary" className="mt-9 grid gap-4 sm:grid-cols-3" delay={0.2}>
        {stats.map(stat => <Item as="li" key={stat.label} className={cn(cardClass, "group p-5 transition hover:-translate-y-0.5 hover:shadow-lift")}>
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{stat.label}</p><span aria-hidden className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:scale-110 [&_svg]:size-[18px]">{stat.icon}</span></div>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{stat.value}</p>
          <p className="mt-1 truncate text-xs text-slate-500" title={stat.detail}>{stat.detail}</p>
        </Item>)}
      </Stagger>

      <Stagger as="section" aria-labelledby="assigned-heading" className={cn(cardClass, "mt-6 overflow-hidden")} delay={0.35}>
        <Item className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><h2 id="assigned-heading" className="text-base font-semibold">Assigned vacancies</h2><p className="mt-0.5 text-sm text-slate-500">Vacancies your administrator has given you access to.</p></div>
          <Link href="/staff/vacancies" className={buttonClass({ variant: "soft", size: "sm" })}>Manage vacancies</Link>
        </Item>
        {vacancies.length ? <Stagger as="ul" className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3" delay={0.45} gap={0.05}>
          {vacancies.map(v => <Item as="li" key={v.id} className="group rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-brand-200 hover:bg-white hover:shadow-card">
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/80 transition group-hover:ring-brand-200"><BriefcaseBusiness className="size-[18px]" /></span>
              <div className="min-w-0"><Link href={`/staff/vacancies?id=${v.id}`} className="break-words font-medium leading-6 text-slate-900 hover:text-brand-600 hover:underline">{v.title}</Link><p className="mt-0.5 font-mono text-xs text-slate-400">#{v.id}</p></div>
            </div>
            <div className="mt-4"><Badge tone="success" dot>Assigned access</Badge></div>
          </Item>)}
        </Stagger> : <Item className="px-6 py-14 text-center">
          <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Inbox className="size-6" /></span>
          <p className="mt-5 font-medium text-slate-800">No vacancies assigned yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Your administrator can assign vacancies to your account.</p>
          {user.is_admin && <Link href="/admin" className={buttonClass({ variant: "soft", className: "mt-6" })}><ShieldCheck aria-hidden />Open administration</Link>}
        </Item>}
      </Stagger>

      <Stagger delay={0.5}>
        <Item className="mt-6 flex items-start gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
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
