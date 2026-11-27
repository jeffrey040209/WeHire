"use client";

import {
  Archive, ArrowLeft, BriefcaseBusiness, CheckCircle2, ChevronLeft, ChevronRight, FileStack, KeyRound, LayoutDashboard,
  Link2, Mail, Pencil, Plus, RefreshCw, Search, ShieldCheck, ShieldOff, UserCog, UserMinus, UserPlus, UserRoundCheck,
  UserRoundX, UsersRound, X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import { SignOut } from "@/components/sign-out";
import { Brand } from "@/components/ui/brand";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Alert, Badge, Skeleton, Spinner } from "@/components/ui/feedback";
import { FormMessage, PasswordField, TextField } from "@/components/ui/form";
import { ActionMenu, type MenuAction } from "@/components/ui/menu";
import { ease } from "@/components/ui/motion";
import { buttonClass, cardClass, cn, inputClass } from "@/components/ui/styles";
import { Avatar, UserMenu } from "@/components/user-menu";
import { adminRequest } from "@/lib/admin-api";
import type { Identity } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

type Section = "users" | "vacancies" | "assignments" | "applications";
type Row = { id: number; email?: string; title?: string; roles?: string[]; is_admin?: boolean; is_active?: boolean; user_id?: number; candidate_user_id?: number; vacancy_id?: number; vacancy_title?: string; created_at?: string; deleted_at?: string | null };
type Page = { items: Row[]; total: number };
type Mode = "user" | "password" | "roles" | "vacancy" | "edit-vacancy" | "assignment" | "application";
type FormState = { mode: Mode; row?: Row };
const sections: Section[] = ["users", "vacancies", "assignments", "applications"];
const labels: Record<Section, string> = { users: "Team & accounts", vacancies: "Vacancies", assignments: "Staff assignments", applications: "Applications" };
const descriptions: Record<Section, string> = {
  users: "Create accounts and control roles, administrator access and account status.",
  vacancies: "Create the vacancy records used to organise access. Full job descriptions come later.",
  assignments: "Choose which vacancies each staff member can access.",
  applications: "Link a candidate to a vacancy. Resume and DISC uploads come in later steps.",
};
const icons: Record<Section, ReactNode> = { users: <UsersRound />, vacancies: <BriefcaseBusiness />, assignments: <Link2 />, applications: <FileStack /> };
const selectClass = cn(inputClass, "select-chevron h-11 appearance-none pr-10");
const fieldLabel = "mb-1.5 block text-sm font-medium text-slate-700";

function splitDate(value?: string | null) {
  if (!value) return { date: "—", time: "" };
  const [date, time] = value.split(" ");
  return { date, time: time ?? "" };
}

