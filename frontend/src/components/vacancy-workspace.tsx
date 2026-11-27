"use client";

import { ArrowLeft, ArrowRight, Archive, BriefcaseBusiness, Check, ChevronRight, ClipboardList, Copy, Eye, FileText, History, LayoutDashboard, LockKeyhole, MapPin, Plus, Save, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-frame";
import { UserMenu } from "@/components/user-menu";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Alert, Badge, Spinner } from "@/components/ui/feedback";
import { Reveal, popHidden, popShown, popSpring, popTransition } from "@/components/ui/motion";
import { buttonClass, cardClass, cn, inputClass, interactiveCardClass } from "@/components/ui/styles";
import { adminRequest as request } from "@/lib/admin-api";
import type { Identity } from "@/lib/api";
import { editableBrief, type Brief, type Configuration, type Vacancy } from "@/lib/vacancies";

const base = "/staff/vacancies";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";
const textareaClass = cn(inputClass, "py-3 leading-6");
const statusTone = { draft: "warning", approved: "success", archived: "neutral" } as const;
const selectClass = cn(inputClass, "select-chevron h-11 appearance-none pr-10");
const tints = ["from-violet-500/20", "from-amber-500/20", "from-sky-500/20", "from-emerald-500/20", "from-fuchsia-500/20"];
const stepTones = ["from-violet-400 to-purple-700", "from-amber-400 to-orange-600", "from-emerald-400 to-teal-600"];

