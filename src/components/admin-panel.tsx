"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Search, UserPlus, Ban, Pencil, Trash2, Check, X, RefreshCw, Users, FileText, MessageCircle, Video, ScrollText } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AdminUserDto } from "@/lib/types";
import { Avatar } from "./ui";
import { useToast } from "./toast";
import { cn, fmtDate, fmtDateTime, timeAgo } from "@/lib/format";
import { useT } from "./locale-provider";

/** Короткая числовая дата (дд.мм.гггг) для таблицы. */
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
import Link from "next/link";

/**
 * Админ-панель: статистика, пользователи (поиск, фильтры, создание, правка, бан, удаление), журнал действий.
 * Всё через /api/admin/*, каждая операция пишется в журнал.
 */
export function AdminPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t, locale } = useT();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "banned" | "admins">("all");
  const [editing, setEditing] = useState<AdminUserDto | null>(null);
  const [banning, setBanning] = useState<AdminUserDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"users" | "log">("users");

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: api.adminStats, refetchInterval: 30_000 });
  const users = useQuery({ queryKey: ["admin-users", q, page, filter], queryFn: () => api.adminUsers(q, page, filter), placeholderData: (prev) => prev });
  const log = useQuery({ queryKey: ["admin-log"], queryFn: api.adminLog, enabled: tab === "log" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); qc.invalidateQueries({ queryKey: ["admin-log"] }); };

  const del = useMutation({ mutationFn: (id: string) => api.adminDeleteUser(id), onSuccess: () => { toast(t("admin.toastDeleted"), "success"); refresh(); }, onError: (e) => toast(e.message, "error") });
  const unban = useMutation({ mutationFn: (id: string) => api.adminUnban(id), onSuccess: () => { toast(t("admin.toastUnbanned"), "success"); refresh(); }, onError: (e) => toast(e.message, "error") });

  const total = users.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (users.data?.pageSize ?? 25)));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent"><ShieldCheck size={14} /> {t("admin.kicker")}</p>
          <h1 className="font-display text-2xl font-bold">{t("admin.title")}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="btn btn-outline btn-icon" title={t("admin.refresh")}><RefreshCw size={16} /></button>
          <button onClick={() => setCreating(true)} className="btn btn-primary"><UserPlus size={16} /> {t("admin.addUser")}</button>
        </div>
      </header>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: <Users size={16} />, label: t("admin.statUsers"), value: stats.data?.users, sub: t("admin.todayPlus", { n: stats.data?.today.users ?? 0 }) },
          { icon: <Ban size={16} className="text-rose" />, label: t("admin.statBanned"), value: stats.data?.banned },
          { icon: <FileText size={16} />, label: t("admin.statPosts"), value: stats.data?.posts, sub: t("admin.todayPlus", { n: stats.data?.today.posts ?? 0 }) },
          { icon: <MessageCircle size={16} />, label: t("admin.statComments"), value: stats.data?.comments },
          { icon: <MessageCircle size={16} />, label: t("admin.statMessages"), value: stats.data?.messages },
          { icon: <Video size={16} />, label: t("admin.statCalls"), value: stats.data?.calls },
        ].map((s) => (
          <div key={s.label} className="card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">{s.icon} {s.label}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">{s.value ?? "—"}</div>
            {s.sub && <div className="text-[11px] text-muted">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="seg w-fit">
        <button onClick={() => setTab("users")} className={cn(tab === "users" && "seg-on")}>{t("admin.tabUsers")}</button>
        <button onClick={() => setTab("log")} className={cn("flex items-center gap-1.5", tab === "log" && "seg-on")}><ScrollText size={14} /> {t("admin.tabLog")}</button>
      </div>

      {tab === "users" && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("admin.searchPlaceholder")} className="input py-2 pl-9 text-sm" />
            </div>
            <div className="seg">
              {(["all", "banned", "admins"] as const).map((f) => <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={cn(filter === f && "seg-on")}>{f === "all" ? t("common.all") : f === "banned" ? t("admin.filterBanned") : t("admin.filterAdmins")}</button>)}
            </div>
            <span className="ml-auto text-xs text-muted">{t("admin.accounts", { count: total })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-2/60 text-left text-[11px] uppercase tracking-wider text-muted">
                <tr><th className="px-3 py-2">{t("admin.colUser")}</th><th className="px-3 py-2">{t("admin.colContacts")}</th><th className="px-3 py-2">{t("admin.colRole")}</th><th className="px-3 py-2">{t("admin.colActivity")}</th><th className="px-3 py-2">{t("admin.colStatus")}</th><th className="px-3 py-2 text-right">{t("admin.colActions")}</th></tr>
              </thead>
              <tbody>
                {users.isPending && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">{t("common.loading")}</td></tr>}
                {users.data?.items.map((u) => (
                  <tr key={u.id} className={cn("border-t border-line align-top", u.banned && "bg-rose-soft/30")}>
                    <td className="px-3 py-2.5">
                      <Link href={`/u/${u.handle}`} className="flex items-center gap-2.5 hover:underline">
                        <Avatar user={u} size={32} />
                        <span className="leading-tight"><span className="block font-semibold">{u.name}</span><span className="block text-xs text-muted">@{u.handle} · {t("admin.since", { date: fmtDate(u.createdAt, locale, SHORT_DATE) })}</span></span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-2"><div>{u.email ?? <span className="text-muted">{t("admin.noEmail")}</span>}</div><div>{u.phone ?? <span className="text-muted">{t("admin.noPhone")}</span>}</div>{u.birthday && <div className="text-muted">{t("admin.bday", { date: fmtDate(u.birthday, locale, SHORT_DATE) })}</div>}</td>
                    <td className="px-3 py-2.5">{u.isAdmin ? <span className="chip chip-active"><ShieldCheck size={12} /> {t("admin.roleAdmin")}</span> : <span className="chip">{t("admin.roleUser")}</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-2"><div>{t("common.posts", { count: u.stats.posts })} · {t("admin.commentsShort", { count: u.stats.comments })}</div><div>{t("common.followers", { count: u.stats.followers })}</div>{u.lastActivityAt && <div className="text-muted">{t("admin.lastPost", { ago: timeAgo(u.lastActivityAt, locale) })}</div>}</td>
                    <td className="px-3 py-2.5 text-xs">{u.banned ? <span className="chip bg-rose-soft text-rose"><Ban size={12} /> {u.banned.until ? t("admin.bannedUntil", { date: fmtDate(u.banned.until, locale, SHORT_DATE) }) : t("admin.bannedForever")}</span> : <span className="chip text-accent"><Check size={12} /> {t("admin.active")}</span>}{u.banned?.reason && <div className="mt-1 max-w-[180px] text-muted">{u.banned.reason}</div>}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(u)} className="btn btn-ghost btn-icon h-8 w-8" title={t("admin.edit")}><Pencil size={15} /></button>
                        {u.banned ? <button onClick={() => unban.mutate(u.id)} className="btn btn-ghost btn-icon h-8 w-8 text-accent" title={t("admin.unban")}><Check size={15} /></button>
                          : <button onClick={() => setBanning(u)} className="btn btn-ghost btn-icon h-8 w-8 text-saffron" title={t("admin.ban")}><Ban size={15} /></button>}
                        <button onClick={() => { if (confirm(t("admin.confirmDelete", { handle: u.handle }))) del.mutate(u.id); }} className="btn btn-ghost btn-icon h-8 w-8 text-rose" title={t("common.delete")}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.data && !users.data.items.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">{t("admin.nobodyFound")}</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line p-3 text-xs">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline px-3 py-1 text-xs">{t("common.back")}</button>
              <span className="text-muted">{t("admin.pageOf", { page, pages })}</span>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline px-3 py-1 text-xs">{t("admin.next")}</button>
            </div>
          )}
        </section>
      )}

      {tab === "log" && (
        <section className="card p-3">
          <ul className="divide-y divide-line text-sm">
            {log.data?.items.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                <span className="text-xs text-muted">{fmtDateTime(l.createdAt, locale)}</span>
                <span className="font-semibold">{l.admin?.name ?? "—"}</span>
                <span className="chip">{l.action}</span>
                {l.targetId && <span className="font-mono text-xs text-muted">{l.targetId}</span>}
                {l.details && <span className="truncate text-xs text-ink-2">{l.details}</span>}
              </li>
            ))}
            {log.data && !log.data.items.length && <li className="py-6 text-center text-muted">{t("common.nothing")}</li>}
          </ul>
        </section>
      )}

      {editing && <UserDialog user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {creating && <UserDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refresh(); }} />}
      {banning && <BanDialog user={banning} onClose={() => setBanning(null)} onDone={() => { setBanning(null); refresh(); }} />}
    </div>
  );
}

