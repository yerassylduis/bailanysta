"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, ImagePlus, X, MessageCircleMore, Users, Plus, UserPlus, LogOut, Bot, Video } from "lucide-react";
import { useConversations, useCreateGroup, useGroupMessages, useMe, useMessages, useSendGroupMessage, useSendMessage } from "@/hooks/use-data";
import { useUpload } from "@/hooks/use-upload";
import { api } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, EmptyState, Skeleton } from "./ui";
import { RichText } from "./rich-text";
import { MediaGrid } from "./media";
import { useToast } from "./toast";
import { cn, fmtDateTime, timeAgo } from "@/lib/format";
import { useT } from "./locale-provider";
import { BOT_HANDLE, QUICK_QUESTIONS } from "@/lib/bot";
import type { ConversationDto, MessageDto, UserDto } from "@/lib/types";

/**
 * «Хат» — сообщения: личные диалоги и группы. Двухпанельная раскладка на десктопе,
 * одна панель на телефоне. Опрос сервера раз в 3 с (тред) и 8 с (список) + realtime по SSE.
 */
export function MessagesView({ handle, groupId }: { handle?: string; groupId?: string }) {
  const { data: me, isPending } = useMe();
  const { t } = useT();
  const [creating, setCreating] = useState(false);
  const open = !!handle || !!groupId;
  if (!isPending && !me?.user) {
    return <EmptyState title={t("messages.onlyForOwn")} text={t("messages.loginText")} action={<Link href="/login" className="btn btn-primary">{t("nav.login")}</Link>} />;
  }
  return (
    <div className={cn("card flex min-h-[420px] overflow-hidden md:h-[calc(100dvh-3.5rem)]", open ? "h-[calc(100dvh-1.5rem)]" : "h-[calc(100dvh-9.5rem)]")}>
      <aside className={cn("w-full shrink-0 flex-col border-r border-line md:flex md:w-72 lg:w-80", open ? "hidden" : "flex")}>
        <header className="flex items-center justify-between px-4 py-3">
          <h1 className="font-display text-lg font-bold">{t("nav.messages")}</h1>
          <button onClick={() => setCreating(true)} className="btn btn-outline gap-1.5 px-3 py-1.5 text-xs" title={t("messages.newGroup")}><Users size={14} /> {t("messages.group")}</button>
        </header>
        <ConversationList activeHandle={handle} activeGroup={groupId} />
      </aside>
      <section className={cn("min-w-0 flex-1 flex-col", open ? "flex" : "hidden md:flex")}>
        {handle ? <DmThread handle={handle} /> : groupId ? <GroupThread id={groupId} /> : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted">
            <MessageCircleMore size={36} className="mb-3 text-accent" />
            <p className="font-semibold text-ink">{t("messages.pickDialog")}</p>
            <p className="mt-1 text-sm">{t("messages.pickHint.before")}<button onClick={() => setCreating(true)} className="link-tag">{t("messages.pickHint.link")}</button>{t("messages.pickHint.after")}</p>
          </div>
        )}
      </section>
      {creating && <CreateGroupDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

/* ------------------------------ список ---------------------------------- */

function ConversationList({ activeHandle, activeGroup }: { activeHandle?: string; activeGroup?: string }) {
  const { t, locale } = useT();
  const q = useConversations(true);
  if (q.isPending) return <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl!" />)}</div>;
  if (!q.data?.items.length) return <p className="p-4 text-sm text-muted">{t("messages.noDialogs")}</p>;
  return (
    <ul className="flex-1 overflow-y-auto p-2">
      {q.data.items.map((c) => {
        const href = c.kind === "group" ? `/messages/g/${c.id}` : `/messages/${c.peer!.handle}`;
        const active = c.kind === "group" ? activeGroup === c.id : activeHandle === c.peer?.handle;
        const last = c.lastMessage ? `${c.lastMessage.mine ? t("messages.you") : c.kind === "group" ? c.lastMessage.fromName ?? "" : ""}${c.lastMessage.mine || c.kind === "group" ? ": " : ""}${c.lastMessage.text || (c.lastMessage.hasMedia ? t("messages.mediaAttachment") : "")}` : t("messages.noMessages");
        return (
          <li key={c.id}>
            <Link href={href} className={cn("flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-bg-2", active && "bg-accent-soft")}>
              {c.kind === "group" ? <GroupAvatar members={c.members} /> : <Avatar user={c.peer!} size={44} />}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.kind === "group" ? c.title : c.peer!.name}</span>
                  {c.lastMessage && <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessage.createdAt, locale)}</span>}
                </span>
                <span className={cn("block truncate text-xs", c.unread ? "font-semibold text-ink" : "text-muted")}>{last}</span>
              </span>
              {c.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">{c.unread}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Аватар группы: до трёх участников стопкой. */
function GroupAvatar({ members, size = 44 }: { members: UserDto[]; size?: number }) {
  const shown = members.slice(0, 3);
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      {shown.map((m, i) => (
        <span key={m.id} className="absolute" style={{ left: i * (size * 0.28), top: i * (size * 0.2), zIndex: 3 - i }}>
          <Avatar user={m} size={size * 0.62} className="ring-2 ring-elev" />
        </span>
      ))}
      {!shown.length && <span className="flex h-full w-full items-center justify-center rounded-full bg-accent-soft text-accent"><Users size={size * 0.45} /></span>}
    </span>
  );
}

/* --------------------------- общий композер ------------------------------ */

function Composer({ onSend, pending, isBot, onQuick }: { onSend: (body: { text?: string; mediaId?: string }) => Promise<unknown>; pending: boolean; isBot?: boolean; onQuick?: (q: string) => void }) {
  const upload = useUpload({ images: 1, videos: 1 });
  const toast = useToast();
  const { t } = useT();
  const [text, setText] = useState("");
  const submit = async () => {
    const body = text.trim();
    const mediaId = upload.mediaIds[0];
    if ((!body && !mediaId) || pending || upload.uploading) return;
    try { await onSend({ text: body || undefined, mediaId }); setText(""); upload.reset(); }
    catch (e) { toast(e instanceof Error ? e.message : t("messages.sendFailed"), "error"); }
  };
  return (
    <div className="border-t border-line p-2.5 pb-safe">
      {isBot && onQuick && (
        <div className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
          {QUICK_QUESTIONS.map((qq) => <button key={qq} onClick={() => onQuick(qq)} disabled={pending} className="chip shrink-0 hover:border-accent">{qq}</button>)}
        </div>
      )}
      {upload.items.length > 0 && (
        <div className="mb-2 flex gap-2">
          {upload.items.map((a) => (
            <div key={a.localId} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line bg-bg-2">
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.preview} alt="" className="h-full w-full object-cover" />
              ) : <video src={a.preview} className="h-full w-full object-cover" muted />}
              {!a.media && !a.error && <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30"><div className="h-full bg-accent" style={{ width: `${a.progress * 100}%` }} /></div>}
              {a.error && <div className="absolute inset-0 bg-rose/80 p-1 text-[10px] text-white">{a.error}</div>}
              <button onClick={() => upload.remove(a.localId)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <label className="btn btn-ghost btn-icon shrink-0 cursor-pointer text-accent" title={t("messages.attach")}>
          <ImagePlus size={20} />
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { if (e.target.files?.length) upload.add(e.target.files); e.target.value = ""; }} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={t("messages.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          onPaste={(e) => { const f = Array.from(e.clipboardData.files ?? []); if (f.length) { e.preventDefault(); upload.add(f); } }}
          className="input max-h-32 min-h-10 flex-1 resize-none py-2.5" />
        <button onClick={submit} disabled={(!text.trim() && !upload.mediaIds.length) || pending || upload.uploading} className="btn btn-primary btn-icon shrink-0" aria-label={t("common.send")}><Send size={18} /></button>
      </div>
    </div>
  );
}

/* ------------------------------ сообщения -------------------------------- */

function MessageList({ items, pending, isPending, error, showAuthor, typing }: { items: MessageDto[]; pending?: boolean; isPending: boolean; error?: string; showAuthor?: boolean; typing?: string }) {
  const { t, locale } = useT();
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [items.length]);
  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
      {isPending && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className={cn("h-10 w-2/3 rounded-2xl!", i % 2 === 1 && "ml-auto")} />)}</div>}
      {error && <p className="text-center text-sm text-rose">{error}</p>}
      {!isPending && !items.length && <p className="py-10 text-center text-sm text-muted">{t("messages.startConversation")}</p>}
      {items.map((m, i) => {
        const prev = items[i - 1];
        const showTime = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 10 * 60_000;
        const sameAuthor = prev && prev.from.id === m.from.id && !showTime;
        return (
          <div key={m.id}>
            {showTime && <p className="my-3 text-center text-[11px] text-muted">{fmtDateTime(m.createdAt, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
            <div className={cn("flex items-end gap-2", m.mine ? "justify-end" : "justify-start")}>
              {showAuthor && !m.mine && (sameAuthor ? <span className="w-7" /> : <Link href={`/u/${m.from.handle}`}><Avatar user={m.from} size={28} /></Link>)}
              <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm sm:max-w-[70%]", m.media && "w-72 max-w-[82%] p-1.5", m.mine ? "rounded-br-md bg-accent text-accent-ink" : "rounded-bl-md bg-bg-2 text-ink")}>
                {showAuthor && !m.mine && !sameAuthor && <p className={cn("mb-0.5 text-[11px] font-semibold text-accent", m.media && "px-2 pt-1")}>{m.from.name}</p>}
                {m.media && <MediaGrid media={[m.media]} className={cn("border-0", m.text && "mb-1.5")} />}
                {m.text && (m.mine ? <p className={cn(m.media && "px-2 pb-1")} style={{ overflowWrap: "anywhere" }}>{m.text}</p> : <RichText text={m.text} className={cn(m.media && "px-2 pb-1")} />)}
                {callLink(m.text) && (
                  <Link href={callLink(m.text)!} className={cn("btn mt-2 w-full py-1.5 text-xs", m.mine ? "bg-white/20 text-accent-ink hover:bg-white/30" : "btn-primary")}>
                    <Video size={14} /> {t("messages.joinCall")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {pending && typing && <p className="text-xs text-muted">{typing}</p>}
      <div ref={bottom} />
    </div>
  );
}

/* ------------------------------ личный тред ------------------------------ */

function DmThread({ handle }: { handle: string }) {
  const q = useMessages(handle, true);
  const send = useSendMessage(handle);
  const isBot = q.data?.peer.handle === BOT_HANDLE;
  const { t } = useT();
  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <Link href="/messages" className="btn btn-ghost btn-icon h-9 w-9 md:hidden" aria-label={t("common.back")}><ArrowLeft size={18} /></Link>
        {q.data ? (
          <Link href={`/u/${q.data.peer.handle}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar user={q.data.peer} size={36} />
            <span className="min-w-0 leading-tight">
              <span className="flex items-center gap-1.5 truncate text-sm font-semibold">{q.data.peer.name}{isBot && <span className="chip py-0 text-[10px] text-accent"><Bot size={11} /> {t("messages.bot")}</span>}</span>
              <span className="block text-xs text-muted">{isBot ? t("messages.botReplies") : `@${q.data.peer.handle}`}</span>
            </span>
          </Link>
        ) : <Skeleton className="h-9 w-40" />}
      </header>
      <MessageList items={q.data?.items ?? []} isPending={q.isPending} error={q.error?.message} pending={send.isPending} typing={isBot ? t("messages.botTyping") : undefined} />
      <Composer onSend={(b) => send.mutateAsync(b)} pending={send.isPending} isBot={isBot} onQuick={(text) => send.mutateAsync({ text })} />
    </>
  );
}

/* ------------------------------ группа ---------------------------------- */

function GroupThread({ id }: { id: string }) {
  const q = useGroupMessages(id, true);
  const send = useSendGroupMessage(id);
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { t } = useT();
  const [adding, setAdding] = useState(false);
  const [handle, setHandle] = useState("");
  const conv = q.data?.conversation;

  const addMember = async () => {
    const h = handle.trim().replace(/^@/, "").toLowerCase();
    if (!h) return;
    try { await api.addGroupMember(id, h); setHandle(""); setAdding(false); qc.invalidateQueries({ queryKey: ["group-messages", id] }); qc.invalidateQueries({ queryKey: ["conversations"] }); toast(t("messages.memberAdded"), "success"); }
    catch (e) { toast(e instanceof Error ? e.message : t("messages.error"), "error"); }
  };
  const leave = async () => {
    if (!confirm(t("messages.leaveConfirm"))) return;
    try { await api.leaveGroup(id); qc.invalidateQueries({ queryKey: ["conversations"] }); router.push("/messages"); }
    catch (e) { toast(e instanceof Error ? e.message : t("messages.error"), "error"); }
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <Link href="/messages" className="btn btn-ghost btn-icon h-9 w-9 md:hidden" aria-label={t("common.back")}><ArrowLeft size={18} /></Link>
        {conv ? (
          <>
            <GroupAvatar members={conv.members} size={38} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">{conv.title}</span>
              <span className="block truncate text-xs text-muted">{t("messages.members", { count: conv.members.length })} · {conv.members.map((m) => m.name.split(/\s+/)[0]).join(", ")}</span>
            </span>
            <button onClick={() => setAdding((a) => !a)} className="btn btn-ghost btn-icon h-9 w-9" title={t("messages.addMember")}><UserPlus size={17} /></button>
            <button onClick={leave} className="btn btn-ghost btn-icon h-9 w-9 text-rose" title={t("messages.leaveGroup")}><LogOut size={17} /></button>
          </>
        ) : <Skeleton className="h-9 w-40" />}
      </header>
      {adding && (
        <div className="flex items-center gap-2 border-b border-line bg-bg-2/60 px-3 py-2">
          <span className="text-muted">@</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMember(); }} placeholder={t("messages.handlePlaceholder")} className="input py-1.5" autoFocus />
          <button onClick={addMember} className="btn btn-primary px-3 py-1.5 text-xs"><Plus size={14} /> {t("common.add")}</button>
        </div>
      )}
      <MessageList items={q.data?.items ?? []} isPending={q.isPending} error={q.error?.message} showAuthor />
      <Composer onSend={(b) => send.mutateAsync(b)} pending={send.isPending} />
    </>
  );
}

/* --------------------------- создание группы ---------------------------- */

function CreateGroupDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateGroup();
  const router = useRouter();
  const toast = useToast();
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<UserDto[]>([]);
  const q = query.trim().replace(/^@/, "");
  const search = useQuery({ queryKey: ["group-search", q], queryFn: () => api.searchUsers(q), enabled: q.length >= 1, staleTime: 10_000 });
  const found = (search.data?.items ?? []).filter((u) => u.handle !== BOT_HANDLE);

  const submit = async () => {
    if (!title.trim() || !picked.length) return;
    try {
      const g = await create.mutateAsync({ title: title.trim(), handles: picked.map((u) => u.handle) });
      toast(t("messages.groupCreated"), "success"); onClose(); router.push(`/messages/g/${g.id}`);
    } catch (e) { toast(e instanceof Error ? e.message : t("messages.error"), "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="card fade-in w-full max-w-md rounded-b-none p-5 sm:rounded-b-xl2" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("messages.newGroup")}>
        <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-display text-base font-bold"><Users size={18} className="text-accent" /> {t("messages.newGroup")}</h3><button onClick={onClose} className="btn btn-ghost btn-icon h-8 w-8"><X size={16} /></button></div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("messages.groupTitlePlaceholder")} className="input" maxLength={60} autoFocus />
        <div className="mt-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("messages.searchMember")} className="input" />
          {found.length > 0 && (
            <ul className="card mt-1 max-h-40 overflow-y-auto p-1">
              {found.filter((u) => !picked.some((p) => p.id === u.id)).map((u) => (
                <li key={u.id}><button onClick={() => { setPicked((p) => [...p, u]); setQuery(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-2"><Avatar user={u} size={24} /> {u.name} <span className="text-muted">@{u.handle}</span></button></li>
              ))}
            </ul>
          )}
          {picked.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {picked.map((u) => <button key={u.id} onClick={() => setPicked((p) => p.filter((x) => x.id !== u.id))} className="chip gap-1.5 pl-1"><Avatar user={u} size={18} /> {u.name} <X size={12} /></button>)}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">{t("common.cancel")}</button>
          <button onClick={submit} disabled={!title.trim() || !picked.length || create.isPending} className="btn btn-primary"><Plus size={16} /> {t("common.create")}</button>
        </div>
      </div>
    </div>
  );
}

/** Ссылка на созвон внутри текста сообщения → относительный путь для кнопки. */
function callLink(text: string): string | null {
  const m = /\/calls\/([a-z0-9]{3}-[a-z0-9]{3}-[a-z0-9]{3})/i.exec(text);
  return m ? `/calls/${m[1].toLowerCase()}` : null;
}

export type { ConversationDto };
