"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { CallDto, SignalDto, UserDto } from "@/lib/types";

/**
 * Комната звонка на WebRTC (mesh: каждый с каждым).
 * Сигналинг — через наш сервер: POST /api/calls/:id/signal и SSE /api/calls/:id/events.
 * Медиа идёт напрямую между браузерами. STUN — публичные серверы Google (часть протокола WebRTC).
 *
 * Правило инициатора: тот, кто присоединился позже, шлёт offer уже присутствующим.
 * Экран: заменяем видеодорожку камеры на дорожку экрана (replaceTrack) — без пересогласования.
 * Запись: собираем все видео в canvas + микс звука через AudioContext → MediaRecorder → .webm.
 */

export type Peer = { user: UserDto; stream: MediaStream | null; muted: boolean; camOff: boolean; sharing: boolean };
export type ChatMsg = { id: string; from: UserDto; text: string; at: string };

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

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

  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const localRef = useRef<MediaStream | null>(null);
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recTimer = useRef<number>(0);
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);

  const signal = useCallback((type: "offer" | "answer" | "ice" | "chat" | "state", to: string | null, payload: unknown) =>
    api.signal(callId, type, to, payload).catch(() => {}), [callId]);

  const updatePeer = (id: string, patch: Partial<Peer>) => setPeers((p) => (p[id] ? { ...p, [id]: { ...p[id], ...patch } } : p));

  /** Создаёт соединение с участником и подключает локальные дорожки. */
  const createPc = useCallback((user: UserDto) => {
    const existing = pcs.current.get(user.id);
    if (existing) return existing;
    const pc = new RTCPeerConnection(ICE);
    pcs.current.set(user.id, pc);
    setPeers((p) => ({ ...p, [user.id]: p[user.id] ?? { user, stream: null, muted: false, camOff: false, sharing: false } }));
    for (const t of localRef.current?.getTracks() ?? []) pc.addTrack(t, localRef.current!);
    pc.onicecandidate = (e) => { if (e.candidate) signal("ice", user.id, e.candidate.toJSON()); };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      updatePeer(user.id, { stream });
      stream.onremovetrack = () => updatePeer(user.id, { stream: new MediaStream(stream.getTracks()) });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") { pc.restartIce(); }
      if (pc.connectionState === "closed" || pc.connectionState === "disconnected") { /* участник переподключится сам */ }
    };
    return pc;
  }, [signal]);

  const removePeer = useCallback((id: string) => {
    pcs.current.get(id)?.close();
    pcs.current.delete(id);
    setPeers((p) => { const n = { ...p }; delete n[id]; return n; });
  }, []);

  const makeOffer = useCallback(async (user: UserDto) => {
    const pc = createPc(user);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await signal("offer", user.id, { sdp: pc.localDescription, state: { muted, camOff, sharing } });
  }, [createPc, signal, muted, camOff, sharing]);

  const onSignal = useCallback(async (s: SignalDto) => {
    const from = s.from;
    if (from.id === meRef.current?.id) return;
    try {
      switch (s.type) {
        case "join": {
          // Новичок сам пришлёт offer; мы лишь заводим карточку участника
          setPeers((p) => ({ ...p, [from.id]: p[from.id] ?? { user: from, stream: null, muted: false, camOff: false, sharing: false } }));
          break;
        }
        case "leave": removePeer(from.id); break;
        case "offer": {
          const { sdp, state } = s.payload as { sdp: RTCSessionDescriptionInit; state?: Partial<Peer> };
          // Если соединение уже есть (переподключение) — пересоздаём
          if (pcs.current.has(from.id)) { pcs.current.get(from.id)!.close(); pcs.current.delete(from.id); }
          const pc = createPc(from);
          await pc.setRemoteDescription(sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await signal("answer", from.id, { sdp: pc.localDescription, state: { muted, camOff, sharing } });
          if (state) updatePeer(from.id, state);
          break;
        }
        case "answer": {
          const { sdp, state } = s.payload as { sdp: RTCSessionDescriptionInit; state?: Partial<Peer> };
          const pc = pcs.current.get(from.id);
          if (pc && pc.signalingState !== "stable") await pc.setRemoteDescription(sdp);
          if (state) updatePeer(from.id, state);
          break;
        }
        case "ice": {
          const pc = pcs.current.get(from.id);
          if (pc) await pc.addIceCandidate(s.payload as RTCIceCandidateInit).catch(() => {});
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
  }, [createPc, removePeer, signal, muted, camOff, sharing]);

  /** Вход в комнату: камера/микрофон → регистрация → offer всем присутствующим → подписка на сигналы. */
  const join = useCallback(async () => {
    if (!me) return;
    setError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        // без камеры — попробуем только звук
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setCamOff(true);
      }
      localRef.current = stream; camTrack.current = stream.getVideoTracks()[0] ?? null;
      setLocal(stream);
      const { call: c, chat: history } = await api.call(callId);
      setCall(c);
      setChat(history.map((h) => ({ id: h.id, from: h.from, text: (h.payload as { text: string }).text, at: h.createdAt })));
      const joinedCall = await api.joinCall(callId);
      setCall(joinedCall);
      setJoined(true);
      // offer всем, кто уже в комнате
      for (const p of joinedCall.participants) if (p.id !== me.id && p.online) await makeOffer(p);

      const es = new EventSource(`/api/calls/${callId}/events?since=${encodeURIComponent(new Date(Date.now() - 2000).toISOString())}`);
      esRef.current = es;
      es.addEventListener("signal", (e) => onSignal(JSON.parse((e as MessageEvent).data)));
      es.addEventListener("participants", (e) => {
        const parts = JSON.parse((e as MessageEvent).data) as CallDto["participants"];
        setCall((c) => (c ? { ...c, participants: parts } : c));
        // ушедшие/офлайн — убираем
        setPeers((p) => { const n = { ...p }; for (const id of Object.keys(n)) if (!parts.some((x) => x.id === id && x.online)) { pcs.current.get(id)?.close(); pcs.current.delete(id); delete n[id]; } return n; });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти в звонок. Разрешите доступ к камере и микрофону.");
    }
  }, [callId, me, makeOffer, onSignal]);

  const leave = useCallback(async () => {
    esRef.current?.close(); esRef.current = null;
    for (const pc of pcs.current.values()) pc.close();
    pcs.current.clear();
    setPeers({});
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    setLocal(null); setJoined(false);
    if (recorder.current?.state === "recording") recorder.current.stop();
    try { await api.leaveCall(callId); } catch {}
  }, [callId]);

  useEffect(() => () => { esRef.current?.close(); for (const pc of pcs.current.values()) pc.close(); localRef.current?.getTracks().forEach((t) => t.stop()); screenStream.current?.getTracks().forEach((t) => t.stop()); }, []);

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
  const swapVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    for (const pc of pcs.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video" || (s.track === null && track));
      if (sender) sender.replaceTrack(track);
      else if (track && localRef.current) pc.addTrack(track, localRef.current);
    }
    if (localRef.current) {
      localRef.current.getVideoTracks().forEach((t) => localRef.current!.removeTrack(t));
      if (track) localRef.current.addTrack(track);
      setLocal(new MediaStream(localRef.current.getTracks()));
    }
  }, []);

  const stopShare = useCallback(() => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    swapVideoTrack(camTrack.current);
    setSharing(false); signal("state", null, { sharing: false });
  }, [swapVideoTrack, signal]);

  const startShare = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      screenStream.current = s;
      const track = s.getVideoTracks()[0];
      track.onended = () => stopShare();
      swapVideoTrack(track);
      setSharing(true); signal("state", null, { sharing: true });
    } catch { /* пользователь отменил */ }
  }, [swapVideoTrack, signal, stopShare]);

  const sendChat = useCallback(async (text: string) => {
    if (!me || !text.trim()) return;
    const res = await api.signal(callId, "chat", null, { text: text.trim() });
    setChat((c) => [...c, { id: res.id, from: me, text: text.trim(), at: res.createdAt }]);
  }, [callId, me]);

  /** Запись: сетка видео на canvas + микс всех аудиодорожек. */
  const startRecording = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    const videos = () => Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-call-tile]"));
    recTimer.current = window.setInterval(() => {
      const vs = videos().filter((v) => v.videoWidth > 0);
      ctx.fillStyle = "#070b18"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const n = Math.max(vs.length, 1), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      const cw = canvas.width / cols, ch = canvas.height / rows;
      vs.forEach((v, i) => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        const ar = v.videoWidth / v.videoHeight, tw = Math.min(cw, ch * ar), th = tw / ar;
        ctx.drawImage(v, x + (cw - tw) / 2, y + (ch - th) / 2, tw, th);
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x + 8, y + ch - 34, Math.min(cw - 16, 220), 26);
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
    const chunks: Blob[] = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
    const rec = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(recTimer.current); ac.close();
      setRecordingUrl(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));
      setRecording(false);
    };
    rec.start(1000);
    recorder.current = rec;
    setRecordingUrl(null); setRecording(true);
  }, [peers]);

  const stopRecording = useCallback(() => { recorder.current?.stop(); }, []);

  return { call, joined, error, local, peers, chat, muted, camOff, sharing, recording, recordingUrl, join, leave, toggleMute, toggleCam, startShare, stopShare, sendChat, startRecording, stopRecording };
}
