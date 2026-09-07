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

/** Проигрывает звук; не чаще раза в 400 мс, чтобы пачка событий не превращалась в трель. */
export function playNotify(force = false) {
  if (!force && !soundEnabled()) return;
  const now = Date.now();
  if (now - last < 400) return;
  last = now;
  try {
    if (!audio) { audio = new Audio("/sounds/notify.wav"); audio.volume = 0.7; audio.preload = "auto"; }
    audio.currentTime = 0;
    audio.play().catch(() => { /* до первого клика браузер запрещает звук */ });
  } catch {}
}