/** Создание или редактирование пользователя. */
function UserDialog({ user, onClose, onSaved }: { user?: AdminUserDto; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { t } = useT();
  const [f, setF] = useState({ handle: user?.handle ?? "", name: user?.name ?? "", bio: user?.bio ?? "", email: user?.email ?? "", phone: user?.phone ?? "", birthday: user?.birthday ?? "", role: (user?.role ?? "user") as "user" | "admin" });
  const save = useMutation({
    mutationFn: () => {
      const body = { handle: f.handle, name: f.name, bio: f.bio, email: f.email || null, phone: f.phone || null, birthday: f.birthday || null, role: f.role };
      return user ? api.adminUpdateUser(user.id, body) : api.adminCreateUser(body);
    },
    onSuccess: () => { toast(user ? t("admin.toastSaved") : t("admin.toastCreated"), "success"); onSaved(); },
    onError: (e) => toast(e.message, "error"),
  });
  // обычная функция-помощник (не компонент): рендерит поле формы
  const field = (k: keyof typeof f, label: string, type = "text", placeholder?: string) => (
    <label key={k} className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <input type={type} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder} className="input py-2 text-sm" /></label>
  );
  return (
    <Modal title={user ? t("admin.editUser", { handle: user.handle }) : t("admin.newUser")} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("handle", t("admin.fHandle"), "text", "latin_123")}{field("name", t("common.name"))}
        {field("email", t("admin.fEmail"), "email")}{field("phone", t("admin.fPhone"), "text", "+7 701 000 00 00")}
        {field("birthday", t("admin.fBirthday"), "date")}
        <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{t("admin.fRole")}</span>
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "user" | "admin" })} className="input py-2 text-sm"><option value="user">{t("admin.roleOptUser")}</option><option value="admin">{t("admin.roleOptAdmin")}</option></select></label>
      </div>
      <label className="mt-3 block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{t("admin.fBio")}</span><textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={2} className="input resize-none py-2 text-sm" maxLength={200} /></label>
      <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="btn btn-ghost">{t("common.cancel")}</button><button onClick={() => save.mutate()} disabled={save.isPending || !f.handle || !f.name} className="btn btn-primary"><Check size={16} /> {user ? t("common.save") : t("common.create")}</button></div>
    </Modal>
  );
}

