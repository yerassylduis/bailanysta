"use client";

/**
 * Звук уведомления. Файл — public/sounds/notify.wav (0,2 с).
 * Браузер разрешает звук только после первого взаимодействия со страницей,
 * поэтому ошибку воспроизведения глушим. Выключается переключателем (localStorage bl_sound=off).
 */
export const SOUND_KEY = "bl_sound";
const EVENT = "bl-sound-change";

let audio: HTMLAudioElement | null = null;
let last = 0;

export function soundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch {}
  window.dispatchEvent(new Event(EVENT));
  if (on) playNotify(true);
}

export function subscribeSound(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

const LAST_KEY = "bl_sound_last";
const WINDOW_MS = 2000;

/**
 * Проигрывает звук не чаще раза в 2 с. Окно общее для всех вкладок (метка в localStorage):
 * если открыто две вкладки, сигнал прозвучит один раз, а не из каждой.
 */
export function playNotify(force = false) {
  if (!force && !soundEnabled()) return;
  const now = Date.now();
  let shared = 0;
  try { shared = Number(localStorage.getItem(LAST_KEY) || 0); } catch {}
  if (!force && (now - last < WINDOW_MS || now - shared < WINDOW_MS)) return;
  last = now;
  try { localStorage.setItem(LAST_KEY, String(now)); } catch {}
  try {
    if (!audio) { audio = new Audio("/sounds/notify.wav"); audio.volume = 0.7; audio.preload = "auto"; }
    audio.currentTime = 0;
    audio.play().catch(() => { /* до первого клика браузер запрещает звук */ });
  } catch {}
}
