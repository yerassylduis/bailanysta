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
import { cn, plural } from "@/lib/format";
import Link from "next/link";

/** Страница профиля: шапка со статистикой, редактирование (своего), редактор, посты автора. */
export function Profile({ handle }: { handle: string }) {
  const q = useProfile(handle);
  const { data: meData } = useMe();
  const logout = useLogout();
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarUp = useUpload({ images: 1, videos: 0 }, { maxSide: 512 });
  const coverUp = useUpload({ images: 1, videos: 0 }, { maxSide: 1600 });

  /** Применяем изменение внешности сразу, не дожидаясь «Сохранить». */
  const applyLook = async (patch: Parameters<typeof api.updateProfile>[0], ok: string) => {
    try {
      await api.updateProfile(patch);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.profile(handle) }), qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: ["posts"] }), qc.invalidateQueries({ queryKey: keys.graph })]);
      toast(ok, "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "error"); }
  };
  const pickAvatar = async (files: FileList) => {
    avatarUp.reset();
    const [m] = await avatarUp.add(files);
    if (m) await applyLook({ avatarMediaId: m.id }, "Аватар обновлён");
    else toast(avatarUp.items[0]?.error ?? "Не удалось загрузить", "error");
    avatarUp.reset();
  };
  const pickCover = async (files: FileList) => {
    coverUp.reset();
    const [m] = await coverUp.add(files);
    if (m) await applyLook({ coverMediaId: m.id }, "Фон обновлён");
    else toast("Не удалось загрузить фон", "error");
    coverUp.reset();
  };

  if (q.isPending) return <ProfileSkeleton />;
  if (q.isError) return <EmptyState title="Такого человека здесь нет" text={`@${handle} ещё не присоединился к Expert Bailanysta.`} action={<Link href="/" className="btn btn-outline">В ленту</Link>} />;
  const p = q.data;
  const own = meData?.user?.id === p.id;

  const startEdit = () => { setName(p.name); setBio(p.bio); setEdit(true); };
  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ name: name.trim() || p.name, bio: bio.trim() });
      await Promise.all([qc.invalidateQueries({ queryKey: keys.profile(handle) }), qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: ["posts"] })]);
      setEdit(false); toast("Профиль обновлён", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "error"); }
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
                  <button key={i} onClick={() => applyLook({ coverPreset: i }, "Фон обновлён")} title={`Фон ${i + 1}`}
                    className={cn("h-6 w-6 rounded-full ring-2 ring-white/70 transition hover:scale-110", p.cover === `preset:${i}` && "ring-white scale-110")} style={{ background: g }} />
                ))}
              </div>
              <label className="btn cursor-pointer bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/60">
                <ImagePlus size={14} /> {coverUp.uploading ? "Загрузка…" : "Своя картинка"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.length) pickCover(e.target.files); e.target.value = ""; }} />
              </label>
              {p.cover && <button onClick={() => applyLook({ coverPreset: null }, "Фон сброшен")} className="btn bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/60"><Trash2 size={14} /> Сбросить</button>}
            </div>
          )}
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <div className="relative">
              <Avatar user={p} size={84} className="ring-4 ring-elev" />
              {edit && (
                <>
                  <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-ink shadow-card transition hover:brightness-110" title="Сменить аватар">
                    {avatarUp.uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera size={15} />}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.length) pickAvatar(e.target.files); e.target.value = ""; }} />
                  </label>
                  {p.avatarUrl && <button onClick={() => applyLook({ avatarMediaId: null }, "Аватар убран")} className="absolute -left-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-elev text-rose shadow-card" title="Убрать аватар"><X size={13} /></button>}
                </>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 pb-1">
              {own ? (
                <>
                  <button onClick={edit ? () => setEdit(false) : startEdit} className="btn btn-outline">{edit ? <><X size={16} /> Отмена</> : <><Pencil size={16} /> Редактировать</>}</button>
                  <button onClick={() => logout.mutate()} className="btn btn-ghost" title="Выйти"><LogOut size={16} /></button>
                </>
              ) : (
                <>
                  {meData?.user && <Link href={`/messages/${p.handle}`} className="btn btn-outline btn-icon" aria-label="Написать сообщение" title="Написать"><MessageCircle size={18} /></Link>}
                  <FollowButton handle={p.handle} following={p.viewerFollows} />
                </>
              )}
            </div>
          </div>

          {edit ? (
            <div className="mt-4 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="input font-semibold" maxLength={60} placeholder="Имя" />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input resize-none" rows={2} maxLength={200} placeholder="Пара слов о себе" />
              <div className="flex justify-end"><button onClick={save} disabled={saving} className="btn btn-primary"><Check size={16} /> Сохранить</button></div>
            </div>
          ) : (
            <div className="mt-3">
              <h1 className="font-display text-2xl font-bold leading-tight">{p.name}</h1>
              <p className="text-sm text-muted">@{p.handle}</p>
              {p.bio && <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed">{p.bio}</p>}
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={13} /> с нами с {new Date(p.createdAt).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</p>
            </div>
          )}

          <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-4 text-center sm:max-w-md sm:text-left">
            {[
              [p.stats.posts, plural(p.stats.posts, "пост", "поста", "постов")],
              [p.stats.followers, plural(p.stats.followers, "подписчик", "подписчика", "подписчиков")],
              [p.stats.following, "подписок"],
              [p.stats.likesReceived, plural(p.stats.likesReceived, "лайк", "лайка", "лайков")],
            ].map(([n, l]) => (
              <div key={l as string}><dt className="font-display text-lg font-bold tabular-nums">{n}</dt><dd className="text-[11px] text-muted">{l}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      {own && <PostEditor />}

      <h2 className="px-1 font-display text-sm font-bold uppercase tracking-wider text-muted">Посты</h2>
      <Feed filter={{ author: p.handle }} emptyTitle={own ? "Вы ещё ничего не написали" : "Здесь пока пусто"} emptyText={own ? "Первый пост — самый лёгкий. Cosmos поможет." : "Автор ещё собирается с мыслями."} />
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
