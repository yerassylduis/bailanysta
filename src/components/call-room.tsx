"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, Circle, Square, MessageSquare, PhoneOff, Copy, Download, Users, Send } from "lucide-react";
import { useConversations, useMe } from "@/hooks/use-data";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { UserPlus, Search, X, Check } from "lucide-react";
import { useCallRoom, type Peer, type PeerStats } from "@/hooks/use-call-room";
import { Activity, Volume2, Maximize, Minimize, Pin, Disc } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, EmptyState } from "./ui";
import { useToast } from "./toast";
import { cn } from "@/lib/format";
import type { UserDto } from "@/lib/types";

/** Комната звонка: сетка видео, панель управления, чат справа. */
export function CallRoom({ id }: { id: string }) {
  const { data: me, isPending } = useMe();
  const room = useCallRoom(id, me?.user ?? null);
  const toast = useToast();
  const router = useRouter();
  // Заранее запрашиваем камеру/микрофон на экране входа — вход по кнопке становится мгновенным
  const { prepare, onRecording, joined } = room;
  useEffect(() => { if (me?.user && !joined) prepare().catch(() => {}); }, [me?.user, joined, prepare]);
  // Кто-то включил запись — всплывашка (звук и голос — в хуке)
  useEffect(() => { onRecording((by) => toast(`🔴 ${by}: идёт запись звонка`, "error")); }, [onRecording, toast]);
  const previewRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (previewRef.current && previewRef.current.srcObject !== room.local) { previewRef.current.srcObject = room.local; previewRef.current.play().catch(() => {}); } }, [room.local, room.joined]);
  const leaveAndGo = async () => { await room.leave(); router.push("/calls"); };

  const [chatOpen, setChatOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const [fsTarget, setFsTarget] = useState<"root" | "stage" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onFs = () => {
      const el = document.fullscreenElement;
      setFsTarget(!el ? null : el === stageRef.current ? "stage" : el === rootRef.current ? "root" : null);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const fs = fsTarget === "root";
  /** Полноэкранный режим для конкретного элемента: повторное нажатие сворачивает, нажатие другой кнопки переключает элемент. */
  const toggleFullscreen = async (el: HTMLElement | null) => {
    if (!el) return;
    try {
      if (document.fullscreenElement === el) { await document.exitFullscreen(); return; }
      if (document.fullscreenElement) await document.exitFullscreen();
      await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    } catch { toast("Браузер не разрешил полноэкранный режим"); }
  };
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
  // Сцена: закреплённый участник, иначе тот, кто показывает экран. Свой экран на сцену не ставим:
  // если на нём открыт этот же звонок, получается бесконечное «зеркало» — как в Meet, своя презентация идёт миниатюрой.
  // Во время записи своя демонстрация тоже идёт на сцену — в записи и на экране экран занимает всё
  const stageId = pinned ?? tiles.find((t) => t.sharing && !t.me)?.id ?? (room.recording && room.sharing ? "me" : null);
  const stage = tiles.find((t) => t.id === stageId) ?? null;
  const thumbs = stage ? tiles.filter((t) => t.id !== stage.id) : [];

  // Экран входа
  if (!room.joined) {
    return (
      <div className="mx-auto max-w-lg pt-6">
        <Link href="/calls" className="btn btn-ghost -ml-2 mb-3 px-2 text-sm"><ArrowLeft size={16} /> Все созвоны</Link>
        <div className="card p-6 text-center">
          {room.local && room.local.getVideoTracks().length > 0 ? (
            <video ref={previewRef} autoPlay playsInline muted className="mx-auto mb-3 aspect-video w-full max-w-sm rounded-xl bg-black object-cover scale-x-[-1]" />
          ) : (
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent"><Video size={26} /></span>
          )}
          <h1 className="font-display text-xl font-bold">{room.call?.title ?? "Созвон"}</h1>
          <p className="mt-1 font-mono text-sm text-muted">{id}</p>
          <p className="mt-3 text-sm text-ink-2">{room.local ? (room.local.getVideoTracks().length ? "Камера и микрофон готовы — нажмите «Присоединиться»." : "Камера недоступна — подключимся только со звуком.") : "Браузер попросит доступ к камере и микрофону. Если камеры нет — подключимся только со звуком."}</p>
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
    <div ref={rootRef} className={cn("flex flex-col gap-3", fs ? "h-screen bg-bg p-3" : "h-[calc(100dvh-1.5rem)] md:h-[calc(100dvh-3.5rem)]")}>
      <header className="flex items-center gap-2 px-1">
        <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-rose" />
        <h1 className="truncate font-display text-base font-bold">{room.call?.title}</h1>
        <span className="hidden font-mono text-xs text-muted sm:inline">{id}</span>
        {room.anyoneRecording && <span className="flex items-center gap-1.5 rounded-full bg-rose px-2.5 py-1 text-xs font-semibold text-white"><Disc size={12} className="animate-pulse" /> Идёт запись{room.recordingBy ? ` · ${room.recordingBy}` : ""}</span>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted"><Users size={14} /> {tiles.length}</span>
        <button onClick={() => toggleFullscreen(rootRef.current)} className="btn btn-outline btn-icon h-9 w-9" aria-label={fs ? "Выйти из полноэкранного режима" : "Звонок на весь экран"} title={fs ? "Свернуть" : "На весь экран"}>{fs ? <Minimize size={16} /> : <Maximize size={16} />}</button>
        <div className="relative">
          <button onClick={() => setInviteOpen((o) => !o)} className="btn btn-primary px-3 py-1.5 text-xs"><UserPlus size={14} /> Пригласить</button>
          {inviteOpen && <InvitePopover callId={id} onClose={() => setInviteOpen(false)} onCopy={copyLink} inCall={new Set(tiles.map((t) => t.user.id))} />}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        {stage ? (
          /* Режим презентации: сцена во всю область + мини-плитки справа (на телефоне — снизу) */
          <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
            <div ref={stageRef} className={cn("group relative min-h-0 flex-1", fsTarget === "stage" && "bg-black")}>
              <Tile user={stage.user} stream={stage.stream} me={stage.me} muted={stage.muted} camOff={stage.camOff} sharing={stage.sharing} version={stage.version} connected={stage.connected} stats={stage.me ? undefined : room.stats[stage.id]} fit="contain" />
              <div className="absolute right-2 top-2 flex gap-1.5 opacity-80 transition group-hover:opacity-100">
                {pinned && <button onClick={() => setPinned(null)} className="btn bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur hover:bg-black/70"><Pin size={13} /> Открепить</button>}
                <button onClick={() => toggleFullscreen(stageRef.current)} className="btn bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur hover:bg-black/70" title={fsTarget === "stage" ? "Свернуть трансляцию" : "Трансляцию на весь экран"}>
                  {fsTarget === "stage" ? <><Minimize size={13} /> Свернуть</> : <><Maximize size={13} /> Во весь экран</>}
                </button>
              </div>
            </div>
            {thumbs.length > 0 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto md:w-44 md:flex-col md:overflow-y-auto lg:w-52">
                {thumbs.map((t) => (
                  <button key={t.id} onClick={() => setPinned(t.id)} className="relative aspect-video w-40 shrink-0 md:w-full" title="Показать крупно">
                    <Tile user={t.user} stream={t.stream} me={t.me} muted={t.muted} camOff={t.camOff} sharing={t.sharing} version={t.version} connected={t.connected} stats={t.me ? undefined : room.stats[t.id]} compact />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Обычная сетка; клик по плитке закрепляет её на сцене */
          <div className="relative grid min-h-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}>
            {room.sharing && (
              <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
                <span className="pointer-events-auto flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-card">
                  <MonitorUp size={14} /> Вы показываете экран — участники его видят
                  <button onClick={() => setPinned("me")} className="rounded-full bg-black/20 px-2 py-0.5 hover:bg-black/30">Показать крупно</button>
                  <button onClick={room.stopShare} className="rounded-full bg-black/20 px-2 py-0.5 hover:bg-black/30">Остановить</button>
                </span>
              </div>
            )}
            {tiles.map((t) => (
              <div key={t.id} className="group relative min-h-0" onDoubleClick={() => setPinned(t.id)}>
                <Tile user={t.user} stream={t.stream} me={t.me} muted={t.muted} camOff={t.camOff} sharing={t.sharing} version={t.version} connected={t.connected} stats={t.me ? undefined : room.stats[t.id]} />
                {tiles.length > 1 && <button onClick={() => setPinned(t.id)} className="btn absolute right-2 top-2 bg-black/55 px-2.5 py-1 text-xs text-white opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-black/70" title="Закрепить крупно"><Pin size={13} /> Крупно</button>}
              </div>
            ))}
          </div>
        )}

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

      {diagOpen && (
        <div className="card p-3 text-xs">
          <div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1.5 font-semibold"><Activity size={14} className="text-accent" /> Диагностика соединения</span><button onClick={() => setDiagOpen(false)} className="btn btn-ghost btn-icon h-6 w-6">✕</button></div>
          {Object.keys(room.stats).length === 0 && <p className="text-muted">Пока нет собеседников.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(room.stats).map(([id, st]) => {
              const name = room.peers[id]?.user.name ?? id;
              const noVideo = st.conn === "connected" && st.framesDecoded === 0;
              return (
                <div key={id} className="rounded-xl bg-bg-2 p-2.5 font-mono text-[11px] leading-relaxed">
                  <div className="mb-1 font-sans text-xs font-semibold">{name}</div>
                  <div>состояние: <b className={st.conn === "connected" ? "text-accent" : "text-rose"}>{st.conn}</b> · ice: {st.ice} · sdp: {st.sig}</div>
                  <div>маршрут: {st.pair ?? "—"}{st.rtt != null ? ` · ${st.rtt} мс` : ""}</div>
                  <div>видео: {st.width}×{st.height} · {st.fps || 0} fps · кадров {st.framesDecoded} · {(st.videoBytes / 1024).toFixed(0)} КБ</div>
                  <div>звук: {(st.audioBytes / 1024).toFixed(0)} КБ · дорожка видео {st.remoteVideoMuted == null ? "нет" : st.remoteVideoMuted ? "без данных (muted)" : "активна"}</div>
                  {noVideo && <div className="mt-1 font-sans text-[11px] text-saffron">Соединение есть, но видеокадры не приходят: у собеседника выключена или занята камера, либо вкладка в фоне.</div>}
                  {st.conn !== "connected" && <div className="mt-1 font-sans text-[11px] text-saffron">Нет соединения: если маршрут «—» дольше 20 с, сети не пробиваются напрямую, нужен TURN (README).</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Панель управления */}
      <footer className="card flex flex-wrap items-center justify-center gap-2 p-2 pb-safe">
        <Ctl on={!room.muted} onClick={room.toggleMute} label={room.muted ? "Включить микрофон" : "Выключить микрофон"}>{room.muted ? <MicOff size={20} /> : <Mic size={20} />}</Ctl>
        <Ctl on={!room.camOff} onClick={room.toggleCam} label={room.camOff ? "Включить камеру" : "Выключить камеру"}>{room.camOff ? <VideoOff size={20} /> : <Video size={20} />}</Ctl>
        <Ctl on={room.sharing} accent onClick={room.sharing ? room.stopShare : room.startShare} label={room.sharing ? "Остановить показ экрана" : "Показать экран"}>{room.sharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}</Ctl>
        <Ctl on={room.recording} danger onClick={room.recording ? room.stopRecording : room.startRecording} label={room.recording ? "Остановить запись" : "Записать звонок"}>{room.recording ? <Square size={18} /> : <Circle size={20} />}</Ctl>
        <button onClick={() => setDiagOpen((o) => !o)} className={cn("btn btn-outline btn-icon h-12 w-12", diagOpen && "bg-accent-soft border-accent")} aria-label="Диагностика" title="Диагностика соединения"><Activity size={20} /></button>
        <button onClick={() => openChat(!chatOpen)} className={cn("btn btn-outline relative btn-icon h-12 w-12", chatOpen && "bg-accent-soft border-accent")} aria-label="Чат"><MessageSquare size={20} />{unread > 0 && !chatOpen && <span className="absolute -right-1 -top-1 rounded-full bg-rose px-1.5 text-[10px] font-bold text-white">{unread}</span>}</button>
        {room.recording && <span className="flex items-center gap-1.5 text-xs font-semibold text-rose"><span className="h-2 w-2 animate-pulse rounded-full bg-rose" /> идёт запись</span>}
        {room.recordingUrl && <a href={room.recordingUrl} download={`bailanysta-${id}.${room.recordingExt}`} className="btn btn-outline gap-1.5 text-xs"><Download size={14} /> Скачать запись</a>}
        <button onClick={leaveAndGo} className="btn ml-2 bg-rose px-5 text-white hover:brightness-110"><PhoneOff size={18} /> Выйти</button>
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

/** Плитка участника: видео (или аватар при выключенной камере), имя, индикаторы, подсказки по диагностике. */
function Tile({ user, stream, me, muted, camOff, sharing, version, connected, stats, fit, compact }: { user: UserDto; stream: MediaStream | null; me?: boolean; muted: boolean; camOff: boolean; sharing: boolean; version: number; connected: boolean; stats?: PeerStats; fit?: "cover" | "contain"; compact?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) { el.srcObject = stream; console.info("[call] tile", user.handle, "srcObject set:", stream ? stream.getTracks().map((t) => t.kind).join("+") : "null"); }
    // Автовоспроизведение со звуком браузер может запретить — тогда покажем кнопку
    el.play().then(() => setBlocked(false)).catch((e) => { console.warn("[call] play blocked", user.handle, e?.name); setBlocked(true); });
  }, [stream, version, user.handle]);
  const videoTrack = stream?.getVideoTracks()[0];
  const hasVideo = !!videoTrack && videoTrack.readyState === "live" && !videoTrack.muted && !camOff;
  const noFrames = !compact && !me && connected && hasVideo && stats && stats.framesDecoded === 0 && stats.videoBytes === 0;
  return (
    <div className={cn("relative h-full min-h-0 w-full overflow-hidden border border-line bg-black", compact ? "rounded-xl" : "rounded-2xl")}>
      <video ref={ref} data-call-tile={user.name} data-sharing={sharing ? "1" : undefined} autoPlay playsInline muted={me} className={cn("h-full w-full", fit === "contain" || sharing ? "object-contain" : "object-cover", !hasVideo && "opacity-0", me && !sharing && "scale-x-[-1]")} />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-2 px-4 text-center">
          <Avatar user={user} size={compact ? 36 : 72} />
          {!compact && !me && !connected && <span className="text-xs text-muted">Соединяемся…</span>}
          {!compact && !me && !connected && <span className="max-w-[80%] text-[11px] text-muted/70">Если дольше 20 секунд — сети не соединяются напрямую, нужен TURN-релей (см. README)</span>}
          {!compact && !me && connected && camOff && <span className="text-xs text-muted">Камера выключена</span>}
          {!compact && !me && connected && !camOff && <span className="text-xs text-muted">Видео от собеседника пока не поступает</span>}
        </div>
      )}
      {noFrames && (
        <div className="absolute inset-x-3 top-3 rounded-lg bg-black/60 px-3 py-1.5 text-center text-[11px] text-white backdrop-blur">
          Соединение есть, но кадры не идут: у собеседника камера занята другим приложением или вкладка в фоне
        </div>
      )}
      {blocked && !me && (
        <button onClick={() => { ref.current?.play().then(() => setBlocked(false)).catch(() => {}); }} className="btn btn-primary absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><Volume2 size={16} /> Включить видео и звук</button>
      )}
      <div className={cn("absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 font-semibold text-white backdrop-blur", compact ? "max-w-[90%] px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs")}>
        {muted && <MicOff size={compact ? 10 : 12} className="text-rose" />}{sharing && <MonitorUp size={compact ? 10 : 12} className="text-accent" />}
        <span className="truncate">{user.name}{me && " (вы)"}{sharing && !compact && " · экран"}</span>
      </div>
    </div>
  );
}

/** Пригласить в звонок: недавние собеседники + поиск по нику/имени; приглашение уходит уведомлением с кнопкой и сообщением со ссылкой. */
function InvitePopover({ callId, onClose, onCopy, inCall }: { callId: string; onClose: () => void; onCopy: () => void; inCall: Set<string> }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const convs = useConversations(true);
  const search = useQuery({ queryKey: ["invite-search", q], queryFn: () => api.searchUsers(q), enabled: q.trim().length >= 1, staleTime: 10_000 });
  const recent = (convs.data?.items ?? []).filter((c) => c.kind === "dm" && c.peer && c.peer.handle !== "bailanysta").map((c) => c.peer!);
  const list = (q.trim() ? search.data?.items ?? [] : recent).filter((u) => u.handle !== "bailanysta" && !inCall.has(u.id)).slice(0, 8);

  const invite = async (handle: string) => {
    try { await api.inviteToCall(callId, handle); setSent((s) => new Set(s).add(handle)); toast(`Приглашение отправлено @${handle}`, "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Не удалось пригласить", "error"); }
  };

  return (
    <div className="card absolute right-0 top-10 z-40 w-80 p-3 shadow-card" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Пригласить в созвон</span><button onClick={onClose} className="btn btn-ghost btn-icon h-7 w-7"><X size={14} /></button></div>
      <div className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ник или имя…" className="input py-2 pl-8 text-sm" /></div>
      <p className="mt-2 px-1 text-[11px] uppercase tracking-wider text-muted">{q.trim() ? "Найдено" : "Недавние собеседники"}</p>
      <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
        {list.map((u) => (
          <li key={u.id}>
            <button onClick={() => invite(u.handle)} disabled={sent.has(u.handle)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-2 disabled:opacity-60">
              <Avatar user={u} size={26} /><span className="min-w-0 flex-1 truncate">{u.name} <span className="text-muted">@{u.handle}</span></span>
              {sent.has(u.handle) ? <Check size={14} className="text-accent" /> : <UserPlus size={14} className="text-muted" />}
            </button>
          </li>
        ))}
        {!list.length && <li className="px-2 py-3 text-center text-xs text-muted">{q.trim() ? "Никого не нашли" : "Начните вводить ник или имя"}</li>}
      </ul>
      <button onClick={onCopy} className="btn btn-outline mt-2 w-full py-1.5 text-xs"><Copy size={13} /> Скопировать ссылку</button>
    </div>
  );
}
