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

export type Peer = { user: UserDto; stream: MediaStream | null; muted: boolean; camOff: boolean; sharing: boolean; recording: boolean; version: number; connected: boolean };
export type ChatMsg = { id: string; from: UserDto; text: string; at: string };
export type PeerStats = {
  conn: string; ice: string; sig: string;
  /** тип пары кандидатов: host / srflx / relay */
  pair: string | null;
  videoBytes: number; audioBytes: number; framesDecoded: number; fps: number; width: number; height: number;
  rtt: number | null; remoteVideoMuted: boolean | null;
};

/** Запасная конфигурация, если /api/calls/ice недоступен. Основная приходит с сервера (STUN + TURN). */
const FALLBACK_ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
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
  const [stats, setStats] = useState<Record<string, PeerStats>>({});

  const iceRef = useRef<RTCConfiguration>(FALLBACK_ICE);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  /** Поколение соединения с каждым собеседником: answer к чужому поколению игнорируется. */
  const gen = useRef(new Map<string, number>());
  const makingOffer = useRef(new Set<string>());
  const localRef = useRef<MediaStream | null>(null);
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const meRef = useRef(me);
  const stateRef = useRef({ muted, camOff, sharing });
  const onRecordingRef = useRef<((by: string) => void) | null>(null);
  /** Кто-то включил запись: короткий сигнал + голосовое «Идёт запись звонка» + событие для UI. */
  const announceRecording = (by: string) => {
    try {
      const a = new Audio("/sounds/notify.wav"); a.volume = 0.8; a.play().catch(() => {});
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance("Идёт запись звонка"); u.lang = "ru-RU"; u.rate = 1.05;
        setTimeout(() => window.speechSynthesis.speak(u), 350);
      }
    } catch {}
    onRecordingRef.current?.(by);
  };
  const peersRef = useRef(peers);
  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { stateRef.current = { muted, camOff, sharing }; }, [muted, camOff, sharing]);

  const signal = useCallback((type: "offer" | "answer" | "ice" | "chat" | "state", to: string | null, payload: unknown) =>
    api.signal(callId, type, to, payload).catch((e) => console.warn("[call] signal failed", type, e)), [callId]);

  const updatePeer = (id: string, patch: Partial<Peer>) => setPeers((p) => (p[id] ? { ...p, [id]: { ...p[id], ...patch } } : p));
  const ensurePeer = (user: UserDto) => setPeers((p) => (p[user.id] ? p : { ...p, [user.id]: { user, stream: null, muted: false, camOff: false, sharing: false, recording: false, version: 0, connected: false } }));

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
    const pc = new RTCPeerConnection({ ...iceRef.current, iceCandidatePoolSize: 4 });
    pcs.current.set(user.id, pc);
    gen.current.set(user.id, (gen.current.get(user.id) ?? 0) + 1);
    ensurePeer(user);
    // ВАЖНО: локальные дорожки — через addTrack. Только такие трансиверы отвечающая сторона
    // сопоставляет с m-line входящего offer (спецификация WebRTC); addTransceiver дал бы recvonly-ответ
    // и инициатор не получил бы ни звука, ни видео. Для отсутствующих локально видов —
    // трансивер «только приём», чтобы всё равно видеть и слышать собеседника.
    const local = localRef.current;
    const kinds = new Set<string>();
    for (const t of local?.getTracks() ?? []) { pc.addTrack(t, local!); kinds.add(t.kind); }
    for (const kind of ["audio", "video"] as const) if (!kinds.has(kind)) pc.addTransceiver(kind, { direction: "recvonly" });

    // кандидаты копим 120 мс и шлём одной пачкой — вместо десятка запросов один-два
    let batch: RTCIceCandidateInit[] = []; let timer = 0;
    const flush = () => { const c = batch; batch = []; timer = 0; if (c.length) signal("ice", user.id, { candidates: c }); };
    pc.onicecandidate = (e) => { if (e.candidate) { batch.push(e.candidate.toJSON()); if (!timer) timer = window.setTimeout(flush, 120); } else flush(); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      console.info("[call] track ←", user.handle, e.track.kind, "streams:", e.streams.length, "tracks in stream:", stream.getTracks().length);
      // каждая дорожка — новая версия, чтобы плитка перерисовалась (video появляется после audio)
      updatePeer(user.id, { stream, version: Date.now() });
      e.track.onunmute = () => updatePeer(user.id, { version: Date.now() });
      e.track.onmute = () => updatePeer(user.id, { version: Date.now() });
      e.track.onended = () => updatePeer(user.id, { version: Date.now() });
    };
    pc.onconnectionstatechange = () => {
      updatePeer(user.id, { connected: pc.connectionState === "connected" });
      console.info("[call]", user.handle, "connection:", pc.connectionState, "ice:", pc.iceConnectionState);
    };
    pc.oniceconnectionstatechange = () => console.info("[call]", user.handle, "ice:", pc.iceConnectionState);
    return pc;
  }, [signal]);

  const removePeer = useCallback((id: string) => {
    pcs.current.get(id)?.close();
    pcs.current.delete(id);
    pendingIce.current.delete(id);
    setPeers((p) => { const n = { ...p }; delete n[id]; return n; });
  }, []);

  /** Offer собеседнику. restart=true — ICE-restart на том же соединении (без пересоздания). */
  const makeOffer = useCallback(async (user: UserDto, restart = false) => {
    const pc = createPc(user);
    if (makingOffer.current.has(user.id)) return;
    makingOffer.current.add(user.id);
    try {
      const offer = await pc.createOffer(restart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      // offer уходит ДО кандидатов: они появляются асинхронно, но даже если обгонят — буфер на другой стороне их сохранит
      await signal("offer", user.id, { sdp: pc.localDescription, state: stateRef.current, gen: gen.current.get(user.id) ?? 1, restart });
      console.info("[call] offer →", user.handle, restart ? "(ice-restart)" : "", "gen", gen.current.get(user.id));
    } catch (e) { console.warn("[call] makeOffer", e); }
    finally { makingOffer.current.delete(user.id); }
  }, [createPc, signal]);

  const onSignal = useCallback(async (s: SignalDto) => {
    const from = s.from;
    const myId = meRef.current?.id;
    if (!myId || from.id === myId) return;
    try {
      switch (s.type) {
        case "join": {
          // Собеседник вошёл (или перезагрузил страницу): старое соединение с ним больше не валидно
          if (pcs.current.has(from.id)) { pcs.current.get(from.id)!.close(); pcs.current.delete(from.id); pendingIce.current.delete(from.id); }
          ensurePeer(from);
          if (iAmInitiator(from.id)) await makeOffer(from);
          break;
        }
        case "leave": removePeer(from.id); break;
        case "offer": {
          const { sdp, state, gen: theirGen, restart, renegotiate } = s.payload as { sdp: RTCSessionDescriptionInit; state?: Partial<Peer>; gen?: number; restart?: boolean; renegotiate?: boolean };
          let pc = pcs.current.get(from.id);
          if (!pc || pc.connectionState === "closed") pc = createPc(from);
          if (pc.signalingState === "have-local-offer") {
            // встречные offer: невежливый (инициатор) игнорирует чужой, вежливый откатывается и принимает
            if (iAmInitiator(from.id)) { console.info("[call] glare: ignore offer from", from.handle); break; }
            await pc.setLocalDescription({ type: "rollback" });
          }
          // Обычный offer к уже живому соединению (не ICE-restart и не пересогласование) — собеседник начал заново: пересоздаём
          if (!restart && !renegotiate && pc.remoteDescription && pc.signalingState === "stable") {
            pc.close(); pcs.current.delete(from.id); pendingIce.current.delete(from.id); pc = createPc(from);
          }
          await pc.setRemoteDescription(sdp);
          await flushIce(from.id);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await signal("answer", from.id, { sdp: pc.localDescription, state: stateRef.current, gen: theirGen ?? null });
          console.info("[call] answer →", from.handle, "for gen", theirGen, restart ? "(ice-restart)" : "");
          if (state) updatePeer(from.id, { muted: !!state.muted, camOff: !!state.camOff, sharing: !!state.sharing });
          break;
        }
        case "answer": {
          const { sdp, state, gen: forGen } = s.payload as { sdp: RTCSessionDescriptionInit; state?: Partial<Peer>; gen?: number | null };
          const pc = pcs.current.get(from.id);
          const myGen = gen.current.get(from.id);
          if (forGen != null && myGen != null && forGen !== myGen) { console.info("[call] stale answer from", from.handle, "gen", forGen, "≠", myGen); break; }
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(sdp);
            await flushIce(from.id);
            console.info("[call] answer ←", from.handle, "applied");
          } else console.info("[call] answer ←", from.handle, "ignored, state", pc?.signalingState);
          if (state) updatePeer(from.id, { muted: !!state.muted, camOff: !!state.camOff, sharing: !!state.sharing });
          break;
        }
        case "ice": {
          const pc = pcs.current.get(from.id);
          const raw = s.payload as RTCIceCandidateInit | { candidates: RTCIceCandidateInit[] };
          const list = "candidates" in raw ? raw.candidates : [raw];
          if (pc && pc.remoteDescription) for (const c of list) await pc.addIceCandidate(c).catch((e) => console.warn("[call] ice", e));
          else pendingIce.current.set(from.id, [...(pendingIce.current.get(from.id) ?? []), ...list]);
          break;
        }
        case "state": {
          const payload = s.payload as Partial<Peer> & { hello?: boolean };
          ensurePeer(from);
          if (payload.muted !== undefined || payload.camOff !== undefined || payload.sharing !== undefined) {
            updatePeer(from.id, { muted: !!payload.muted, camOff: !!payload.camOff, sharing: !!payload.sharing });
          }
          if (payload.recording !== undefined) {
            const was = peersRef.current[from.id]?.recording ?? false;
            updatePeer(from.id, { recording: !!payload.recording });
            if (payload.recording && !was) announceRecording(from.name);
          }
          // «привет» новичка: если соединения с ним ещё НЕТ вообще (join потерялся) — инициатор шлёт offer.
          // Если соединение уже есть (в любом состоянии) — ничего не трогаем: оно договаривается.
          if (payload.hello && iAmInitiator(from.id) && !pcs.current.has(from.id)) await makeOffer(from);
          break;
        }
        case "chat": {
          const { text } = s.payload as { text: string };
          setChat((c) => (c.some((m) => m.id === s.id) ? c : [...c, { id: s.id, from, text, at: s.createdAt }]));
          break;
        }
        case "state": {
          const payload = s.payload as Partial<Peer> & { hello?: boolean };
          ensurePeer(from);
          updatePeer(from.id, { muted: payload.muted ?? false, camOff: payload.camOff ?? false, sharing: payload.sharing ?? false });
          // новичок поздоровался, а соединения с ним нет — инициатор шлёт offer
          const pc = pcs.current.get(from.id);
          if (payload.hello && iAmInitiator(from.id) && (!pc || !["connected", "connecting"].includes(pc.connectionState))) {
            if (pc) { pc.close(); pcs.current.delete(from.id); }
            await makeOffer(from);
          }
          break;
        }
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

  /** Пересогласование со всеми: после добавления дорожки (включили камеру/микрофон в звонке). */
  const renegotiateAll = useCallback(async () => {
    for (const [id, pc] of pcs.current) {
      const peer = peersRef.current[id];
      if (!peer || pc.signalingState !== "stable") continue;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signal("offer", id, { sdp: pc.localDescription, state: stateRef.current, gen: gen.current.get(id) ?? 1, renegotiate: true });
      } catch (e) { console.warn("[call] renegotiate", e); }
    }
  }, [signal]);

  /** Включить микрофон или камеру: получить дорожку, положить в локальный поток и во все соединения. */
  const enableDevice = useCallback(async (kind: "audio" | "video") => {
    const local = localRef.current ?? new MediaStream();
    localRef.current = local;
    if (local.getTracks().some((t) => t.kind === kind && t.readyState === "live")) {
      local.getTracks().filter((t) => t.kind === kind).forEach((t) => (t.enabled = true));
      if (kind === "audio") setMuted(false); else setCamOff(false);
      return true;
    }
    let track: MediaStreamTrack;
    try {
      const s = kind === "audio"
        ? await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        : await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } });
      track = s.getTracks()[0];
    } catch (e) {
      setError(kind === "audio" ? "Микрофон недоступен или доступ запрещён" : "Камера недоступна или доступ запрещён");
      console.warn("[call] getUserMedia", kind, e);
      return false;
    }
    local.addTrack(track);
    if (kind === "video") camTrack.current = track;
    setLocal(new MediaStream(local.getTracks()));
    if (kind === "audio") setMuted(false); else setCamOff(false);
    // в уже открытых соединениях: заменяем дорожку в трансивере нужного вида и переводим его в sendrecv
    let need = false;
    for (const pc of pcs.current.values()) {
      const tr = pc.getTransceivers().find((t) => (t.receiver.track?.kind === kind || t.sender.track?.kind === kind) && t.currentDirection !== "stopped");
      if (tr) { await tr.sender.replaceTrack(track).catch(() => {}); if (tr.direction !== "sendrecv") { tr.direction = "sendrecv"; need = true; } }
      else { pc.addTrack(track, local); need = true; }
    }
    if (need) await renegotiateAll();
    signal("state", null, { ...stateRef.current, [kind === "audio" ? "muted" : "camOff"]: false });
    return true;
  }, [renegotiateAll, signal]);

  /**
   * Подготовка на экране входа: ICE-конфигурация + выбранные устройства.
   * По умолчанию микрофон и камера выключены — пользователь включает то, что хочет.
   */
  const prepare = useCallback(async (opts: { audio?: boolean; video?: boolean } = {}) => {
    api.iceServers().then((c) => { iceRef.current = c; }).catch(() => { iceRef.current = FALLBACK_ICE; });
    if (!localRef.current) { localRef.current = new MediaStream(); setLocal(localRef.current); }
    if (opts.audio) await enableDevice("audio");
    if (opts.video) await enableDevice("video");
    return localRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Вход в комнату: устройства (если ещё нет) → подписка на сигналы → регистрация → offer тем, для кого мы инициатор. */
  const join = useCallback(async () => {
    if (!me) return;
    setError(null);
    try {
      await prepare();
      if (!localRef.current?.getAudioTracks().length) setMuted(true);
      if (!localRef.current?.getVideoTracks().length) setCamOff(true);

      // Сначала подписка — чтобы не пропустить ответы, потом регистрация
      const es = new EventSource(`/api/calls/${callId}/events`);
      esRef.current = es;
      es.addEventListener("signal", (e) => onSignal(JSON.parse((e as MessageEvent).data)));
      es.addEventListener("participants", (e) => {
        const parts = JSON.parse((e as MessageEvent).data) as CallDto["participants"];
        setCall((c) => (c ? { ...c, participants: parts } : c));
        setPeers((p) => { const n = { ...p }; for (const id of Object.keys(n)) if (!parts.some((x) => x.id === id && x.online)) { pcs.current.get(id)?.close(); pcs.current.delete(id); delete n[id]; } return n; });
      });

      // регистрация — параллельно с открытием потока, без лишней предварительной загрузки комнаты
      const joinedCall = await api.joinCall(callId);
      setCall(joinedCall);
      setJoined(true);
      // соединяемся со всеми, кто уже в комнате: offer шлёт инициатор пары; остальным просто заводим плитку
      for (const p of joinedCall.participants) {
        if (p.id === me.id || !p.online) continue;
        ensurePeer(p);
        if (iAmInitiator(p.id)) await makeOffer(p);
      }
      // «Привет» всем: если чей-то join потерялся, инициатор увидит нас и пришлёт offer
      await signal("state", null, { hello: true, ...stateRef.current });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти в звонок. Разрешите доступ к камере и микрофону.");
    }
  }, [callId, me, makeOffer, onSignal, signal, prepare]);

  // Страховка: инициатор перезапускает ICE, если соединение упало или не собралось за 20 с.
  useEffect(() => {
    if (!joined) return;
    const stuckSince = new Map<string, number>();
    const t = window.setInterval(() => {
      for (const [id, pc] of pcs.current) {
        const st = pc.connectionState;
        if (st === "connected") { stuckSince.delete(id); continue; }
        const first = stuckSince.get(id) ?? Date.now();
        stuckSince.set(id, first);
        const peer = peersRef.current[id];
        const waited = Date.now() - first;
        const broken = st === "failed" || st === "disconnected";
        if (peer && iAmInitiator(id) && (broken || waited > 20_000) && pc.signalingState === "stable") {
          console.warn("[call] ice-restart with", peer.user.handle, st, Math.round(waited / 1000) + "s");
          stuckSince.set(id, Date.now());
          makeOffer(peer.user, true).catch(() => {});
        }
      }
      (window as unknown as { __blPcs?: unknown }).__blPcs = pcs.current;
      // статистика getStats — для панели диагностики
      (async () => {
        const next: Record<string, PeerStats> = {};
        for (const [id, pc] of pcs.current) {
          const st: PeerStats = { conn: pc.connectionState, ice: pc.iceConnectionState, sig: pc.signalingState, pair: null, videoBytes: 0, audioBytes: 0, framesDecoded: 0, fps: 0, width: 0, height: 0, rtt: null, remoteVideoMuted: null };
          const vt = pc.getReceivers().find((r) => r.track.kind === "video")?.track;
          if (vt) st.remoteVideoMuted = vt.muted;
          try {
            const report = await pc.getStats();
            const byId = new Map<string, Record<string, unknown>>();
            report.forEach((r) => byId.set(r.id, r as unknown as Record<string, unknown>));
            report.forEach((r) => {
              const rec = r as unknown as Record<string, unknown>;
              if (rec.type === "inbound-rtp" && rec.kind === "video") { st.videoBytes = Number(rec.bytesReceived ?? 0); st.framesDecoded = Number(rec.framesDecoded ?? 0); st.fps = Number(rec.framesPerSecond ?? 0); st.width = Number(rec.frameWidth ?? 0); st.height = Number(rec.frameHeight ?? 0); }
              if (rec.type === "inbound-rtp" && rec.kind === "audio") st.audioBytes = Number(rec.bytesReceived ?? 0);
              if (rec.type === "candidate-pair" && (rec.nominated || rec.state === "succeeded") && rec.localCandidateId) {
                const l = byId.get(String(rec.localCandidateId)), rm = byId.get(String(rec.remoteCandidateId));
                if (l && rm) st.pair = `${l.candidateType} ↔ ${rm.candidateType}`;
                if (rec.currentRoundTripTime != null) st.rtt = Math.round(Number(rec.currentRoundTripTime) * 1000);
              }
            });
          } catch {}
          next[id] = st;
        }
        setStats(next);
      })();
      (window as unknown as { __blCall?: unknown }).__blCall = Object.fromEntries([...pcs.current].map(([id, pc]) => [id, { conn: pc.connectionState, ice: pc.iceConnectionState, gather: pc.iceGatheringState, sig: pc.signalingState, hasRemote: !!pc.remoteDescription, gen: gen.current.get(id) }]));
    }, 2000);
    return () => clearInterval(t);
  }, [joined, makeOffer]);

  /**
   * Запись: композиция плиток на canvas + микс всех аудиодорожек.
   * Если кто-то показывает экран — экран во весь кадр, камеры полоской снизу; иначе сетка.
   * Кадр рисуется ровно тогда, когда у источника (экран или первая камера) появился новый кадр
   * (requestVideoFrameCallback) и вручную подаётся в поток (captureStream(0) + requestFrame) — без дублей
   * и рывков от таймера. Страховочный таймер держит поток живым, если источник замер или вкладка в фоне.
   */
  const startRecording = useCallback(() => {
    if (typeof MediaRecorder === "undefined") { setError("Этот браузер не поддерживает запись (MediaRecorder)"); return; }
    const W = 1280, H = 720, STRIP = 150;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const videos = () => Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-call-tile]")).filter((v) => v.videoWidth > 0 && v.readyState >= 2);
    const label = (text: string, x: number, y: number, w: number) => {
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x + 8, y - 30, Math.min(w - 16, 260), 24);
      ctx.fillStyle = "#fff"; ctx.font = "13px system-ui"; ctx.fillText(text, x + 14, y - 12);
    };
    const fit = (v: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
      const ar = v.videoWidth / v.videoHeight; let tw = w, th = w / ar; if (th > h) { th = h; tw = h * ar; }
      try { ctx.drawImage(v, x + (w - tw) / 2, y + (h - th) / 2, tw, th); } catch {}
    };
    const draw = () => {
      const vs = videos();
      ctx.fillStyle = "#070b18"; ctx.fillRect(0, 0, W, H);
      const share = vs.find((v) => v.dataset.sharing === "1");
      if (share) {
        const cams = vs.filter((v) => v !== share);
        const mainH = cams.length ? H - STRIP : H;
        fit(share, 0, 0, W, mainH); label(`${share.dataset.callTile} · экран`, 0, mainH, W);
        if (cams.length) {
          const cw = Math.min(200, (W - 16) / cams.length), ch = STRIP - 16;
          cams.forEach((v, i) => { const x = 8 + i * cw; fit(v, x, mainH + 8, cw - 8, ch); label(v.dataset.callTile ?? "", x, mainH + 8 + ch, cw - 8); });
        }
      } else {
        const n = Math.max(vs.length, 1), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
        const cw = W / cols, ch = H / rows;
        vs.forEach((v, i) => { const x = (i % cols) * cw, y = Math.floor(i / cols) * ch; fit(v, x, y, cw, ch); label(v.dataset.callTile ?? "", x, y + ch, cw); });
      }
    };
    const out = canvas.captureStream(0);
    const vtrack = out.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
    let lastDraw = 0;
    const frame = () => { draw(); lastDraw = performance.now(); vtrack.requestFrame?.(); };
    // подписываемся на кадры источника: экран, иначе первая живая камера
    let rvfcId = 0, rvfcEl: HTMLVideoElement | null = null;
    const attach = () => {
      const vs = videos();
      const src = vs.find((v) => v.dataset.sharing === "1") ?? vs[0] ?? null;
      if (src === rvfcEl) return;
      if (rvfcEl && rvfcId) (rvfcEl as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }).cancelVideoFrameCallback?.(rvfcId);
      rvfcEl = src; rvfcId = 0;
      const el = src as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
      if (el?.requestVideoFrameCallback) {
        const loop = () => { frame(); rvfcId = el.requestVideoFrameCallback!(loop); };
        rvfcId = el.requestVideoFrameCallback(loop);
      }
    };
    attach(); frame();
    // страховка: если кадров от источника нет дольше 200 мс (пауза, фон, смена источника) — рисуем сами
    const timer = window.setInterval(() => { attach(); if (performance.now() - lastDraw > 200) frame(); }, 100);
    const ac = new AudioContext();
    ac.resume().catch(() => {});
    const dest = ac.createMediaStreamDestination();
    const addAudio = (s: MediaStream | null) => { if (s && s.getAudioTracks().length) ac.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dest); };
    addAudio(localRef.current);
    Object.values(peersRef.current).forEach((p) => addAudio(p.stream));
    dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));
    const candidates = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
    const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(timer);
      if (rvfcEl && rvfcId) (rvfcEl as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }).cancelVideoFrameCallback?.(rvfcId);
      ac.close().catch(() => {});
      const url = URL.createObjectURL(new Blob(chunks, { type: mime || "video/webm" }));
      setRecordingUrl(url); setRecordingExt(ext); setRecording(false);
      // скачиваем сразу из хука — работает и при выходе из звонка, когда экран уже размонтирован
      const a = document.createElement("a"); a.href = url; a.download = `bailanysta-${callId}.${ext}`; document.body.appendChild(a); a.click(); a.remove();
      signal("state", null, { recording: false });
      stopResolve.current?.(); stopResolve.current = null;
    };
    rec.start(1000);
    recorder.current = rec;
    setRecordingUrl(null); setRecording(true);
    signal("state", null, { recording: true });
    announceRecording(meRef.current?.name ?? "Вы");
  }, [callId, signal]);

  const stopResolve = useRef<(() => void) | null>(null);
  /** Останавливает запись и ждёт, пока файл будет собран и скачан. */
  const stopRecording = useCallback(() => new Promise<void>((resolve) => {
    const rec = recorder.current;
    if (!rec || rec.state !== "recording") { resolve(); return; }
    stopResolve.current = resolve;
    rec.stop();
    setTimeout(resolve, 4000); // страховка
  }), []);

  const leave = useCallback(async () => {
    // 1) запись — пока дорожки ещё живы, иначе файл получится пустым/битым
    await stopRecording();
    // 2) сигналинг и соединения
    esRef.current?.close(); esRef.current = null;
    for (const pc of pcs.current.values()) pc.close();
    pcs.current.clear(); pendingIce.current.clear();
    setPeers({});
    // 3) устройства
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    camTrack.current?.stop();
    localRef.current = null; camTrack.current = null; screenStream.current = null;
    setLocal(null); setJoined(false); setSharing(false);
    try { await api.leaveCall(callId); } catch {}
  }, [callId, stopRecording]);

  useEffect(() => () => { esRef.current?.close(); for (const pc of pcs.current.values()) pc.close(); localRef.current?.getTracks().forEach((t) => t.stop()); screenStream.current?.getTracks().forEach((t) => t.stop()); camTrack.current?.stop(); }, []);

  const toggleMute = useCallback(async () => {
    if (muted && !localRef.current?.getAudioTracks().some((t) => t.readyState === "live")) { await enableDevice("audio"); return; }
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next); signal("state", null, { muted: next });
  }, [muted, signal, enableDevice]);

  const toggleCam = useCallback(async () => {
    if (camOff && !camTrack.current) { await enableDevice("video"); return; }
    const next = !camOff;
    if (camTrack.current) camTrack.current.enabled = !next;
    setCamOff(next); signal("state", null, { camOff: next });
  }, [camOff, signal, enableDevice]);

  /**
   * Заменяем видеодорожку во всех соединениях (камера ↔ экран).
   * Если вошли без камеры, видеоканал был «только приём» — переводим его в sendrecv и пересогласуем,
   * иначе собеседники не получат экран.
   */
  const swapVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    let need = false;
    for (const pc of pcs.current.values()) {
      const tr = pc.getTransceivers().find((t) => (t.receiver.track?.kind === "video" || t.sender.track?.kind === "video") && t.currentDirection !== "stopped");
      if (tr) {
        await tr.sender.replaceTrack(track).catch((e) => console.warn("[call] replaceTrack", e));
        if (track && tr.direction !== "sendrecv") { tr.direction = "sendrecv"; need = true; }
      } else if (track && localRef.current) { pc.addTrack(track, localRef.current); need = true; }
    }
    if (localRef.current) {
      localRef.current.getVideoTracks().forEach((t) => localRef.current!.removeTrack(t));
      if (track) localRef.current.addTrack(track);
      setLocal(new MediaStream(localRef.current.getTracks()));
    }
    if (need) await renegotiateAll();
  }, [renegotiateAll]);

  const stopShare = useCallback(async () => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    await swapVideoTrack(camTrack.current);
    for (const pc of pcs.current.values()) {
      const sender = pc.getSenders().find((x) => x.track?.kind === "video");
      if (sender) { const prm = sender.getParameters(); prm.degradationPreference = "balanced"; if (prm.encodings?.[0]) delete prm.encodings[0].maxBitrate; sender.setParameters(prm).catch(() => {}); }
    }
    setSharing(false); signal("state", null, { sharing: false });
  }, [swapVideoTrack, signal]);

  const startShare = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 }, width: { max: 1920 }, height: { max: 1080 } }, audio: false });
      screenStream.current = s;
      const track = s.getVideoTracks()[0];
      try { track.contentHint = "motion"; } catch {}
      track.onended = () => { stopShare(); };
      await swapVideoTrack(track);
      // для экрана держим разрешение (текст читаем), а не частоту кадров
      for (const pc of pcs.current.values()) {
        const sender = pc.getSenders().find((x) => x.track === track);
        if (sender) { const prm = sender.getParameters(); prm.degradationPreference = "balanced"; if (prm.encodings?.[0]) prm.encodings[0].maxBitrate = 3_000_000; sender.setParameters(prm).catch(() => {}); }
      }
      setSharing(true); signal("state", null, { sharing: true });
    } catch (e) { console.warn("[call] share cancelled", e); }
  }, [swapVideoTrack, signal, stopShare]);

  const sendChat = useCallback(async (text: string) => {
    if (!me || !text.trim()) return;
    const res = await api.signal(callId, "chat", null, { text: text.trim() });
    setChat((c) => [...c, { id: res.id, from: me, text: text.trim(), at: res.createdAt }]);
  }, [callId, me]);


  const onRecording = useCallback((cb: (by: string) => void) => { onRecordingRef.current = cb; }, []);
  const anyoneRecording = recording || Object.values(peers).some((p) => p.recording);
  const recordingBy = recording ? (me?.name ?? "Вы") : Object.values(peers).find((p) => p.recording)?.user.name ?? null;
  return { call, joined, error, local, peers, chat, stats, muted, camOff, sharing, recording, recordingUrl, recordingExt, anyoneRecording, recordingBy, onRecording, prepare, enableDevice, join, leave, toggleMute, toggleCam, startShare, stopShare, sendChat, startRecording, stopRecording };
}
