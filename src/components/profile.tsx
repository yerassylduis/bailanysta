"use client";

import { useState } from "react";
import { CalendarDays, Pencil, LogOut, Check, X, MessageCircle, Camera, ImagePlus, Trash2 } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { useQueryClient } from "@tanstack/react-query";
import { useLogout, useMe, useProfile, keys } from "@/hooks/use-data";
import { api } from "@/lib/api-client";
import { Avatar, COVER_GRADIENTS, EmptyState, Skeleton, coverStyle } from "./ui";
import { FollowButton } from "./follow-button";
import { Feed } from "./feed";
import { PostEditor } from "./post-editor";
import { useToast } from "./toast";
import { cn, fmtDate } from "@/lib/format";
import { useT } from "./locale-provider";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

/** Страница профиля: шапка со статистикой, редактирование (своего), редактор, посты автора. */
export function Profile({ handle }: { handle: string }) {
  const q = useProfile(handle);
  const { data: meData } = useMe();
  const logout = useLogout();
  const qc = useQueryClient();
  const toast = useToast();
  const { t, locale } = useT();
  const [edit, setEdit] = useState(false);
  const [list, setList] = useState<"followers" | "following" | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarUp = useUpload({ images: 1, videos: 0 }, { maxSide: 512 });
  const coverUp = useUpload({ images: 1, videos: 0 }, { maxSide: 1600 });

  /** Применяем изменение внешности сразу, не дожидаясь «Сохранить». */
  const applyLook = async (patch: Parameters<typeof api.updateProfile>[0], ok: string) => {
    try {
      await api.updateProfile(patch);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.profile(handle) }), qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: ["posts"] }), qc.invalidateQueries({ queryKey: keys.graph })]);
      toast(ok, "success");
    } catch (e) { toast(e instanceof Error ? e.message : t("profile.error"), "error"); }
  };
  const pickAvatar = async (files: FileList) => {
    avatarUp.reset();
    const [m] = await avatarUp.add(files);
    if (m) await applyLook({ avatarMediaId: m.id }, t("profile.avatarUpdated"));
    else toast(avatarUp.items[0]?.error ?? t("profile.uploadFailed"), "error");
    avatarUp.reset();
  };
  const pickCover = async (files: FileList) => {
    coverUp.reset();
    const [m] = await coverUp.add(files);
    if (m) await applyLook({ coverMediaId: m.id }, t("profile.coverUpdated"));
    else toast(t("profile.coverUploadFailed"), "error");
    coverUp.reset();
  };

  if (q.isPending) return <ProfileSkeleton />;
  if (q.isError) return <EmptyState title={t("profile.notFoundTitle")} text={t("profile.notFoundText", { handle })} action={<Link href="/" className="btn btn-outline">{t("profile.toFeed")}</Link>} />;
  const p = q.data;
  const own = meData?.user?.id === p.id;

  const startEdit = () => { setName(p.name); setBio(p.bio); setPhone(meData?.user?.phone ?? ""); setEmail(meData?.user?.email ?? ""); setBirthday(meData?.user?.birthday ?? ""); setEdit(true); };
  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ name: name.trim() || p.name, bio: bio.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}), ...(email.trim() ? { email: email.trim() } : {}), ...(birthday ? { birthday } : {}) });
      await Promise.all([qc.invalidateQueries({ queryKey: keys.profile(handle) }), qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: ["posts"] })]);
      setEdit(false); toast(t("profile.updated"), "success");
    } catch (e) { toast(e instanceof Error ? e.message : t("profile.error"), "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <section className="card fade-in relative overflow-hidden">
        <div className="relative h-32 w-full sm:h-40" style={coverStyle(p.cover, p.hue)}>
          {edit && (
            <div className="absolute right-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2">
              <div className="flex gap-1.5 rounded-full bg-black/35 p-1 backdrop-blur">
                {COVER_GRADIENTS.map((g, i) => (
                  <button key={i} onClick={() => applyLook({ coverPreset: i }, t("profile.coverUpdated"))} title={t("profile.coverN", { n: i + 1 })}
                    className={cn("h-6 w-6 rounded-full ring-2 ring-white/70 transition hover:scale-110", p.cover === `preset:${i}` && "ring-white scale-110")} style={{ background: g }} />
                ))}
              </div>
              <label className="btn cursor-pointer bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/60">
                <ImagePlus size={14} /> {coverUp.uploading ? t("common.loading") : t("profile.ownImage")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.length) pickCover(e.target.files); e.target.value = ""; }} />
              </label>
              {p.cover && <button onClick={() => applyLook({ coverPreset: null }, t("profile.coverReset"))} className="btn bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/60"><Trash2 size={14} /> {t("profile.reset")}</button>}
            </div>
          )}
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <div className="relative">
              <Avatar user={p} size={84} className="ring-4 ring-elev" />
              {edit && (
                <>
                  <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-ink shadow-card transition hover:brightness-110" title={t("profile.changeAvatar")}>
                    {avatarUp.uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera size={15} />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.length) pickAvatar(e.target.files); e.target.value = ""; }} />
                  </label>
                  {p.avatarUrl && <button onClick={() => applyLook({ avatarMediaId: null }, t("profile.avatarRemoved"))} className="absolute -left-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-elev text-rose shadow-card" title={t("profile.removeAvatar")}><X size={13} /></button>}
                </>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 pb-1">
              {own ? (
                <>
                  <button onClick={edit ? () => setEdit(false) : startEdit} className="btn btn-outline">{edit ? <><X size={16} /> {t("common.cancel")}</> : <><Pencil size={16} /> {t("profile.editBtn")}</>}</button>
                  <button onClick={() => logout.mutate()} className="btn btn-ghost" title={t("profile.logout")}><LogOut size={16} /></button>
                </>
              ) : (
                <>
                  {meData?.user && <Link href={`/messages/${p.handle}`} className="btn btn-outline btn-icon" aria-label={t("profile.writeMessage")} title={t("nav.compose")}><MessageCircle size={18} /></Link>}
                  <FollowButton handle={p.handle} following={p.viewerFollows} />
                </>
              )}
            </div>
          </div>

          {edit ? (
            <div className="mt-4 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="input font-semibold" maxLength={60} placeholder={t("common.name")} />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input resize-none" rows={2} maxLength={200} placeholder={t("profile.bioPlaceholder")} />
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{t("profile.phone")}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+7 701 000 00 00" inputMode="tel" /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{t("profile.email")}</span><input value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@mail.kz" inputMode="email" /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{t("profile.birthday")}</span><input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="input" /></label>
              </div>
              <p className="text-[11px] text-muted">{t("profile.contactsHint")}</p>
              <div className="flex justify-end"><button onClick={save} disabled={saving} className="btn btn-primary"><Check size={16} /> {t("common.save")}</button></div>
            </div>
          ) : (
            <div className="mt-3">
              <h1 className="font-display text-2xl font-bold leading-tight">{p.name}</h1>
              <p className="text-sm text-muted">@{p.handle}</p>
              {p.bio && <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed">{p.bio}</p>}
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={13} /> {t("profile.withUsSince", { date: fmtDate(p.createdAt, locale, { month: "long", year: "numeric" }) })}</p>
            </div>
          )}

          <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center sm:max-w-md sm:text-left">
            {([
              ["posts", p.stats.posts, t("profile.statPosts", { count: p.stats.posts })],
              ["followers", p.stats.followers, t("profile.statFollowers", { count: p.stats.followers })],
              ["following", p.stats.following, t("profile.statFollowing")],
              ["likes", p.stats.likesReceived, t("profile.statLikes", { count: p.stats.likesReceived })],
            ] as const).map(([id, n, l]) => (
              id === "followers" || id === "following"
                ? <button key={id} type="button" onClick={() => setList(id)} className="rounded-xl text-center transition hover:bg-accent-soft sm:text-left sm:px-2 sm:-mx-2" title={t(id === "followers" ? "profile.followersTitle" : "profile.followingTitle")}>
                    <dt className="font-display text-lg font-bold tabular-nums">{n}</dt><dd className="text-[11px] text-muted underline decoration-dotted underline-offset-2">{l}</dd>
                  </button>
                : <div key={id}><dt className="font-display text-lg font-bold tabular-nums">{n}</dt><dd className="text-[11px] text-muted">{l}</dd></div>
            ))}
          </dl>
          {list && <FollowListModal handle={p.handle} kind={list} onClose={() => setList(null)} />}
        </div>
      </section>

      {own && <PostEditor />}

      <h2 className="px-1 font-display text-sm font-bold uppercase tracking-wider text-muted">{t("profile.postsHeading")}</h2>
      <Feed filter={{ author: p.handle }} emptyTitle={own ? t("profile.emptyOwnTitle") : t("profile.emptyTitle")} emptyText={own ? t("profile.emptyOwnText") : t("profile.emptyText")} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="card overflow-hidden"><Skeleton className="h-28 w-full rounded-none!" /><div className="px-6 pb-6"><Skeleton className="-mt-10 h-[84px] w-[84px] rounded-full!" /><Skeleton className="mt-4 h-6 w-48" /><Skeleton className="mt-2 h-3 w-24" /><Skeleton className="mt-4 h-3 w-80" /></div></div>
      <Skeleton className="h-40 w-full rounded-2xl!" />
    </div>
  );
}

