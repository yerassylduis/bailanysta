"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Circle, Square, MessageSquare, PhoneOff, Copy, Download, Users, Send } from "lucide-react";
import { useMe } from "@/hooks/use-data";
import { useCallRoom, type Peer } from "@/hooks/use-call-room";
import { Avatar, EmptyState } from "./ui";
import { useToast } from "./toast";
import { cn } from "@/lib/format";
import type { UserDto } from "@/lib/types";

/** Комната звонка: сетка видео, панель управления, чат справа. */
export function CallRoom({ id }: { id: string }) {
  const { data: me, isPending } = useMe();
  const room = useCallRoom(id, me?.user ?? null);
  const toast = useToast();
  const [chatOpen, setChatOpen] = useState(false);
  const [text, setText] = useState("");
  const chatBottom = useRef<HTMLDivElement>(null);
  // Непрочитанные в чате — производное: сколько сообщений пришло с момента, когда чат последний раз был открыт.
  const [seen, setSeen] = useState(0);
  const unread = chatOpen ? 0 : Math.max(0, room.chat.length - seen);
  const openChat = (o: boolean) => { setChatOpen(o); setSeen(room.chat.length); };

  useEffect(() => { if (chatOpen) chatBottom.current?.scrollIntoView({ block: "end" }); }, [chatOpen, room.chat.length]);

  if (!isPending && !me?.user) return <EmptyState title="Войдите, чтобы присоединиться" text="Созвоны доступны только участникам сети." action={<Link href="/login" className="btn btn-primary">Войти</Link>} />;

  const copyLink = async () => { try { await navigator.clipboard.writeText(`${location.origin}/calls/${id}`); toast("Ссылка на созвон скопирована", "success"); } catch { toast(`${location.origin}/calls/${id}`); } };
  const sendChat = async () => { const t = text.trim(); if (!t) return; await room.sendChat(t); setText(""); };

  const tiles: Array<{ id: string; user: UserDto; stream: MediaStream | null; me?: boolean; muted: boolean; camOff: boolean; sharing: boolean; version: number; connected: boolean }> = [
    ...(me?.user ? [{ id: "me", user: me.user, stream: room.local, me: true, muted: room.muted, camOff: room.camOff, sharing: room.sharing, version: 0, connected: true }] : []),
    ...Object.values(room.peers).map((p: Peer) => ({ id: p.user.id, user: p.user, stream: p.stream, muted: p.muted, camOff: p.camOff, sharing: p.sharing, version: p.version, connected: p.connected })),
  ];
  const n = tiles.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;

  // Экран входа
  if (!room.joined) {
    return (
      <div className="mx-auto max-w-lg pt-6">
        <Link href="/calls" className="btn btn-ghost -ml-2 mb-3 px-2 text-sm"><ArrowLeft size={16} /> Все созвоны</Link>
        <div className="card p-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent"><Video size={26} /></span>
          <h1 className="font-display text-xl font-bold">{room.call?.title ?? "Созвон"}</h1>
          <p className="mt-1 font-mono text-sm text-muted">{id}</p>
          <p className="mt-3 text-sm text-ink-2">Браузер попросит доступ к камере и микрофону. Если камеры нет — подключимся только со звуком.</p>
          {room.error && <p className="mt-3 rounded-xl bg-rose-soft p-3 text-sm text-rose">{room.error}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={room.join} className="btn btn-primary px-6 py-3"><Video size={18} /> Присоединиться</button>
            <button onClick={copyLink} className="btn btn-outline py-3"><Copy size={16} /> Скопировать ссылку</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-1.5rem)] flex-col gap-3 md:h-[calc(100dvh-3.5rem)]">
      <header className="flex items-center gap-2 px-1">
        <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-rose" />
        <h1 className="truncate font-display text-base font-bold">{room.call?.title}</h1>
        <span className="hidden font-mono text-xs text-muted sm:inline">{id}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted"><Users size={14} /> {tiles.length}</span>
        <button onClick={copyLink} className="btn btn-outline px-3 py-1.5 text-xs"><Copy size={14} /> Пригласить</button>
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* Сетка */}
        <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}>
          {tiles.map((t) => <Tile key={t.id} user={t.user} stream={t.stream} me={t.me} muted={t.muted} camOff={t.camOff} sharing={t.sharing} version={t.version} connected={t.connected} />)}
        </div>

        {/* Чат */}
        <aside className={cn("card flex w-full flex-col overflow-hidden md:w-80", chatOpen ? "absolute inset-x-3 bottom-24 top-20 z-30 flex md:static md:inset-auto" : "hidden")}>
          <header className="flex items-center justify-between border-b border-line px-3 py-2"><span className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} /> Чат звонка</span><button onClick={() => openChat(false)} className="btn btn-ghost btn-icon h-7 w-7 md:hidden">✕</button></header>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
            {room.chat.length === 0 && <p className="py-6 text-center text-xs text-muted">Пока пусто. Напишите что-нибудь — увидят все в звонке.</p>}
            {room.chat.map((m) => (
              <div key={m.id} className="flex gap-2">
                <Avatar user={m.from} size={24} />
                <div className="min-w-0"><span className="text-xs font-semibold">{m.from.name.split(/\s+/)[0]}</span> <span className="text-[10px] text-muted">{new Date(m.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span><p className="leading-snug" style={{ overflowWrap: "anywhere" }}>{m.text}</p></div>
              </div>
            ))}
            <div ref={chatBottom} />
          </div>
          <div className="flex items-center gap-1.5 border-t border-line p-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} placeholder="Сообщение…" className="input py-2 text-sm" />
            <button onClick={sendChat} disabled={!text.trim()} className="btn btn-primary btn-icon h-9 w-9"><Send size={15} /></button>
          </div>
        </aside>
      </div>

      {/* Панель управления */}
      <footer className="card flex flex-wrap items-center justify-center gap-2 p-2 pb-safe">
        <Ctl on={!room.muted} onClick={room.toggleMute} label={room.muted ? "Включить микрофон" : "Выключить микрофон"}>{room.muted ? <MicOff size={20} /> : <Mic size={20} />}</Ctl>
        <Ctl on={!room.camOff} onClick={room.toggleCam} label={room.camOff ? "Включить камеру" : "Выключить камеру"}>{room.camOff ? <VideoOff size={20} /> : <Video size={20} />}</Ctl>
        <Ctl on={room.sharing} accent onClick={room.sharing ? room.stopShare : room.startShare} label={room.sharing ? "Остановить показ экрана" : "Показать экран"}>{room.sharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}</Ctl>
        <Ctl on={room.recording} danger onClick={room.recording ? room.stopRecording : room.startRecording} label={room.recording ? "Остановить запись" : "Записать звонок"}>{room.recording ? <Square size={18} /> : <Circle size={20} />}</Ctl>
        <button onClick={() => openChat(!chatOpen)} className={cn("btn btn-outline relative btn-icon h-12 w-12", chatOpen && "bg-accent-soft border-accent")} aria-label="Чат"><MessageSquare size={20} />{unread > 0 && !chatOpen && <span className="absolute -right-1 -top-1 rounded-full bg-rose px-1.5 text-[10px] font-bold text-white">{unread}</span>}</button>
        {room.recording && <span className="flex items-center gap-1.5 text-xs font-semibold text-rose"><span className="h-2 w-2 animate-pulse rounded-full bg-rose" /> идёт запись</span>}
        {room.recordingUrl && <a href={room.recordingUrl} download={`bailanysta-${id}.${room.recordingExt}`} className="btn btn-outline gap-1.5 text-xs"><Download size={14} /> Скачать запись</a>}
        <Link href="/calls" onClick={() => room.leave()} className="btn ml-2 bg-rose px-5 text-white hover:brightness-110"><PhoneOff size={18} /> Выйти</Link>
      </footer>
    </div>
  );
}

