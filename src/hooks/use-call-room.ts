"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { CallDto, SignalDto, UserDto } from "@/lib/types";

/**
 * Комната звонка на WebRTC (mesh: каждый с каждым).
 * Сигналинг — через наш сервер: POST /api/calls/:id/signal и SSE /api/calls/:id/events.
 * Медиа идёт напрямую между браузерами. STUN — публичные серверы Google (часть протокола WebRTC).
 *
 * Надёжность переговоров:
 *  - ICE-кандидаты, пришедшие раньше offer/answer, буферизуются и применяются после setRemoteDescription;
 *  - встречные offer («glare»): уступает тот, у кого id меньше (rollback), второй offer принимается;
 *  - при обрыве соединения инициатор (меньший id) делает offer с iceRestart;
 *  - каждая новая дорожка от собеседника перерисовывает плитку (version).
 * Экран: заменяем видеодорожку камеры на дорожку экрана (replaceTrack) — без пересогласования.
 * Запись: все плитки на canvas + микс звука через AudioContext → MediaRecorder → файл.
 */

export type Peer = { user: UserDto; stream: MediaStream | null; muted: boolean; camOff: boolean; sharing: boolean; version: number; connected: boolean };
export type ChatMsg = { id: string; from: UserDto; text: string; at: string };

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }],
};

