"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ImagePlus, X, MessageCircleMore } from "lucide-react";
import { useConversations, useMe, useMessages, useSendMessage } from "@/hooks/use-data";
import { useUpload } from "@/hooks/use-upload";
import { Avatar, EmptyState, Skeleton } from "./ui";
import { RichText } from "./rich-text";
import { MediaGrid } from "./media";
import { useToast } from "./toast";
import { cn, timeAgo } from "@/lib/format";
import { BOT_HANDLE, QUICK_QUESTIONS } from "@/lib/bot";
import { Bot } from "lucide-react";

/**
 * «Хат» — личные сообщения. Двухпанельная раскладка на десктопе, одна панель на телефоне.
 * Опрос сервера раз в 3 с (тред) и 8 с (список) — просто и надёжно на serverless.
 */
export function MessagesView({ handle }: { handle?: string }) {
  const { data: me, isPending } = useMe();
  if (!isPending && !me?.user) {
    return <EmptyState title="Сообщения только для своих" text="Войдите, чтобы переписываться с людьми из созвездия." action={<Link href="/login" className="btn btn-primary">Войти</Link>} />;
  }
  return (
    <div className={cn("card flex min-h-[420px] overflow-hidden md:h-[calc(100dvh-3.5rem)]", handle ? "h-[calc(100dvh-1.5rem)]" : "h-[calc(100dvh-9.5rem)]")}>
      <aside className={cn("w-full shrink-0 flex-col border-r border-line md:flex md:w-72 lg:w-80", handle ? "hidden" : "flex")}>
        <header className="flex items-center justify-between px-4 py-3"><h1 className="font-display text-lg font-bold">Сообщения</h1></header>
        <ConversationList active={handle} />
      </aside>
      <section className={cn("min-w-0 flex-1 flex-col", handle ? "flex" : "hidden md:flex")}>
        {handle ? <ChatThread handle={handle} /> : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted">
            <MessageCircleMore size={36} className="mb-3 text-accent" />
            <p className="font-semibold text-ink">Выберите диалог</p>
            <p className="mt-1 text-sm">или напишите кому-нибудь с его страницы профиля.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ConversationList({ active }: { active?: string }) {
  const q = useConversations(true);
  if (q.isPending) return <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl!" />)}</div>;
  if (!q.data?.items.length) return <p className="p-4 text-sm text-muted">Пока ни одного диалога. Откройте профиль человека и нажмите «Написать».</p>;
  return (
    <ul className="flex-1 overflow-y-auto p-2">
      {q.data.items.map((c) => (
        <li key={c.id}>
          <Link href={`/messages/${c.peer.handle}`} className={cn("flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-bg-2", active === c.peer.handle && "bg-accent-soft")}>
            <Avatar user={c.peer} size={44} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold">{c.peer.name}</span>{c.lastMessage && <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessage.createdAt)}</span>}</span>
              <span className={cn("block truncate text-xs", c.unread ? "font-semibold text-ink" : "text-muted")}>
                {c.lastMessage ? `${c.lastMessage.mine ? "Вы: " : ""}${c.lastMessage.text || (c.lastMessage.hasMedia ? "📎 Медиа" : "")}` : "Нет сообщений"}
              </span>
            </span>
            {c.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">{c.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ChatThread({ handle }: { handle: string }) {
  const q = useMessages(handle, true);
  const send = useSendMessage(handle);
  const upload = useUpload({ images: 1, videos: 1 });
  const toast = useToast();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const count = q.data?.items.length ?? 0;

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [count]);

  const isBot = q.data?.peer.handle === BOT_HANDLE;

  const submit = async (preset?: string) => {
    const t = (preset ?? text).trim();
    const mediaId = preset ? undefined : upload.mediaIds[0];
    if ((!t && !mediaId) || send.isPending || upload.uploading) return;
    try {
      await send.mutateAsync({ text: t || undefined, mediaId });
      setText(""); upload.reset();
    } catch (e) { toast(e instanceof Error ? e.message : "Не отправилось", "error"); }
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <Link href="/messages" className="btn btn-ghost btn-icon h-9 w-9 md:hidden" aria-label="Назад"><ArrowLeft size={18} /></Link>
        {q.data ? (
          <Link href={`/u/${q.data.peer.handle}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar user={q.data.peer} size={36} />
            <span className="min-w-0 leading-tight"><span className="flex items-center gap-1.5 truncate text-sm font-semibold">{q.data.peer.name}{isBot && <span className="chip py-0 text-[10px] text-accent"><Bot size={11} /> бот</span>}</span><span className="block text-xs text-muted">{isBot ? "отвечает мгновенно" : `@${q.data.peer.handle}`}</span></span>
          </Link>
        ) : <Skeleton className="h-9 w-40" />}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {q.isPending && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className={cn("h-10 w-2/3 rounded-2xl!", i % 2 === 1 && "ml-auto")} />)}</div>}
        {q.isError && <p className="text-center text-sm text-rose">{q.error.message}</p>}
        {q.data && !q.data.items.length && <p className="py-10 text-center text-sm text-muted">Начните разговор — напишите первым. Можно прикрепить фото или видео.</p>}
        {send.isPending && isBot && <p className="text-xs text-muted">Көмекші печатает…</p>}
        {q.data?.items.map((m, i) => {
          const prev = q.data.items[i - 1];
          const showTime = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 10 * 60_000;
          return (
            <div key={m.id}>
              {showTime && <p className="my-3 text-center text-[11px] text-muted">{new Date(m.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
              <div className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm sm:max-w-[70%]", m.media && "w-72 max-w-[82%] p-1.5", m.mine ? "rounded-br-md bg-accent text-accent-ink" : "rounded-bl-md bg-bg-2 text-ink")}>
                  {m.media && <MediaGrid media={[m.media]} className={cn("border-0", m.text && "mb-1.5")} />}
                  {m.text && (m.mine ? <p className={cn(m.media && "px-2 pb-1")} style={{ overflowWrap: "anywhere" }}>{m.text}</p> : <RichText text={m.text} className={cn(m.media && "px-2 pb-1")} />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="border-t border-line p-2.5 pb-safe">
        {isBot && (
          <div className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
            {QUICK_QUESTIONS.map((qq) => (
              <button key={qq} onClick={() => submit(qq)} disabled={send.isPending} className="chip shrink-0 hover:border-accent">{qq}</button>
            ))}
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
          <label className="btn btn-ghost btn-icon shrink-0 cursor-pointer text-accent" title="Фото или видео">
            <ImagePlus size={20} />
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { if (e.target.files?.length) upload.add(e.target.files); e.target.value = ""; }} />
          </label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Сообщение…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            onPaste={(e) => { const f = Array.from(e.clipboardData.files ?? []); if (f.length) { e.preventDefault(); upload.add(f); } }}
            className="input max-h-32 min-h-10 flex-1 resize-none py-2.5" />
          <button onClick={() => submit()} disabled={(!text.trim() && !upload.mediaIds.length) || send.isPending || upload.uploading} className="btn btn-primary btn-icon shrink-0" aria-label="Отправить"><Send size={18} /></button>
        </div>
      </div>
    </>
  );
}