export function VacancyWorkspace({ user, initialId }: { user: Identity; initialId: number | null }) {
  const [rows, setRows] = useState<Vacancy[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState<number | null>(initialId);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "12", offset: String(offset) });
      if (filter) params.set("status", filter);
      const result = await request<{ items: Vacancy[]; total: number }>(`${base}?${params}`);
      setRows(result.items); setTotal(result.total); setError("");
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [query, offset, filter]);
  useEffect(() => { if (active === null) { const timer = setTimeout(() => void reload(), 200); return () => clearTimeout(timer); } }, [reload, active]);
  function open(id: number | null) { setActive(id); window.history.replaceState(null, "", id ? `${base}?id=${id}` : base); }
  async function create() {
    setBusy(true); setError("");
    try {
      const record = await request<Vacancy>(base, "POST", { title: title.trim() });
      setCreateOpen(false); setTitle(""); open(record.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="min-h-dvh text-slate-900">
    <AppHeader caption="Recruitment studio" account={<UserMenu user={user} />} nav={[
      { href: "/staff", label: "Workspace", icon: <LayoutDashboard /> },
      { href: "/staff/vacancies", label: "Vacancies", icon: <BriefcaseBusiness />, current: true },
      ...(user.is_admin ? [{ href: "/admin", label: "Administration", icon: <ShieldCheck /> }] : []),
    ]} />
    <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {active !== null ? <VacancyEditor key={active} id={active} user={user} onBack={() => open(null)} /> : <>
        <Reveal className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Manual setup · Internal only</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Build a clearer hiring brief.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Save the role brief now. AI scorecard generation and HR review follow in the next phase.</p></div>
          <button onClick={() => setCreateOpen(true)} className={buttonClass()}><Plus aria-hidden />New vacancy</button>
        </Reveal>
        <Reveal delay={0.1} className="mt-7 grid gap-3 sm:grid-cols-3">
          {[["01", "Define the role", "JD, seniority and responsibilities"], ["02", "AI prepares the scorecard", "Generation planned · no manual entry"], ["03", "HR reviews & approves", "Validated scorecard + immutable version"]].map(([n, title, detail], index) => <div key={n} className={cn(interactiveCardClass, "flex items-start gap-3 p-4")}><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br font-mono text-xs font-semibold text-white shadow-md", stepTones[index])}>{n}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></div>)}
        </Reveal>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1"><Search aria-hidden className="absolute left-3 top-3.5 size-4 text-slate-400" /><input aria-label="Search vacancies" placeholder="Search assigned vacancies…" value={query} onChange={e => { setQuery(e.target.value); setOffset(0); }} className={cn(inputClass, "h-11 rounded-full pl-10")} /></div>
          <div className="w-44 shrink-0"><select aria-label="Vacancy status" value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }} className={cn(selectClass, "rounded-full")}><option value="">All statuses</option>{["draft", "approved", "archived"].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></div>
          <span aria-live="polite" className="text-xs text-slate-500">{total} assigned</span>
        </div>
        {error && <Alert className="mt-4" action={<button className="underline" onClick={() => void reload()}>Retry</button>}>{error}</Alert>}
        {loading ? <div role="status" className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500"><Spinner />Loading vacancies…</div> : rows.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((v, index) => <motion.button key={v.id} initial={{ opacity: 0, y: 32, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...popSpring, delay: Math.min(index, 8) * 0.08, opacity: { duration: 0.6, delay: Math.min(index, 8) * 0.08 } }} onClick={() => open(v.id)} className={cn(interactiveCardClass, "group overflow-hidden p-5 text-left")}>
          <span aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br to-transparent to-60% opacity-80", tints[index % tints.length])} />
          <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-white/70 text-slate-700 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:text-white dark:ring-white/10"><BriefcaseBusiness aria-hidden className="size-5" /></span><Badge tone={statusTone[v.status]} dot>{v.status}</Badge></div>
          <h2 className="mt-5 break-words text-lg font-semibold">{v.title}</h2><p className="mt-2 font-mono text-xs text-slate-500">VAC-{String(v.id).padStart(3, "0")}</p>
          <div className="mt-6 flex items-center justify-between border-t border-slate-200/70 pt-4"><span className="text-xs text-slate-500">{v.approved_version ? `Approved v${v.approved_version}` : "Awaiting approval"}{v.draft_id ? " · Draft available" : ""}</span><ArrowRight aria-hidden className="size-4 text-brand-600 transition group-hover:translate-x-1" /></div>
        </motion.button>)}</div> : <div className={cn(cardClass, "mt-5 px-6 py-16 text-center")}><BriefcaseBusiness aria-hidden className="mx-auto size-10 text-slate-400 motion-safe:animate-float" /><h2 className="mt-4 font-semibold">No matching vacancies</h2><p className="mt-2 text-sm text-slate-500">Create a vacancy to get started. You will be assigned automatically.</p></div>}
        {total > 12 && <div className="mt-5 flex justify-end gap-2"><button disabled={!offset || loading} onClick={() => setOffset(o => Math.max(0, o - 12))} className={buttonClass({ variant: "secondary" })}>Previous</button><button disabled={offset + 12 >= total || loading} onClick={() => setOffset(o => o + 12)} className={buttonClass({ variant: "secondary" })}>Next</button></div>}
      </>}
    </main>
    <Dialog open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} dismissible={!busy} title="Create an internal vacancy" description="Start with a role title. You can complete the brief and scorecard in your draft." icon={<BriefcaseBusiness />}>
      <form onSubmit={e => { e.preventDefault(); void create(); }} className="space-y-5"><label className={labelClass}>Role title<input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Backend Engineer" className={cn(inputClass, "mt-2 h-12")} /></label><p className="text-xs leading-5 text-slate-500">Your account is assigned automatically. An administrator can assign HR or additional hiring managers.</p>{error && <Alert>{error}</Alert>}<button disabled={busy || !title.trim()} className={buttonClass({ className: "w-full" })}>{busy ? <Spinner /> : <Plus aria-hidden />}Create draft</button></form>
    </Dialog>
  </div>;
}

