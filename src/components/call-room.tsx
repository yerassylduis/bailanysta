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
import { useT } from "./locale-provider";
import { cn, fmtTime } from "@/lib/format";
import type { UserDto } from "@/lib/types";

/** Комната звонка: сетка видео, панель управления, чат справа. */
export function CallRoom({ id }: { id: string }) {
  const { t, locale } = useT();
  const { data: me, isPending } = useMe();
  const room = useCallRoom(id, me?.user ?? null);
  const toast = useToast();
  const router = useRouter();
  // Заранее запрашиваем камеру/микрофон на экране входа — вход по кнопке становится мгновенным
  const { prepare, onRecording, joined } = room;
  useEffect(() => { if (me?.user && !joined) prepare().catch(() => {}); }, [me?.user, joined, prepare]);
  const [wantMic, setWantMic] = useState(false);
  const [wantCam, setWantCam] = useState(false);
  const [busyDev, setBusyDev] = useState<"audio" | "video" | null>(null);
  const toggleWant = async (kind: "audio" | "video") => {
    const on = kind === "audio" ? !wantMic : !wantCam;
    if (on) {
      setBusyDev(kind);
      const ok = await room.enableDevice(kind);
      setBusyDev(null);
      if (!ok) return;
    } else {
      room.local?.getTracks().filter((t) => t.kind === kind).forEach((t) => { t.stop(); room.local?.removeTrack(t); });
    }
    if (kind === "audio") setWantMic(on); else setWantCam(on);
  };
  // Кто-то включил запись — всплывашка (звук и голос — в хуке)
  useEffect(() => { onRecording((by) => toast(t("calls.recordingToast", { by }), "error")); }, [onRecording, toast, t]);
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
    } catch { toast(t("calls.fullscreenDenied")); }
  };
  const [text, setText] = useState("");
  const chatBottom = useRef<HTMLDivElement>(null);
  // Непрочитанные в чате — производное: сколько сообщений пришло с момента, когда чат последний раз был открыт.
  const [seen, setSeen] = useState(0);
  const unread = chatOpen ? 0 : Math.max(0, room.chat.length - seen);
  const openChat = (o: boolean) => { setChatOpen(o); setSeen(room.chat.length); };

  useEffect(() => { if (chatOpen) chatBottom.current?.scrollIntoView({ block: "end" }); }, [chatOpen, room.chat.length]);

  if (!isPending && !me?.user) return <EmptyState title={t("calls.loginToJoin")} text={t("calls.loginToJoinText")} action={<Link href="/login" className="btn btn-primary">{t("nav.login")}</Link>} />;

  const copyLink = async () => { try { await navigator.clipboard.writeText(`${location.origin}/calls/${id}`); toast(t("calls.linkCopied"), "success"); } catch { toast(`${location.origin}/calls/${id}`); } };
  const sendChat = async () => { const msg = text.trim(); if (!msg) return; await room.sendChat(msg); setText(""); };

  const tiles: Array<{ id: string; user: UserDto; stream: MediaStream | null; me?: boolean; muted: boolean; camOff: boolean; sharing: boolean; version: number; connected: boolean }> = [
    ...(me?.user ? [{ id: "me", user: me.user, stream: room.local, me: true, muted: room.muted, camOff: room.camOff, sharing: room.sharing, version: 0, connected: true }] : []),
    ...Object.values(room.peers).map((p: Peer) => ({ id: p.user.id, user: p.user, stream: p.stream, muted: p.muted, camOff: p.camOff, sharing: p.sharing, version: p.version, connected: p.connected })),
  ];
  const n = tiles.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  // Сцена: закреплённый участник, иначе тот, кто показывает экран. Свой экран на сцену не ставим:
  // если на нём открыт этот же звонок, получается бесконечное «зеркало» — как в Meet, своя презентация идёт миниатюрой.
  // Во время записи своя демонстрация тоже идёт на сцену — в записи и на экране экран занимает всё
  const stageId = pinned ?? tiles.find((x) => x.sharing && !x.me)?.id ?? (room.recording && room.sharing ? "me" : null);
  const stage = tiles.find((x) => x.id === stageId) ?? null;
  const thumbs = stage ? tiles.filter((x) => x.id !== stage.id) : [];

  // Экран входа
  if (!room.joined) {
    return (
      <div className="mx-auto max-w-lg pt-6">
        <Link href="/calls" className="btn btn-ghost -ml-2 mb-3 px-2 text-sm"><ArrowLeft size={16} /> {t("calls.allCalls")}</Link>
        <div className="card p-6 text-center">
          {wantCam && room.local && room.local.getVideoTracks().length > 0 ? (
            <video ref={previewRef} autoPlay playsInline muted className="mx-auto mb-3 aspect-video w-full max-w-sm rounded-xl bg-black object-cover scale-x-[-1]" />
          ) : (
            <div className="mx-auto mb-3 flex aspect-video w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl bg-bg-2 text-muted">
              <VideoOff size={28} />
              <span className="text-xs">{t("calls.camOff")}</span>
            </div>
          )}
          <h1 className="font-display text-xl font-bold">{room.call?.title ?? t("calls.roomTitle")}</h1>
          <p className="mt-1 font-mono text-sm text-muted">{id}</p>
          <p className="mt-3 text-sm text-ink-2">{t("calls.chooseDevices")}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => toggleWant("audio")} disabled={busyDev !== null} className={cn("btn gap-2 px-4 py-2.5", wantMic ? "btn-primary" : "btn-outline")}>
              {busyDev === "audio" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : wantMic ? <Mic size={18} /> : <MicOff size={18} />}
              {wantMic ? t("calls.micOn") : t("calls.micOff")}
            </button>
            <button onClick={() => toggleWant("video")} disabled={busyDev !== null} className={cn("btn gap-2 px-4 py-2.5", wantCam ? "btn-primary" : "btn-outline")}>
              {busyDev === "video" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : wantCam ? <Video size={18} /> : <VideoOff size={18} />}
              {wantCam ? t("calls.camOn") : t("calls.camOff")}
            </button>
          </div>
          {room.error && <p className="mt-3 rounded-xl bg-rose-soft p-3 text-sm text-rose">{room.error}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={room.join} className="btn btn-primary px-6 py-3"><Video size={18} /> {t("calls.join")}</button>
            <button onClick={copyLink} className="btn btn-outline py-3"><Copy size={16} /> {t("calls.copyLink")}</button>
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
        {room.anyoneRecording && <span className="flex items-center gap-1.5 rounded-full bg-rose px-2.5 py-1 text-xs font-semibold text-white"><Disc size={12} className="animate-pulse" /> {t("calls.recordingBadge")}{room.recordingBy ? ` · ${room.recordingBy}` : ""}</span>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted"><Users size={14} /> {tiles.length}</span>
        <button onClick={() => toggleFullscreen(rootRef.current)} className="btn btn-outline btn-icon h-9 w-9" aria-label={fs ? t("calls.exitFullscreen") : t("calls.callFullscreen")} title={fs ? t("calls.collapse") : t("calls.fullscreen")}>{fs ? <Minimize size={16} /> : <Maximize size={16} />}</button>
        <button onClick={() => setInviteOpen(true)} className="btn btn-primary px-3 py-1.5 text-xs"><UserPlus size={14} /> {t("calls.invite")}</button>
        {inviteOpen && <InvitePopover callId={id} onClose={() => setInviteOpen(false)} onCopy={copyLink} inCall={new Set(tiles.map((x) => x.user.id))} />}
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        {stage ? (
          /* Режим презентации: сцена во всю область + мини-плитки справа (на телефоне — снизу) */
          <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
            <div ref={stageRef} className={cn("group relative min-h-0 flex-1", fsTarget === "stage" && "bg-black")}>
              <Tile user={stage.user} stream={stage.stream} me={stage.me} muted={stage.muted} camOff={stage.camOff} sharing={stage.sharing} version={stage.version} connected={stage.connected} stats={stage.me ? undefined : room.stats[stage.id]} fit="contain" />
              <div className="absolute right-2 top-2 flex gap-1.5 opacity-80 transition group-hover:opacity-100">
                {pinned && <button onClick={() => setPinned(null)} className="btn bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur hover:bg-black/70"><Pin size={13} /> {t("calls.unpin")}</button>}
                <button onClick={() => toggleFullscreen(stageRef.current)} className="btn bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur hover:bg-black/70" title={fsTarget === "stage" ? t("calls.collapseStage") : t("calls.stageFullscreen")}>
                  {fsTarget === "stage" ? <><Minimize size={13} /> {t("calls.collapse")}</> : <><Maximize size={13} /> {t("calls.fullscreenShort")}</>}
                </button>
              </div>
            </div>
            {thumbs.length > 0 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto md:w-44 md:flex-col md:overflow-y-auto lg:w-52">
                {thumbs.map((tile) => (
                  <button key={tile.id} onClick={() => setPinned(tile.id)} className="relative aspect-video w-40 shrink-0 md:w-full" title={t("calls.showLarge")}>
                    <Tile user={tile.user} stream={tile.stream} me={tile.me} muted={tile.muted} camOff={tile.camOff} sharing={tile.sharing} version={tile.version} connected={tile.connected} stats={tile.me ? undefined : room.stats[tile.id]} compact />
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
                  <MonitorUp size={14} /> {t("calls.youShareScreen")}
                  <button onClick={() => setPinned("me")} className="rounded-full bg-black/20 px-2 py-0.5 hover:bg-black/30">{t("calls.showLarge")}</button>
                  <button onClick={room.stopShare} className="rounded-full bg-black/20 px-2 py-0.5 hover:bg-black/30">{t("calls.stop")}</button>
                </span>
              </div>
            )}
            {tiles.map((tile) => (
              <div key={tile.id} className="group relative min-h-0" onDoubleClick={() => setPinned(tile.id)}>
                <Tile user={tile.user} stream={tile.stream} me={tile.me} muted={tile.muted} camOff={tile.camOff} sharing={tile.sharing} version={tile.version} connected={tile.connected} stats={tile.me ? undefined : room.stats[tile.id]} />
                {tiles.length > 1 && <button onClick={() => setPinned(tile.id)} className="btn absolute right-2 top-2 bg-black/55 px-2.5 py-1 text-xs text-white opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-black/70" title={t("calls.pinLarge")}><Pin size={13} /> {t("calls.large")}</button>}
              </div>
            ))}
          </div>
        )}

        {/* Чат */}
        <aside className={cn("card flex w-full flex-col overflow-hidden md:w-80", chatOpen ? "absolute inset-x-3 bottom-24 top-20 z-30 flex md:static md:inset-auto" : "hidden")}>
          <header className="flex items-center justify-between border-b border-line px-3 py-2"><span className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} /> {t("calls.callChat")}</span><button onClick={() => openChat(false)} className="btn btn-ghost btn-icon h-7 w-7 md:hidden" aria-label={t("common.close")}>✕</button></header>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
            {room.chat.length === 0 && <p className="py-6 text-center text-xs text-muted">{t("calls.chatEmpty")}</p>}
            {room.chat.map((m) => (
              <div key={m.id} className="flex gap-2">
                <Avatar user={m.from} size={24} />
                <div className="min-w-0"><span className="text-xs font-semibold">{m.from.name.split(/\s+/)[0]}</span> <span className="text-[10px] text-muted">{fmtTime(m.at, locale)}</span><p className="leading-snug" style={{ overflowWrap: "anywhere" }}>{m.text}</p></div>
              </div>
            ))}
            <div ref={chatBottom} />
          </div>
          <div className="flex items-center gap-1.5 border-t border-line p-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} placeholder={t("calls.messagePlaceholder")} className="input py-2 text-sm" />
            <button onClick={sendChat} disabled={!text.trim()} className="btn btn-primary btn-icon h-9 w-9"><Send size={15} /></button>
          </div>
        </aside>
      </div>

      {diagOpen && (
        <div className="card p-3 text-xs">
          <div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1.5 font-semibold"><Activity size={14} className="text-accent" /> {t("calls.diagnostics")}</span><button onClick={() => setDiagOpen(false)} className="btn btn-ghost btn-icon h-6 w-6" aria-label={t("common.close")}>✕</button></div>
          {Object.keys(room.stats).length === 0 && <p className="text-muted">{t("calls.noPeers")}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(room.stats).map(([id, st]) => {
              const name = room.peers[id]?.user.name ?? id;
              const noVideo = st.conn === "connected" && st.framesDecoded === 0;
              return (
                <div key={id} className="rounded-xl bg-bg-2 p-2.5 font-mono text-[11px] leading-relaxed">
                  <div className="mb-1 font-sans text-xs font-semibold">{name}</div>
                  <div>{t("calls.diagState")}: <b className={st.conn === "connected" ? "text-accent" : "text-rose"}>{st.conn}</b> · ice: {st.ice} · sdp: {st.sig}</div>
                  <div>{t("calls.diagRoute")}: {st.pair ?? "—"}{st.rtt != null ? ` · ${st.rtt} ${t("calls.diagMs")}` : ""}</div>
                  <div>{t("calls.diagVideo")}: {st.width}×{st.height} · {st.fps || 0} fps · {t("calls.diagFrames")} {st.framesDecoded} · {(st.videoBytes / 1024).toFixed(0)} {t("calls.diagKB")}</div>
                  <div>{t("calls.diagAudio")}: {(st.audioBytes / 1024).toFixed(0)} {t("calls.diagKB")} · {t("calls.diagVideoTrack")} {st.remoteVideoMuted == null ? t("calls.diagTrackNone") : st.remoteVideoMuted ? t("calls.diagTrackMuted") : t("calls.diagTrackActive")}</div>
                  {noVideo && <div className="mt-1 font-sans text-[11px] text-saffron">{t("calls.diagNoFrames")}</div>}
                  {st.conn !== "connected" && <div className="mt-1 font-sans text-[11px] text-saffron">{t("calls.diagNoConn")}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Панель управления */}
      <footer className="card flex flex-wrap items-center justify-center gap-2 p-2 pb-safe">
        <Ctl on={!room.muted} onClick={room.toggleMute} label={room.muted ? t("calls.micEnable") : t("calls.micDisable")}>{room.muted ? <MicOff size={20} /> : <Mic size={20} />}</Ctl>
        <Ctl on={!room.camOff} onClick={room.toggleCam} label={room.camOff ? t("calls.camEnable") : t("calls.camDisable")}>{room.camOff ? <VideoOff size={20} /> : <Video size={20} />}</Ctl>
        <Ctl on={room.sharing} accent onClick={room.sharing ? room.stopShare : room.startShare} label={room.sharing ? t("calls.shareStop") : t("calls.shareStart")}>{room.sharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}</Ctl>
        <Ctl on={room.recording} danger onClick={room.recording ? room.stopRecording : room.startRecording} label={room.recording ? t("calls.recStop") : t("calls.recStart")}>{room.recording ? <Square size={18} /> : <Circle size={20} />}</Ctl>
        <button onClick={() => setDiagOpen((o) => !o)} className={cn("btn btn-outline btn-icon h-12 w-12", diagOpen && "bg-accent-soft border-accent")} aria-label={t("calls.diagShort")} title={t("calls.diagnostics")}><Activity size={20} /></button>
        <button onClick={() => openChat(!chatOpen)} className={cn("btn btn-outline relative btn-icon h-12 w-12", chatOpen && "bg-accent-soft border-accent")} aria-label={t("calls.chat")}><MessageSquare size={20} />{unread > 0 && !chatOpen && <span className="absolute -right-1 -top-1 rounded-full bg-rose px-1.5 text-[10px] font-bold text-white">{unread}</span>}</button>
        {room.recording && <span className="flex items-center gap-1.5 text-xs font-semibold text-rose"><span className="h-2 w-2 animate-pulse rounded-full bg-rose" /> {t("calls.recordingNow")}</span>}
        {room.recordingUrl && <a href={room.recordingUrl} download={`bailanysta-${id}.${room.recordingExt}`} className="btn btn-outline gap-1.5 text-xs"><Download size={14} /> {t("calls.downloadRecording")}</a>}
        <button onClick={leaveAndGo} className="btn ml-2 bg-rose px-5 text-white hover:brightness-110"><PhoneOff size={18} /> {t("calls.leave")}</button>
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
  const { t } = useT();
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) { el.srcObject = stream; console.info("[call] tile", user.handle, "srcObject set:", stream ? stream.getTracks().map((t) => t.kind).join("+") : "null"); }
    // Автовоспроизведение со звуком браузер может запретить — тогда покажем кнопку
    // AbortError — нормальная отмена play() при смене дорожек, это не блокировка автовоспроизведения
    el.play().then(() => setBlocked(false)).catch((e) => { if (e?.name === "AbortError") return; console.warn("[call] play blocked", user.handle, e?.name); setBlocked(true); });
  }, [stream, version, user.handle]);
  const videoTrack = stream?.getVideoTracks()[0];
  // при демонстрации показываем видео, даже если камера участника выключена — это его экран
  const hasVideo = !!videoTrack && videoTrack.readyState === "live" && !videoTrack.muted && (!camOff || sharing);
  const noFrames = !compact && !me && connected && hasVideo && stats && stats.framesDecoded === 0 && stats.videoBytes === 0;
  return (
    <div className={cn("relative h-full min-h-0 w-full overflow-hidden border border-line bg-black", compact ? "rounded-xl" : "rounded-2xl")}>
      <video ref={ref} data-call-tile={user.name} data-sharing={sharing ? "1" : undefined} autoPlay playsInline muted={me} className={cn("h-full w-full", fit === "contain" || sharing ? "object-contain" : "object-cover", !hasVideo && "opacity-0", me && !sharing && "scale-x-[-1]")} />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-2 px-4 text-center">
          <Avatar user={user} size={compact ? 36 : 72} />
          {!compact && !me && !connected && <span className="text-xs text-muted">{t("calls.connecting")}</span>}
          {!compact && !me && !connected && <span className="max-w-[80%] text-[11px] text-muted/70">{t("calls.connectingHint")}</span>}
          {!compact && !me && connected && camOff && <span className="text-xs text-muted">{t("calls.camOff")}</span>}
          {!compact && !me && connected && !camOff && <span className="text-xs text-muted">{t("calls.noVideoYet")}</span>}
        </div>
      )}
      {noFrames && (
        <div className="absolute inset-x-3 top-3 rounded-lg bg-black/60 px-3 py-1.5 text-center text-[11px] text-white backdrop-blur">
          {t("calls.noFramesHint")}
        </div>
      )}
      {blocked && !me && (
        <button onClick={() => { ref.current?.play().then(() => setBlocked(false)).catch(() => {}); }} className="btn btn-primary absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><Volume2 size={16} /> {t("calls.enableAv")}</button>
      )}
      <div className={cn("absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 font-semibold text-white backdrop-blur", compact ? "max-w-[90%] px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs")}>
        {muted && <MicOff size={compact ? 10 : 12} className="text-rose" />}{sharing && <MonitorUp size={compact ? 10 : 12} className="text-accent" />}
        <span className="truncate">{user.name}{me && ` (${t("common.you")})`}{sharing && !compact && ` · ${t("calls.screen")}`}</span>
      </div>
    </div>
  );
}

/** Пригласить в звонок: недавние собеседники + поиск по нику/имени; приглашение уходит уведомлением с кнопкой и сообщением со ссылкой. */
function InvitePopover({ callId, onClose, onCopy, inCall }: { callId: string; onClose: () => void; onCopy: () => void; inCall: Set<string> }) {
  const { t } = useT();
  const toast = useToast();
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const convs = useConversations(true);
  const search = useQuery({ queryKey: ["invite-search", q], queryFn: () => api.searchUsers(q), enabled: q.trim().length >= 1, staleTime: 10_000 });
  const recent = (convs.data?.items ?? []).filter((c) => c.kind === "dm" && c.peer && c.peer.handle !== "bailanysta").map((c) => c.peer!);
  const list = (q.trim() ? search.data?.items ?? [] : recent).filter((u) => u.handle !== "bailanysta" && !inCall.has(u.id)).slice(0, 8);

  const invite = async (handle: string) => {
    try { await api.inviteToCall(callId, handle); setSent((s) => new Set(s).add(handle)); toast(t("calls.inviteSent", { handle }), "success"); }
    catch (e) { toast(e instanceof Error ? e.message : t("calls.inviteFailed"), "error"); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm sm:items-center sm:pt-4" onClick={onClose} role="dialog" aria-label={t("calls.inviteTitle")}>
    <div className="card fade-in w-full max-w-sm p-4 shadow-card" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">{t("calls.inviteTitle")}</span><button onClick={onClose} className="btn btn-ghost btn-icon h-7 w-7" aria-label={t("common.close")}><X size={14} /></button></div>
      <div className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("calls.searchPlaceholder")} className="input py-2 pl-8 text-sm" /></div>
      <p className="mt-2 px-1 text-[11px] uppercase tracking-wider text-muted">{q.trim() ? t("calls.found") : t("calls.recentPeers")}</p>
      <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
        {list.map((u) => (
          <li key={u.id}>
            <button onClick={() => invite(u.handle)} disabled={sent.has(u.handle)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-2 disabled:opacity-60">
              <Avatar user={u} size={26} /><span className="min-w-0 flex-1 truncate">{u.name} <span className="text-muted">@{u.handle}</span></span>
              {sent.has(u.handle) ? <Check size={14} className="text-accent" /> : <UserPlus size={14} className="text-muted" />}
            </button>
          </li>
        ))}
        {!list.length && <li className="px-2 py-3 text-center text-xs text-muted">{q.trim() ? t("calls.nobodyFound") : t("calls.startTyping")}</li>}
      </ul>
      <button onClick={onCopy} className="btn btn-outline mt-2 w-full py-1.5 text-xs"><Copy size={13} /> {t("calls.copyLink")}</button>
      <p className="mt-2 text-center text-[11px] text-muted">{t("calls.inviteHint")}</p>
    </div>
    </div>
  );
}