function Ctl({ on, accent, danger, onClick, label, children }: { on: boolean; accent?: boolean; danger?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={cn("btn btn-icon h-12 w-12", on ? (danger ? "bg-rose text-white" : accent ? "bg-accent text-accent-ink" : "btn-outline") : danger || accent ? "btn-outline" : "bg-rose-soft text-rose")}>
      {children}
    </button>
  );
}

/** Плитка участника: видео (или аватар при выключенной камере), имя, индикаторы. */
function Tile({ user, stream, me, muted, camOff, sharing, version, connected }: { user: UserDto; stream: MediaStream | null; me?: boolean; muted: boolean; camOff: boolean; sharing: boolean; version: number; connected: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    // после смены дорожек браузер может остановить воспроизведение — запускаем явно
    el.play().catch(() => {});
  }, [stream, version]);
  const videoTrack = stream?.getVideoTracks()[0];
  const hasVideo = !!videoTrack && videoTrack.readyState === "live" && !videoTrack.muted && !camOff;
  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl border border-line bg-black">
      <video ref={ref} data-call-tile={user.name} autoPlay playsInline muted={me} className={cn("h-full w-full object-cover", sharing && "object-contain", !hasVideo && "opacity-0", me && !sharing && "scale-x-[-1]")} />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-2">
          <Avatar user={user} size={72} />
          {!me && !connected && <span className="text-xs text-muted">Соединяемся…</span>}
          {!me && connected && camOff && <span className="text-xs text-muted">Камера выключена</span>}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
        {muted && <MicOff size={12} className="text-rose" />}{sharing && <MonitorUp size={12} className="text-accent" />}
        {user.name}{me && " (вы)"}
      </div>
    </div>
  );
}