function VacancyEditor({ id, user, onBack }: { id: number; user: Identity; onBack: () => void }) {
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [tab, setTab] = useState<"brief" | "scorecard" | "preview">("brief");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, confirmation] = useConfirm();
  const version = vacancy?.versions?.find(v => v.id === versionId);
  const locked = version?.status !== "draft" || vacancy?.status === "archived";
  function accept(record: Vacancy, preferred?: number | null) {
    setVacancy(record);
    const chosen = record.versions?.find(v => v.id === preferred) ?? record.versions?.find(v => v.id === record.draft_id) ?? record.versions?.[0];
    setVersionId(chosen?.id ?? null); setBrief(chosen ? editableBrief(chosen) : null); setDirty(false);
  }
  const load = useCallback(async () => {
    try { accept(await request<Vacancy>(`${base}/${id}`)); setError(""); }
    catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function leave() { if (!dirty || await confirm({ title: "Leave this draft?", message: "Your unsaved changes will be lost.", confirmLabel: "Leave draft" })) onBack(); }
  async function switchVersion(nextId: number) {
    if (dirty && !await confirm({ title: "Switch versions?", message: "Your unsaved changes will be lost.", confirmLabel: "Switch version" })) return;
    if (vacancy) accept(vacancy, nextId);
  }
  async function run(path: string, method: string, body?: unknown, message = "Role brief saved.") {
    setBusy(true); setError(""); setNotice("");
    try { const record = await request<Vacancy>(`${base}/${id}${path}`, method, body); accept(record); setNotice(message); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function change(values: Partial<Brief>) { setBrief(current => current ? { ...current, ...values } : current); setDirty(true); setNotice(""); }
  if (!vacancy) return <div className="space-y-5"><button onClick={onBack} className={buttonClass({ variant: "ghost" })}><ArrowLeft aria-hidden />All vacancies</button>{error ? <Alert action={<button onClick={() => void load()} className="underline">Retry</button>}>{error}</Alert> : <div role="status" className="flex items-center gap-3 py-20"><Spinner />Loading configuration…</div>}</div>;
  const validInputs = Boolean(brief?.title.trim());
  const approveReady = !dirty && version && !version.approval_errors.length && !locked;

  return <>
    <button onClick={() => void leave()} className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-3" })}><ArrowLeft aria-hidden />All vacancies</button>
    <Reveal className="mt-5 flex flex-wrap items-start justify-between gap-5">
      <div><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs text-slate-400">VAC-{String(id).padStart(3, "0")}</p><Badge tone={statusTone[vacancy.status]} dot>{vacancy.status}</Badge>{dirty && <Badge tone="warning">Unsaved changes</Badge>}</div><h1 className="mt-3 break-words text-3xl font-semibold tracking-tight">{brief?.title || vacancy.title}</h1><p className="mt-2 text-sm text-slate-500">Internal role configuration · {vacancy.approved_version ? `Approved v${vacancy.approved_version} preserved` : "Not yet approved"}</p></div>
      <div className="flex flex-wrap gap-2">
        {!locked && version && <button disabled={busy || !validInputs || !dirty} onClick={() => void run(`/versions/${version.id}`, "PUT", { ...brief!, revision: version.revision })} className={buttonClass()}>{busy ? <Spinner /> : <Save aria-hidden />}Save role brief</button>}
        {vacancy.status !== "archived" && !vacancy.draft_id && <button disabled={busy} onClick={() => void run("/drafts", "POST", { source_version_id: version?.id }, "New draft created. Previous approvals are preserved.")} className={buttonClass({ variant: "secondary" })}><Copy aria-hidden />{version ? "Create new draft" : "Start configuration"}</button>}
        {locked && vacancy.draft_id && vacancy.status !== "archived" && <button onClick={() => void switchVersion(vacancy.draft_id!)} className={buttonClass({ variant: "secondary" })}>Open current draft</button>}
      </div>
    </Reveal>
    {error && <Alert className="mt-5" action={<button onClick={() => void load()} className="shrink-0 underline">Reload</button>}>{error}</Alert>}
    {notice && <Alert tone="success" className="mt-5">{notice}</Alert>}
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="glass mb-4 flex flex-wrap items-center gap-1 rounded-full p-1.5" role="tablist" aria-label="Vacancy editor">
          {([["brief", "Role brief", FileText], ["scorecard", "Scorecard", SlidersHorizontal], ["preview", "Preview", Eye]] as const).map(([value, label, Icon]) => <button key={value} id={`tab-${value}`} role="tab" aria-controls={`panel-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={event => {
            const tabs = ["brief", "scorecard", "preview"] as const;
            const index = tabs.indexOf(value);
            const next = event.key === "ArrowRight" ? tabs[(index + 1) % 3] : event.key === "ArrowLeft" ? tabs[(index + 2) % 3] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[2] : null;
            if (next) { event.preventDefault(); setTab(next); document.getElementById(`tab-${next}`)?.focus(); }
          }} onClick={() => setTab(value)} className={cn("relative flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors", tab === value ? "text-slate-900" : "text-slate-500 hover:text-slate-900")}>{tab === value && <motion.span aria-hidden layoutId="vacancy-tab" transition={{ type: "spring", stiffness: 480, damping: 36 }} className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10" />}<Icon aria-hidden className="relative size-4" /><span className="relative">{label}</span></button>)}
        </div>
        {brief ? <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          <motion.div key={tab} initial={popHidden} animate={popShown} transition={popTransition()}>
          {locked && <Alert tone="info" className="mb-4"><LockKeyhole aria-hidden className="mr-2 inline size-4" />{vacancy.status === "archived" ? "Archived vacancy. Configuration history is read-only." : "Approved snapshot. Create a new draft to make changes."}</Alert>}
          {tab === "brief" && <fieldset disabled={locked || busy} className={cn(cardClass, "min-w-0 space-y-5 p-5 sm:p-7")}>
            <div><h2 className="text-lg font-semibold">Define the role</h2><p className="mt-1 text-sm text-slate-500">Be specific about the work and the level of ownership.</p></div>
            <label className={labelClass}>Role title<input aria-label="Role title" value={brief.title} maxLength={200} onChange={e => change({ title: e.target.value })} className={cn(inputClass, "mt-2 h-11")} /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Seniority<select aria-label="Seniority" value={brief.seniority} onChange={e => change({ seniority: e.target.value })} className={cn(selectClass, "mt-2")}><option value="">Choose level</option>{["intern", "junior", "mid", "senior", "lead", "manager"].map(v => <option key={v} value={v}>{v}</option>)}</select></label><label className={labelClass}>Employment type<select aria-label="Employment type" value={brief.employment_type} onChange={e => change({ employment_type: e.target.value })} className={cn(selectClass, "mt-2")}><option value="">Choose type</option>{["full_time", "part_time", "contract", "internship", "temporary"].map(v => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></label></div>
            <label className={labelClass}>Location<input aria-label="Location" value={brief.location} maxLength={200} onChange={e => change({ location: e.target.value })} placeholder="e.g. Kuala Lumpur · Hybrid" className={cn(inputClass, "mt-2 h-11")} /></label>
            <label className={labelClass}>Job description<textarea aria-label="Job description" value={brief.jd} maxLength={20000} rows={6} onChange={e => change({ jd: e.target.value })} placeholder="Describe the purpose of this role and its contribution to the team…" className={cn(textareaClass, "mt-2")} /></label>
            <label className={labelClass}>Responsibilities<textarea aria-label="Responsibilities" value={brief.responsibilities} maxLength={20000} rows={5} onChange={e => change({ responsibilities: e.target.value })} placeholder="What will this person own and deliver?" className={cn(textareaClass, "mt-2")} /></label>
            <p className="text-xs leading-5 text-slate-500">Junior and senior roles should use different responsibilities, criteria and evidence anchors.</p>
          </fieldset>}
          {tab === "scorecard" && <div className={cn(cardClass, "p-5 sm:p-7")}><ScorecardReview version={version} dirty={dirty} /></div>}
          {tab === "preview" && <div className={cn(cardClass, "space-y-6 p-5 sm:p-7")}>
            <div><Badge tone="brand">{dirty ? "Unsaved preview" : `Version ${version?.version}`}</Badge><h2 className="mt-4 text-2xl font-semibold">{brief.title}</h2><p className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500"><span className="inline-flex items-center gap-1"><MapPin aria-hidden className="size-4" />{brief.location || "Location needed"}</span><span>{brief.seniority || "Level needed"}</span><span>{brief.employment_type.replaceAll("_", " ") || "Type needed"}</span></p></div>
            {([ ["Job description", brief.jd], ["Responsibilities", brief.responsibilities] ] as const).map(([title, value]) => <section key={title}><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{value || "Not yet provided"}</p></section>)}
            <ScorecardReview version={version} dirty={dirty} />
            <Alert tone="info">This is an internal vacancy preview. It does not publish a public job or run candidate screening.</Alert>
          </div>}
        </motion.div>
        </section> : <div className={cn(cardClass, "p-8 text-center text-sm text-slate-500")}>No active configuration. Start a new draft to continue.</div>}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className={cn(cardClass, "p-5")}>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList aria-hidden className="size-4 text-brand-600" />Vacancy readiness</h2>
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><FileText aria-hidden className="size-4" /></span><div><p className="text-sm font-medium">Role brief</p><p aria-live="polite" className="mt-1 text-xs text-slate-500">{dirty ? "Unsaved changes" : version?.role_brief_errors.length ? "Draft saved · details can be completed later" : "Saved and complete"}</p></div></div>
            <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Sparkles aria-hidden className="size-4" /></span><div><p className="text-sm font-medium">Scorecard</p><p className="mt-1 text-xs text-slate-500">{dirty ? "Save role changes before review" : version?.scorecard_state === "ready" ? `${version.weight_total}% allocated · ready for review` : version?.scorecard_state === "needs_review" ? "Saved scorecard needs validation" : "Awaiting AI generation"}</p></div></div>
          </div>
          {dirty && version?.criteria.length ? <p className="mt-4 text-xs leading-5 text-amber-700">Changing role details will retire this draft’s scorecard and require regeneration. Approved versions remain unchanged.</p> : null}
          {!dirty && version && version.scorecard_state === "awaiting_generation" && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Your role brief can be saved now. AI generation is planned; you do not need to enter weights or rating anchors.</p>}
          {!dirty && version && version.scorecard_state !== "awaiting_generation" && version.approval_errors.length > 0 && <ul className="mt-4 space-y-2">{version.approval_errors.map(e => <li key={e} className="flex gap-2 text-xs leading-5 text-slate-500"><ChevronRight aria-hidden className="mt-0.5 size-3 shrink-0 text-amber-500" />{e}</li>)}</ul>}
          {!locked && user.roles.includes("hr") && version && <button disabled={busy || !approveReady} onClick={async () => { if (await confirm({ title: "Approve this configuration?", message: "This snapshot will become immutable. Future changes require a new draft. Approval does not run screening.", confirmLabel: "Approve version" })) void run(`/versions/${version.id}/approve`, "POST", { revision: version.revision }, "HR approval recorded. This version is now immutable."); }} className={buttonClass({ className: "mt-5 w-full" })}><ShieldCheck aria-hidden />Approve version</button>}
          {!locked && version?.scorecard_state === "awaiting_generation" && <p className="mt-3 text-xs leading-5 text-slate-500">Approval unlocks after a complete scorecard is available and validated.</p>}
          {!user.roles.includes("hr") && !locked && <p className="mt-4 text-xs leading-5 text-slate-500">Assigned HR approves the completed configuration. An administrator can assign the HR reviewer.</p>}
        </section>
        <section className={cn(cardClass, "p-5")}><h2 className="flex items-center gap-2 text-sm font-semibold"><History aria-hidden className="size-4 text-brand-600" />Version history</h2><div className="mt-4 space-y-2">{vacancy.versions?.map(v => <button disabled={busy} key={v.id} onClick={() => void switchVersion(v.id)} className={cn("flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left transition", versionId === v.id ? "border-brand-200 bg-brand-50" : "border-slate-100 hover:bg-slate-50")}><div><p className="text-xs font-semibold">Version {v.version}</p><p className="mt-1 text-[11px] text-slate-500">{v.status === "approved" ? <><Check aria-hidden className="mr-1 inline size-3" />Approved</> : "Draft"}</p></div>{versionId === v.id && <Eye aria-hidden className="size-4 text-brand-600" />}</button>)}</div>{version?.approved_at && <p className="mt-4 text-xs leading-5 text-slate-500">Approved by user #{version.approved_by}<br /><time>{version.approved_at}</time><br />Asia/Kuala_Lumpur</p>}</section>
        {vacancy.status !== "archived" && <section className="space-y-2 px-1">
          {!locked && version && <button disabled={busy} onClick={async () => { if (await confirm({ title: "Discard this draft?", message: "The draft is soft-deleted. Approved history is preserved.", confirmLabel: "Discard draft", tone: "danger" })) void run(`/versions/${version.id}`, "DELETE", { revision: version.revision }, "Draft discarded. Approved history retained."); }} className={buttonClass({ variant: "ghost", size: "sm", className: "w-full" })}><Trash2 aria-hidden />Discard draft</button>}
          <button disabled={busy} onClick={async () => { if (await confirm({ title: "Archive this vacancy?", message: "The vacancy becomes read-only. All versions and assignments remain available to authorised staff.", confirmLabel: "Archive vacancy", tone: "danger" })) void run("/archive", "POST", undefined, "Vacancy archived. History retained."); }} className={buttonClass({ variant: "ghost", size: "sm", className: "w-full" })}><Archive aria-hidden />Archive vacancy</button>
        </section>}
        <Link href="/staff" className={buttonClass({ variant: "ghost", size: "sm", className: "w-full" })}><ArrowLeft aria-hidden />Recruitment workspace</Link>
      </aside>
    </div>
    {confirmation}
  </>;
}


/** Existing scorecards remain visible; new drafts wait for the future AI generation module. */
function ScorecardReview({ version, dirty }: { version?: Configuration; dirty: boolean }) {
  const hasScorecard = Boolean(version?.criteria.length || version?.mandatory_rules.length);
  return <section className="space-y-5" aria-label="Scorecard review">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Sparkles aria-hidden className="size-5" /></span><div><h2 className="text-lg font-semibold">AI-prepared scorecard</h2><p className="mt-1 text-sm leading-6 text-slate-500">AI will propose requirements, weights and evidence anchors from your saved role brief. HR reviews and approves.</p></div></div>
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-5">
      <Badge tone="neutral">AI generation · planned</Badge>
      <p className="mt-3 text-sm font-medium">{hasScorecard ? "Saved scorecard retained for review" : "No scorecard generated yet"}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">Save your role brief independently. You do not need to fill criteria, percentages or rating anchors manually. Generation and conversational revisions will be added in a later phase.</p>
      <button disabled type="button" aria-describedby="generation-note" className={buttonClass({ variant: "secondary", className: "mt-4" })}><Sparkles aria-hidden />Generate scorecard</button>
      <p id="generation-note" className="mt-2 text-xs text-slate-500">Not available yet. No AI request is sent.</p>
    </div>
    {dirty && hasScorecard && <Alert tone="warning">This scorecard reflects the saved brief. Save changed role details before reviewing; changed context requires a new scorecard.</Alert>}
    {hasScorecard && version && <>
      <div><h3 className="text-sm font-semibold">Saved mandatory rules ({version.mandatory_rules.length})</h3><ul className="mt-3 space-y-2">{version.mandatory_rules.map((r, i) => <li key={i} className="break-words rounded-xl bg-slate-50 p-3 text-sm"><strong>{r.name}</strong><p className="mt-1 text-slate-500">{r.requirement}</p></li>)}</ul></div>
      <div><h3 className="text-sm font-semibold">Saved criteria · {version.weight_total}% allocated</h3><div className="mt-3 space-y-3">{version.criteria.map((c, i) => <details key={i} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer break-words text-sm font-semibold">{c.name}<span className="ml-2 font-mono text-brand-600">{c.weight}%</span></summary><p className="mt-3 text-sm text-slate-500">{c.description}</p><ol className="mt-3 space-y-2 text-sm">{c.anchors.map(a => <li key={a.rating} className="flex gap-3 rounded-lg bg-slate-50 p-3"><strong className="text-brand-600">{a.rating}</strong><span className="break-words">{a.description}</span></li>)}</ol></details>)}</div></div>
      <p className="text-xs leading-5 text-slate-500">Points = weight × evidenced rating ÷ 4. Round half-up to two decimals per criterion, then sum. Missing evidence stays unknown. DISC is separate.</p>
    </>}
  </section>;
}