function RecordPicker({ name, label, resource, kind }: { name: string; label: string; resource: "users" | "vacancies"; kind?: string }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const statusId = useId();
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query, limit: "20", ...(kind ? { kind } : {}) });
      adminRequest<Page>(`/admin/${resource}?${params}`).then(data => {
        if (current) { setOptions(data.items.filter(row => row.is_active !== false)); setError(""); }
      }).catch(error => { if (current) setError(error instanceof Error ? error.message : "Unable to load options."); })
        .finally(() => { if (current) setLoading(false); });
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [query, resource, kind]);
  return <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
    <legend className="sr-only">{label}</legend>
    <label className={fieldLabel} htmlFor={`${name}-search`}>{label}</label>
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input id={`${name}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={resource === "users" ? "Search by email…" : "Search vacancy title…"} aria-describedby={statusId} className={cn(inputClass, "h-11 pl-10")} />
    </div>
    <select aria-label={`Select ${label.toLowerCase()}`} name={name} required defaultValue="" className={cn(selectClass, "mt-2")}><option value="">Choose {label.toLowerCase()}</option>{options.map(row => <option key={row.id} value={row.id}>#{row.id} · {row.email ?? row.title}</option>)}</select>
    <p id={statusId} aria-live="polite" className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">{loading ? <><Spinner className="size-3" />Searching…</> : error ? <span className="text-red-700">{error}</span> : `${options.length} ${options.length === 1 ? "match" : "matches"}${options.length === 20 ? " (showing first 20)" : ""}`}</p>
  </fieldset>;
}

function ManagementForm({ open, state, onClose, onSave }: { open: boolean; state: FormState; onClose: () => void; onSave: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("hr");
  const [confirm, confirmDialog] = useConfirm();
  const titles: Record<Mode, string> = { user: "Create account", password: "Set password", roles: "Manage roles", vacancy: "Create vacancy", "edit-vacancy": "Edit vacancy", assignment: "Assign staff to vacancy", application: "Create application" };
  const dialogIcons: Record<Mode, ReactNode> = { user: <UserPlus />, password: <KeyRound />, roles: <UserCog />, vacancy: <BriefcaseBusiness />, "edit-vacancy": <Pencil />, assignment: <Link2 />, application: <FileStack /> };
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? "");
    setError("");
    if (["user", "password"].includes(state.mode) && value("password") !== value("confirm")) { setError("The passwords do not match."); return; }
    if (values.get("is_admin") && !(await confirm({ title: "Grant administrator access?", message: "Grant administrator access to this new account?", confirmLabel: "Grant access", icon: <ShieldCheck /> }))) return;
    setPending(true);
    try {
      switch (state.mode) {
        case "user": await adminRequest("/admin/users", "POST", { email: value("email"), password: value("password"), role: value("role"), is_admin: values.get("is_admin") === "on" }); break;
        case "password": await adminRequest(`/admin/users/${state.row!.id}/password`, "PUT", { password: value("password") }); break;
        case "roles":
          if (value("operation") === "grant") await adminRequest(`/admin/users/${state.row!.id}/roles`, "POST", { role: value("role") });
          else await adminRequest(`/admin/users/${state.row!.id}/roles/${value("role")}`, "DELETE");
          break;
        case "vacancy": await adminRequest("/admin/vacancies", "POST", { title: value("title") }); break;
        case "edit-vacancy": await adminRequest(`/admin/vacancies/${state.row!.id}`, "PATCH", { title: value("title") }); break;
        case "assignment": await adminRequest("/admin/assignments", "POST", { user_id: Number(value("user_id")), vacancy_id: Number(value("vacancy_id")) }); break;
        case "application": await adminRequest("/admin/applications", "POST", { candidate_user_id: Number(value("candidate_user_id")), vacancy_id: Number(value("vacancy_id")) }); break;
      }
      onSave();
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save changes."); }
    finally { setPending(false); }
  }

  return <>
    <Dialog open={open} onClose={onClose} dismissible={!pending} title={titles[state.mode]} description={state.row?.email} icon={dialogIcons[state.mode]}>
      <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
        {state.mode === "user" && <>
          <TextField name="email" type="email" label="Email" icon={<Mail />} required maxLength={254} autoComplete="off" />
          <label className="block"><span className={fieldLabel}>Role</span><select name="role" value={role} onChange={event => setRole(event.target.value)} className={selectClass}><option value="hr">HR</option><option value="hiring_manager">Hiring manager</option><option value="candidate">Candidate</option></select></label>
          <AnimatePresence initial={false}>{role !== "candidate" && <motion.label key="admin" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="block overflow-hidden">
            <span className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5 text-sm">
              <input name="is_admin" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-600" />
              <span><span className="font-medium text-slate-800">Grant administrator access</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Administrators can manage every account, vacancy and assignment.</span></span>
            </span>
          </motion.label>}</AnimatePresence>
        </>}
        {["user", "password"].includes(state.mode) && <>
          <PasswordField name="password" label="Password" icon={<KeyRound />} required minLength={6} maxLength={128} autoComplete="new-password" showRequirement />
          <p className="-mt-2 text-xs text-slate-500">Existing sessions are revoked when a password is changed.</p>
          <PasswordField name="confirm" label="Confirm password" icon={<KeyRound />} required minLength={6} maxLength={128} autoComplete="new-password" />
        </>}
        {state.mode === "roles" && <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Current roles</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{state.row?.roles?.length ? state.row.roles.map(r => <Badge key={r} tone="brand">{roleLabel(r)}</Badge>) : <span>None</span>}</div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Candidate and staff roles use separate accounts.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={fieldLabel}>Action</span><select name="operation" className={selectClass}><option value="grant">Grant role</option><option value="revoke">Revoke role</option></select></label>
            <label className="block"><span className={fieldLabel}>Role</span><select name="role" className={selectClass}><option value="hr">HR</option><option value="hiring_manager">Hiring manager</option><option value="candidate">Candidate</option></select></label>
          </div>
        </>}
        {["vacancy", "edit-vacancy"].includes(state.mode) && <TextField name="title" label="Vacancy title" icon={<BriefcaseBusiness />} required maxLength={200} defaultValue={state.row?.title ?? ""} hint="An access record only. Full job descriptions will be added later." />}
        {state.mode === "assignment" && <RecordPicker name="user_id" label="Staff member" resource="users" kind="staff" />}
        {state.mode === "application" && <RecordPicker name="candidate_user_id" label="Candidate" resource="users" kind="candidate" />}
        {["assignment", "application"].includes(state.mode) && <RecordPicker name="vacancy_id" label="Vacancy" resource="vacancies" />}
        <FormMessage message={error} />
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button disabled={pending} type="button" onClick={onClose} className={buttonClass({ variant: "secondary" })}>Cancel</button>
          <button disabled={pending} aria-busy={pending} className={buttonClass()}>{pending ? <><Spinner />Saving…</> : <><CheckCircle2 aria-hidden />Save changes</>}</button>
        </div>
      </form>
    </Dialog>
    {confirmDialog}
  </>;
}

function StatusBadge({ row }: { row: Row }) {
  return row.deleted_at ? <Badge tone="neutral" dot>Archived</Badge> : row.is_active === false ? <Badge tone="warning" dot>Disabled</Badge> : <Badge tone="success" dot>Active</Badge>;
}

function RecordSummary({ row, section }: { row: Row; section: Section }) {
  return <div className="flex min-w-0 flex-1 items-start gap-3">
    {section === "users" && row.email ? <Avatar email={row.email} size="sm" className="mt-0.5 ring-0" /> : <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:size-4">{section === "vacancies" ? <BriefcaseBusiness /> : section === "assignments" ? <UserRoundCheck /> : <FileStack />}</span>}
    <div className="min-w-0">
      <p className="font-medium text-slate-900 [overflow-wrap:anywhere]">{row.email ?? row.title}</p>
      {row.vacancy_title && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><BriefcaseBusiness aria-hidden className="size-3.5 shrink-0" /><span className="break-words">#{row.vacancy_id} · {row.vacancy_title}</span></p>}
      {row.roles && <div className="mt-1.5 flex flex-wrap gap-1">{row.roles.map(role => <Badge key={role} tone="neutral" className="text-[0.7rem]">{roleLabel(role)}</Badge>)}{row.is_admin && <Badge tone="brand" className="text-[0.7rem]"><ShieldCheck aria-hidden className="size-3" />administrator</Badge>}</div>}
    </div>
  </div>;
}

export function AdminConsole({ user }: { user: Identity }) {
  const loadVersion = useRef(0);
  const [section, setSection] = useState<Section>("users");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Partial<Record<Section, number>>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<{ id: number; open: boolean; state?: FormState }>({ id: 0, open: false });
  const [confirm, confirmDialog] = useConfirm();
  const setForm = (state: FormState) => setDialog(current => ({ id: current.id + 1, open: true, state }));

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "25", offset: String(page * 25), include_archived: String(archived), ...(["users", "vacancies"].includes(section) ? { q: query } : {}) });
      const [data, counts] = await Promise.all([adminRequest<Page>(`/admin/${section}?${params}`), adminRequest<Partial<Record<Section, number>>>("/admin/summary")]);
      if (version !== loadVersion.current) return;
      setRows(data.items); setTotal(data.total); setSummary(counts);
      if (page > 0 && page * 25 >= data.total) setPage(Math.max(0, Math.ceil(data.total / 25) - 1));
    } catch (error) { if (version === loadVersion.current) setError(error instanceof Error ? error.message : "Unable to load records."); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [section, page, query, archived]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 180); return () => clearTimeout(timer); }, [load]);

  // Success toast dismisses itself.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function selectSection(next: Section) {
    if (next === section) { void load(); return; }
    loadVersion.current++;
    setRows([]); setLoading(true); setSection(next); setPage(0); setQuery(""); setNotice("");
  }

  async function change(message: string, path: string, method: string, body?: unknown, options: { title: string; confirmLabel: string; tone?: "danger"; icon: ReactNode } = { title: "Confirm change", confirmLabel: "Confirm", icon: <CheckCircle2 /> }) {
    if (!(await confirm({ ...options, message }))) return;
    setBusy(true); setError(""); setNotice("");
    try { await adminRequest(path, method, body); setNotice("Changes saved."); await load(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save changes."); }
    finally { setBusy(false); }
  }
  const createMode: Record<Section, Mode> = { users: "user", vacancies: "vacancy", assignments: "assignment", applications: "application" };
  const createLabel: Record<Section, string> = { users: "Create account", vacancies: "Create vacancy", assignments: "Assign staff", applications: "Create application" };

  const archiveMessage = (row: Row) => section === "users" ? `Archive ${row.email}? Its sessions and related access will be revoked; stored rows are retained.` : section === "vacancies" ? `Archive ${row.title}? Linked assignments and applications will also be archived.` : section === "assignments" ? "Remove this staff member's vacancy access? The assignment record will be retained." : "Archive this application? Its stored record will be retained.";
  const archive = (row: Row) => void change(archiveMessage(row), `/admin/${section}/${row.id}`, "DELETE", undefined, { title: section === "assignments" ? "Remove access?" : "Archive record?", confirmLabel: section === "assignments" ? "Remove access" : "Archive", tone: "danger", icon: section === "assignments" ? <UserMinus /> : <Archive /> });

  function rowActions(row: Row): MenuAction[] {
    if (section === "users") return [
      { label: "Roles", icon: <UserCog />, onSelect: () => setForm({ mode: "roles", row }) },
      { label: "Password", icon: <KeyRound />, onSelect: () => setForm({ mode: "password", row }) },
      { label: row.is_active ? "Disable" : "Enable", icon: row.is_active ? <UserRoundX /> : <UserRoundCheck />, onSelect: () => void change(`${row.is_active ? "Disable" : "Enable"} ${row.email}? Disabling revokes existing sessions.`, `/admin/users/${row.id}/status`, "PATCH", { enabled: !row.is_active }, { title: row.is_active ? "Disable account?" : "Enable account?", confirmLabel: row.is_active ? "Disable" : "Enable", tone: row.is_active ? "danger" : undefined, icon: row.is_active ? <UserRoundX /> : <UserRoundCheck /> }) },
      ...(!row.roles?.includes("candidate") ? [{ label: row.is_admin ? "Remove admin" : "Make admin", icon: row.is_admin ? <ShieldOff /> : <ShieldCheck />, onSelect: () => void change(`${row.is_admin ? "Remove" : "Grant"} administrator access for ${row.email}?`, `/admin/users/${row.id}/administrator`, "PUT", { enabled: !row.is_admin }, { title: row.is_admin ? "Remove administrator access?" : "Grant administrator access?", confirmLabel: row.is_admin ? "Remove admin" : "Make admin", tone: row.is_admin ? "danger" : undefined, icon: row.is_admin ? <ShieldOff /> : <ShieldCheck /> }) }] : []),
      { label: "Archive", icon: <Archive />, tone: "danger", separatorBefore: true, onSelect: () => archive(row) },
    ];
    if (section === "vacancies") return [
      { label: "Edit", icon: <Pencil />, onSelect: () => setForm({ mode: "edit-vacancy", row }) },
      { label: "Archive", icon: <Archive />, tone: "danger", separatorBefore: true, onSelect: () => archive(row) },
    ];
    return [];
  }

  function renderActions(row: Row) {
    if (row.deleted_at) return <span className="text-xs text-slate-400">—</span>;
    const disabled = busy || loading;
    if (section === "assignments" || section === "applications") return <button className={buttonClass({ variant: "secondary", size: "sm", className: "text-red-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700" })} disabled={disabled} onClick={() => archive(row)}>{section === "assignments" ? <><UserMinus aria-hidden />Remove access</> : <><Archive aria-hidden />Archive</>}</button>;
    return <ActionMenu label={`Actions for ${row.email ?? row.title}`} actions={rowActions(row)} disabled={disabled} />;
  }

  const searchable = ["users", "vacancies"].includes(section);
  const pageCount = Math.max(1, Math.ceil(total / 25));
  const filtered = Boolean(query) || archived;

  const navButton = (item: Section, variant: "side" | "tab") => <button
    disabled={busy}
    key={item}
    onClick={() => selectSection(item)}
    aria-current={section === item ? "page" : undefined}
    className={cn("relative flex items-center gap-3 text-left text-sm font-medium transition disabled:opacity-60 [&_svg]:size-[18px]",
      variant === "side" ? "w-full rounded-xl px-3 py-2.5" : "shrink-0 rounded-lg px-3 py-2",
      section === item ? "text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}
  >
    {section === item && <motion.span layoutId={`admin-nav-${variant}`} transition={{ type: "spring", stiffness: 500, damping: 38 }} className={cn("absolute inset-0 bg-brand-50 ring-1 ring-brand-100", variant === "side" ? "rounded-xl" : "rounded-lg")} />}
    <span className={cn("relative", section === item ? "text-brand-600" : "text-slate-400")}>{icons[item]}</span>
    <span className="relative flex-1">{labels[item]}</span>
    <span className={cn("relative rounded-md px-1.5 py-0.5 text-xs tabular-nums", section === item ? "bg-white text-brand-700" : "bg-slate-100 text-slate-500")}>{summary[item] ?? "—"}</span>
  </button>;

  return <div className="page-glow min-h-dvh text-slate-900 lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
    {/* Desktop sidebar */}
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200/70 bg-white/90 px-4 py-6 backdrop-blur lg:flex">
      <Link href="/staff" className="mx-2 w-fit rounded-xl"><Brand caption="Administration" /></Link>
      <p className="mx-3 mt-9 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Manage</p>
      <nav aria-label="Administration sections" className="mt-3 grid gap-1">{sections.map(item => navButton(item, "side"))}</nav>
      <div className="mt-auto grid gap-3">
        <Link href="/staff" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"><ArrowLeft aria-hidden className="size-4" />Staff workspace</Link>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
          <div className="flex items-center gap-3"><Avatar email={user.email} /><div className="min-w-0"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-brand-600">Administrator</p><p className="truncate text-sm font-medium text-slate-800" title={user.email}>{user.email}</p></div></div>
          <SignOut variant="secondary" block className="mt-3" />
        </div>
      </div>
    </aside>

    <div className="min-w-0">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link href="/staff" className="rounded-xl lg:hidden"><Brand caption="Administration" /></Link>
          <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-sm lg:flex"><span className="text-slate-400">Administration</span><ChevronRight aria-hidden className="size-4 text-slate-300" /><span aria-current="page" className="font-medium text-slate-800">{labels[section]}</span></nav>
          <UserMenu user={user} links={[{ href: "/staff", label: "Staff workspace", icon: <LayoutDashboard /> }]} />
        </div>
        <nav aria-label="Administration sections" className="scrollbar-none flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">{sections.map(item => navButton(item, "tab"))}</nav>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease }} className="min-w-0 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Administrator</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels[section]}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{descriptions[section]}</p>
            </motion.div>
          </AnimatePresence>
          <button disabled={busy} onClick={() => setForm({ mode: createMode[section] })} className={buttonClass({ size: "lg", className: "w-full sm:w-auto" })}><Plus aria-hidden />{createLabel[section]}</button>
        </div>

        <ul aria-label="Record counts" className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {sections.map((item, index) => <motion.li key={item} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: 0.05 * index }}>
            <button disabled={busy} onClick={() => selectSection(item)} aria-pressed={section === item} className={cn(cardClass, "group relative h-full w-full overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.99] disabled:opacity-60 sm:p-5", section === item && "border-brand-200 ring-2 ring-brand-100")}>
              <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">{labels[item]}</span><span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg transition group-hover:scale-110 [&_svg]:size-4", section === item ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600")}>{icons[item]}</span></div>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{summary[item] ?? <Skeleton className="h-9 w-14" />}</p>
              <p className="mt-1 text-xs text-slate-400">Current records</p>
            </button>
          </motion.li>)}
        </ul>

        <AnimatePresence>{error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <Alert tone="danger" className="mt-6" action={<button onClick={() => void load()} className={buttonClass({ variant: "secondary", size: "sm" })}><RefreshCw aria-hidden />Retry</button>}>{error}</Alert>
        </motion.div>}</AnimatePresence>

        <section aria-label={`${labels[section]} records`} className={cn(cardClass, "relative mt-6 overflow-hidden")}>
          <AnimatePresence>{loading && rows.length > 0 && <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-brand-100"><motion.div className="h-full w-1/3 rounded-full bg-brand-500" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} /></motion.div>}</AnimatePresence>

          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            {searchable ? <div className="relative w-full sm:max-w-xs">
              <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input type="search" disabled={busy} aria-label="Search records" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder={section === "users" ? "Search email…" : "Search vacancy title…"} className={cn(inputClass, "h-10 bg-slate-50 pl-10 pr-9 text-sm [&::-webkit-search-cancel-button]:hidden")} />
              {query && <button type="button" onClick={() => { setQuery(""); setPage(0); }} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"><X aria-hidden className="size-3.5" /></button>}
            </div> : <p className="text-sm font-medium text-slate-700">{labels[section]}</p>}
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-600">
                <input disabled={busy} type="checkbox" role="switch" aria-checked={archived} checked={archived} onChange={event => { setArchived(event.target.checked); setPage(0); }} className="peer sr-only" />
                <span aria-hidden className="relative h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                Include archived
              </label>
              <button type="button" onClick={() => void load()} disabled={busy || loading} aria-label="Refresh records" className={buttonClass({ variant: "ghost", size: "sm", className: "size-8 px-0" })}><RefreshCw aria-hidden className={cn(loading && "motion-safe:animate-spin")} /></button>
            </div>
          </div>

          {loading && !rows.length ? <div role="status" aria-live="polite" className="divide-y divide-slate-100">
            <span className="sr-only">Loading records…</span>
            {[0, 1, 2, 3, 4].map(i => <div key={i} aria-hidden className="flex items-center gap-4 px-5 py-4"><Skeleton className="size-8 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="hidden h-6 w-16 rounded-full sm:block" /><Skeleton className="hidden h-3.5 w-24 md:block" /></div>)}
          </div> : !rows.length ? <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="px-6 py-16 text-center">
            <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 [&_svg]:size-6">{icons[section]}</span>
            <p className="mt-5 font-medium text-slate-700">No records found</p>
            <p className="mt-2 text-sm text-slate-500">Create a record or adjust your filters.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {filtered && <button disabled={busy} onClick={() => { setQuery(""); setArchived(false); setPage(0); }} className={buttonClass({ variant: "secondary" })}><X aria-hidden />Clear filters</button>}
              <button disabled={busy} onClick={() => setForm({ mode: createMode[section] })} className={buttonClass({ variant: "soft" })}><Plus aria-hidden />{createLabel[section]}</button>
            </div>
          </motion.div> : <motion.div key={`${section}-${page}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className={cn("transition-opacity", loading && "opacity-60")}>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">{labels[section]}</caption>
                <thead className="bg-slate-50/80 text-[0.7rem] uppercase tracking-wider text-slate-500"><tr><th scope="col" className="px-5 py-3 font-semibold">ID</th><th scope="col" className="px-5 py-3 font-semibold">{section === "users" ? "Account" : section === "vacancies" ? "Vacancy" : "Person & vacancy"}</th><th scope="col" className="px-5 py-3 font-semibold">Status</th><th scope="col" className="px-5 py-3 font-semibold">Created</th><th scope="col" className="px-5 py-3 text-right font-semibold"><span className="sr-only">Actions</span><span aria-hidden>Actions</span></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const created = splitDate(row.created_at);
                    return <motion.tr key={row.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: Math.min(index, 12) * 0.025 }} className={cn("align-middle transition-colors hover:bg-brand-50/30", row.deleted_at && "bg-slate-50/50")}>
                      <td className="px-5 py-4 font-mono text-xs text-slate-400">#{row.id}</td>
                      <td className="px-5 py-4"><RecordSummary row={row} section={section} /></td>
                      <td className="px-5 py-4"><StatusBadge row={row} />{row.deleted_at && <p className="mt-1.5 whitespace-nowrap text-[0.7rem] text-slate-400">{row.deleted_at}</p>}</td>
                      <td className="whitespace-nowrap px-5 py-4"><p className="text-sm text-slate-700">{created.date}</p><p className="text-xs text-slate-400">{created.time}</p></td>
                      <td className="px-5 py-4"><div className="flex justify-end">{renderActions(row)}</div></td>
                    </motion.tr>;
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((row, index) => <motion.li key={row.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: Math.min(index, 12) * 0.03 }} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3"><RecordSummary row={row} section={section} />{renderActions(row)}</div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-11 text-xs text-slate-500"><StatusBadge row={row} /><span className="font-mono text-slate-400">#{row.id}</span><span>Created {row.created_at ?? "—"}</span>{row.deleted_at && <span>Archived {row.deleted_at}</span>}</div>
              </motion.li>)}
            </ul>
          </motion.div>}

          <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p aria-live="polite">{total ? `${page * 25 + 1}–${Math.min((page + 1) * 25, total)} of ${total}` : "0 records"}<span className="text-slate-400"> · Page {page + 1} of {pageCount}</span></p>
            <div className="flex gap-2">
              <button className={buttonClass({ variant: "secondary", size: "sm", className: "flex-1 sm:flex-none" })} disabled={busy || loading || page === 0} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden />Previous</button>
              <button className={buttonClass({ variant: "secondary", size: "sm", className: "flex-1 sm:flex-none" })} disabled={busy || loading || (page + 1) * 25 >= total} onClick={() => setPage(page + 1)}>Next<ChevronRight aria-hidden /></button>
            </div>
          </nav>
        </section>
        <p className="mt-4 text-xs text-slate-400">Times shown in Malaysia time (UTC+08:00). Archived records remain stored.</p>
      </main>
    </div>

    {/* Success toast: the live region is always mounted so announcements are reliable. */}
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6">
      <AnimatePresence>{notice && <motion.div key={notice} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-slate-900 py-3 pl-4 pr-2 text-sm font-medium text-white shadow-2xl">
        <CheckCircle2 aria-hidden className="size-[18px] text-emerald-400" />{notice}
        <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification" className="grid size-7 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"><X aria-hidden className="size-4" /></button>
      </motion.div>}</AnimatePresence>
    </div>

    {dialog.state && <ManagementForm key={dialog.id} open={dialog.open} state={dialog.state} onClose={() => setDialog(current => ({ ...current, open: false }))} onSave={() => { setNotice("Changes saved."); void load(); }} />}
    {confirmDialog}
  </div>;
}