/** Всплывающий список подписчиков / подписок: переход в профиль и кнопка подписки с текущим статусом. */
function FollowListModal({ handle, kind, onClose }: { handle: string; kind: "followers" | "following"; onClose: () => void }) {
  const { t } = useT();
  const { data: meData } = useMe();
  const q = useQuery({ queryKey: ["follow-list", handle, kind], queryFn: () => api.followList(handle, kind), staleTime: 15_000 });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={t(kind === "followers" ? "profile.followersTitle" : "profile.followingTitle")}>
      <div className="card max-h-[80vh] w-full max-w-md overflow-hidden rounded-b-none sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><Users size={18} className="text-accent" /> {t(kind === "followers" ? "profile.followersTitle" : "profile.followingTitle")}{q.data && <span className="text-sm font-semibold text-muted">· {q.data.items.length}</span>}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-icon h-8 w-8" aria-label={t("common.close")}><X size={16} /></button>
        </div>
        <div className="max-h-[calc(80vh-56px)] overflow-y-auto p-2">
          {q.isPending && <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {q.isError && <p className="p-4 text-center text-sm text-rose">{q.error.message}</p>}
          {q.data && q.data.items.length === 0 && <p className="p-6 text-center text-sm text-muted">{t(kind === "followers" ? "profile.emptyFollowers" : "profile.emptyFollowing")}</p>}
          {q.data?.items.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-bg-2">
              <Link href={`/u/${u.handle}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar user={u} size={40} />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-semibold">{u.name}</span>
                  <span className="block truncate text-xs text-muted">@{u.handle} · {t("common.followers", { count: u.followers })}</span>
                </span>
              </Link>
              {meData?.user?.id !== u.id && <FollowButton handle={u.handle} following={u.viewerFollows} className="px-3 py-1.5 text-xs" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