export function useCallRoom(callId: string, me: UserDto | null) {
  const [call, setCall] = useState<CallDto | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingExt, setRecordingExt] = useState("webm");

  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const makingOffer = useRef(new Set<string>());
  const localRef = useRef<MediaStream | null>(null);
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recTimer = useRef<number>(0);
  const meRef = useRef(me);
  const stateRef = useRef({ muted, camOff, sharing });
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { stateRef.current = { muted, camOff, sharing }; }, [muted, camOff, sharing]);

  const signal = useCallback((type: "offer" | "answer" | "ice" | "chat" | "state", to: string | null, payload: unknown) =>
    api.signal(callId, type, to, payload).catch((e) => console.warn("[call] signal failed", type, e)), [callId]);

  const updatePeer = (id: string, patch: Partial<Peer>) => setPeers((p) => (p[id] ? { ...p, [id]: { ...p[id], ...patch } } : p));
  const ensurePeer = (user: UserDto) => setPeers((p) => (p[user.id] ? p : { ...p, [user.id]: { user, stream: null, muted: false, camOff: false, sharing: false, version: 0, connected: false } }));

  /** Инициатор пары — участник с меньшим id (детерминированно для обеих сторон). */
  const iAmInitiator = (otherId: string) => (meRef.current?.id ?? "") < otherId;

  const flushIce = async (id: string) => {
    const pc = pcs.current.get(id);
    const list = pendingIce.current.get(id) ?? [];
    pendingIce.current.delete(id);
    if (!pc || !pc.remoteDescription) return;
    for (const c of list) await pc.addIceCandidate(c).catch((e) => console.warn("[call] ice", e));
  };

  /** Создаёт соединение с участником и подключает локальные дорожки. */
  const createPc = useCallback((user: UserDto) => {
    const existing = pcs.current.get(user.id);
    if (existing && existing.connectionState !== "closed") return existing;
    const pc = new RTCPeerConnection(ICE);
    pcs.current.set(user.id, pc);
    ensurePeer(user);
    // Всегда добавляем аудио и видео трансиверы, чтобы у обеих сторон был симметричный набор
    const audio = localRef.current?.getAudioTracks()[0] ?? null;
    const video = localRef.current?.getVideoTracks()[0] ?? null;
    pc.addTransceiver(audio ? audio : "audio", { direction: "sendrecv", streams: localRef.current ? [localRef.current] : [] });
    pc.addTransceiver(video ? video : "video", { direction: "sendrecv", streams: localRef.current ? [localRef.current] : [] });

    pc.onicecandidate = (e) => { if (e.candidate) signal("ice", user.id, e.candidate.toJSON()); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      // каждая дорожка — новая версия, чтобы плитка перерисовалась (video появляется после audio)
      updatePeer(user.id, { stream, version: Date.now() });
      e.track.onunmute = () => updatePeer(user.id, { version: Date.now() });
      e.track.onmute = () => updatePeer(user.id, { version: Date.now() });
      e.track.onended = () => updatePeer(user.id, { version: Date.now() });
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      updatePeer(user.id, { connected: st === "connected" });
      if (st === "failed" && iAmInitiator(user.id)) {
        // перезапуск ICE — только инициатор, иначе будет glare
        pc.createOffer({ iceRestart: true }).then(async (o) => { await pc.setLocalDescription(o); await signal("offer", user.id, { sdp: pc.localDescription, state: stateRef.current, restart: true }); }).catch(() => {});
      }
    };
    return pc;
  }, [signal]);

  const removePeer = useCallback((id: string) => {
    pcs.current.get(id)?.close();
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    setPeers((p) => { const n = { ...p }; delete n[id]; return n; });
  }, []);

  const makeOffer = useCallback(async (user: UserDto) => {
    const pc = createPc(user);
    if (makingOffer.current.has(user.id)) return;
    makingOffer.current.add(user.id);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // offer уходит ДО кандидатов: они появляются асинхронно, но даже если обгонят — буфер на другой стороне их сохранит
      await signal("offer", user.id, { sdp: pc.localDescription, state: stateRef.current });
    } finally { makingOffer.current.delete(user.id); }
  }, [createPc, signal]);

  const onSignal = useCallback(async (s: SignalDto) => {
    const from = s.from;
    const myId = meRef.current?.id;
    if (!myId || from.id === myId) return;
    try {
      switch (s.type) {
        case "join": {
          ensurePeer(from);
          // Новичок сам пришлёт offer тем, кто уже в комнате; но если по правилу инициатор — мы, шлём сами
          if (iAmInitiator(from.id)) await makeOffer(from);
          break;
        }
        case "leave": removePeer(from.id); break;
        case "offer": {
          const { sdp, state, restart } = s.payload as { sdp: RTCSessionDescriptionInit; state?: Partial<Peer>; restart?: boolean };
          let pc = pcs.current.get(from.id);
          if (!pc || pc.connectionState === "closed") pc = createPc(from);
          const glare = pc.signalingState === "have-local-offer";
          if (glare) {
            if (iAmInitiator(from.id)) break; // невежливый: игнорируем их offer, они примут наш
            await pc.setLocalDescription({ type: "rollback" }); // вежливый: откатываемся и принимаем
          }
          if (!restart && pc.signalingState === "stable" && pc.remoteDescription && pc.connectionState === "connected") {
            // повторный offer к живому соединению (например, после переподключения собеседника) — пересоздаём
            pc.close(); pcs.current.delete(from.id); pc = createPc(from);
          }
          await pc.setRemoteDescription(sdp);
          await flushIce(from.id);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await signal("answer", from.id, { sdp: pc.localDescription, state: stateRef.current });
          if (state) updatePeer(from.id, state);
          break;
        }
        case "answer": {
          const { sdp, state } = s.payload as { sdp: RTCSessionDescriptionInit; state?: Partial<Peer> };
          const pc = pcs.current.get(from.id);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(sdp);
            await flushIce(from.id);
          }
          if (state) updatePeer(from.id, state);
          break;
        }
        case "ice": {
          const pc = pcs.current.get(from.id);
          const cand = s.payload as RTCIceCandidateInit;
          if (pc && pc.remoteDescription) await pc.addIceCandidate(cand).catch((e) => console.warn("[call] ice", e));
          else pendingIce.current.set(from.id, [...(pendingIce.current.get(from.id) ?? []), cand]);
          break;
        }
        case "chat": {
          const { text } = s.payload as { text: string };
          setChat((c) => (c.some((m) => m.id === s.id) ? c : [...c, { id: s.id, from, text, at: s.createdAt }]));
          break;
        }
        case "state": updatePeer(from.id, s.payload as Partial<Peer>); break;
      }
    } catch (e) { console.warn("[call] signal", s.type, e); }
  }, [createPc, removePeer, signal, makeOffer]);

  // Данные комнаты для экрана входа (название, участники) — до подключения к медиа.
  useEffect(() => {
    let alive = true;
    api.call(callId).then((r) => { if (alive) { setCall(r.call); setChat(r.chat.map((h) => ({ id: h.id, from: h.from, text: (h.payload as { text: string }).text, at: h.createdAt }))); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Звонок не найден"); });
    return () => { alive = false; };
  }, [callId]);

  /** Вход в комнату: камера/микрофон → подписка на сигналы → регистрация → offer тем, для кого мы инициатор. */
  const join = useCallback(async () => {
    if (!me) return;
    setError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // без камеры — только звук
        setCamOff(true);
      }
      localRef.current = stream; camTrack.current = stream.getVideoTracks()[0] ?? null;
      setLocal(stream);

      // Сначала подписка — чтобы не пропустить ответы, потом регистрация
      const since = new Date(Date.now() - 1000).toISOString();
      const es = new EventSource(`/api/calls/${callId}/events?since=${encodeURIComponent(since)}`);
      esRef.current = es;
      es.addEventListener("signal", (e) => onSignal(JSON.parse((e as MessageEvent).data)));
      es.addEventListener("participants", (e) => {
        const parts = JSON.parse((e as MessageEvent).data) as CallDto["participants"];
        setCall((c) => (c ? { ...c, participants: parts } : c));
        setPeers((p) => { const n = { ...p }; for (const id of Object.keys(n)) if (!parts.some((x) => x.id === id && x.online)) { pcs.current.get(id)?.close(); pcs.current.delete(id); delete n[id]; } return n; });
      });

      const joinedCall = await api.joinCall(callId);
      setCall(joinedCall);
      setJoined(true);
      // соединяемся со всеми, кто уже в комнате: offer шлёт инициатор пары; остальным просто заводим плитку
      for (const p of joinedCall.participants) {
        if (p.id === me.id || !p.online) continue;
        ensurePeer(p);
        if (iAmInitiator(p.id)) await makeOffer(p);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти в звонок. Разрешите доступ к камере и микрофону.");
    }
  }, [callId, me, makeOffer, onSignal]);

  const leave = useCallback(async () => {
    esRef.current?.close(); esRef.current = null;
    for (const pc of pcs.current.values()) pc.close();
    pcs.current.clear(); pendingIce.current.clear();
    setPeers({});
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    camTrack.current?.stop();
    setLocal(null); setJoined(false);
    if (recorder.current?.state === "recording") recorder.current.stop();
    try { await api.leaveCall(callId); } catch {}
  }, [callId]);

  useEffect(() => () => { esRef.current?.close(); for (const pc of pcs.current.values()) pc.close(); localRef.current?.getTracks().forEach((t) => t.stop()); screenStream.current?.getTracks().forEach((t) => t.stop()); camTrack.current?.stop(); }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next); signal("state", null, { muted: next });
  }, [muted, signal]);

  const toggleCam = useCallback(() => {
    const next = !camOff;
    if (camTrack.current) camTrack.current.enabled = !next;
    setCamOff(next); signal("state", null, { camOff: next });
  }, [camOff, signal]);

  /** Заменяем видеодорожку во всех соединениях (камера ↔ экран). */
  const swapVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    for (const pc of pcs.current.values()) {
      const tr = pc.getTransceivers().find((t) => t.receiver.track?.kind === "video" || t.sender.track?.kind === "video");
      if (tr) await tr.sender.replaceTrack(track).catch((e) => console.warn("[call] replaceTrack", e));
    }
    if (localRef.current) {
      localRef.current.getVideoTracks().forEach((t) => localRef.current!.removeTrack(t));
      if (track) localRef.current.addTrack(track);
      setLocal(new MediaStream(localRef.current.getTracks()));
    }
  }, []);

  const stopShare = useCallback(async () => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    await swapVideoTrack(camTrack.current);
    setSharing(false); signal("state", null, { sharing: false });
  }, [swapVideoTrack, signal]);

  const startShare = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      screenStream.current = s;
      const track = s.getVideoTracks()[0];
      track.onended = () => { stopShare(); };
      await swapVideoTrack(track);
      setSharing(true); signal("state", null, { sharing: true });
    } catch (e) { console.warn("[call] share cancelled", e); }
  }, [swapVideoTrack, signal, stopShare]);

  const sendChat = useCallback(async (text: string) => {
    if (!me || !text.trim()) return;
    const res = await api.signal(callId, "chat", null, { text: text.trim() });
    setChat((c) => [...c, { id: res.id, from: me, text: text.trim(), at: res.createdAt }]);
  }, [callId, me]);

  /** Запись: сетка видео на canvas + микс всех аудиодорожек. */
  const startRecording = useCallback(() => {
    if (typeof MediaRecorder === "undefined") { setError("Этот браузер не поддерживает запись (MediaRecorder)"); return; }
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    const videos = () => Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-call-tile]"));
    recTimer.current = window.setInterval(() => {
      const vs = videos().filter((v) => v.videoWidth > 0 && v.readyState >= 2);
      ctx.fillStyle = "#070b18"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const n = Math.max(vs.length, 1), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const cw = canvas.width / cols, ch = canvas.height / rows;
      vs.forEach((v, i) => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        const ar = v.videoWidth / v.videoHeight, tw = Math.min(cw, ch * ar), th = tw / ar;
        try { ctx.drawImage(v, x + (cw - tw) / 2, y + (ch - th) / 2, tw, th); } catch {}
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x + 8, y + ch - 34, Math.min(cw - 16, 240), 26);
        ctx.fillStyle = "#fff"; ctx.font = "14px system-ui"; ctx.fillText(v.dataset.callTile ?? "", x + 14, y + ch - 15);
      });
    }, 1000 / 15);
    const out = canvas.captureStream(15);
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    const addAudio = (s: MediaStream | null) => { if (s && s.getAudioTracks().length) ac.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dest); };
    addAudio(localRef.current);
    Object.values(peers).forEach((p) => addAudio(p.stream));
    dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(recTimer.current); ac.close();
      setRecordingUrl(URL.createObjectURL(new Blob(chunks, { type: mime || "video/webm" })));
      setRecordingExt(ext);
      setRecording(false);
    };
    rec.start(1000);
    recorder.current = rec;
    setRecordingUrl(null); setRecording(true);
  }, [peers]);

  const stopRecording = useCallback(() => { recorder.current?.stop(); }, []);

  return { call, joined, error, local, peers, chat, muted, camOff, sharing, recording, recordingUrl, recordingExt, join, leave, toggleMute, toggleCam, startShare, stopShare, sendChat, startRecording, stopRecording };
}