function BanDialog({ user, onClose, onDone }: { user: AdminUserDto; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { t } = useT();
  const [days, setDays] = useState<number | null>(7);
  const [reason, setReason] = useState("");
  const ban = useMutation({ mutationFn: () => api.adminBan(user.id, days, reason), onSuccess: () => { toast(t("admin.toastBanned", { handle: user.handle }), "success"); onDone(); }, onError: (e) => toast(e.message, "error") });
  const presets: Array<[number | null, string]> = [[1, t("admin.banDays", { count: 1 })], [7, t("admin.banDays", { count: 7 })], [30, t("admin.banDays", { count: 30 })], [365, t("admin.banYear")], [null, t("admin.banForever")]];
  return (
    <Modal title={t("admin.banUser", { handle: user.handle })} onClose={onClose}>
      <p className="text-sm text-ink-2">{t("admin.banText")}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{presets.map(([d, l]) => <button key={l} onClick={() => setDays(d)} className={cn("chip", days === d && "chip-active")}>{l}</button>)}</div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("admin.reasonPlaceholder")} className="input mt-3 resize-none py-2 text-sm" maxLength={200} />
      <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="btn btn-ghost">{t("common.cancel")}</button><button onClick={() => ban.mutate()} disabled={ban.isPending} className="btn bg-rose text-white hover:brightness-110"><Ban size={16} /> {t("admin.ban")}</button></div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="card fade-in w-full max-w-lg rounded-b-none p-5 sm:rounded-b-xl2" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-base font-bold">{title}</h3><button onClick={onClose} className="btn btn-ghost btn-icon h-8 w-8" aria-label={t("common.close")}><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}
