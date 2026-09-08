"use client";

/**
 * Локальные настройки интерфейса, которые живут в браузере (localStorage) и не требуют аккаунта.
 * Сейчас: анимация космического фона. Подписка — через useSyncExternalStore.
 */
const EVENT = "bl-prefs-change";
export const COSMOS_KEY = "bl_cosmos";

export function cosmosEnabled() {
  try { return localStorage.getItem(COSMOS_KEY) !== "off"; } catch { return true; }
}
export function setCosmosEnabled(on: boolean) {
  try { localStorage.setItem(COSMOS_KEY, on ? "on" : "off"); } catch {}
  window.dispatchEvent(new Event(EVENT));
}
export function subscribePrefs(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
