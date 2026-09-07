"use client";

import { useState } from "react";
import { CalendarDays, Pencil, LogOut, Check, X, MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogout, useMe, useProfile, keys } from "@/hooks/use-data";
import { api } from "@/lib/api-client";
import { Avatar, EmptyState, Skeleton } from "./ui";
import { FollowButton } from "./follow-button";
import { Feed } from "./feed";
import { PostEditor } from "./post-editor";
import { useToast } from "./toast";
import { plural } from "@/lib/format";
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
        <div className="h-28 w-full" style={{ background: `linear-gradient(120deg, hsl(${[168,34,210,350,90,265,20,140][p.hue % 8]} 55% 45%), var(--accent-soft) 70%, var(--saffron-soft))` }} />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <Avatar user={p} size={84} className="ring-4 ring-elev" />
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
