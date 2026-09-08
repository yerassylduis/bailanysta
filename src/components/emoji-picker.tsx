"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/format";
import { useT } from "./locale-provider";

/**
 * Пикер эмодзи без библиотек: вкладки по категориям + «Недавние» (localStorage) + фирменный набор Bailanysta.
 * Вставляет эмодзи в позицию курсора переданного textarea (или просто отдаёт через onPick).
 */
const SETS: Array<{ id: string; items: string[] }> = [
  { id: "bailanysta", items: ["🔥", "🌊", "⚡", "🌙", "☀️", "🌌", "✨", "🪐", "🌠", "🐺", "🐎", "🦅", "🏹", "🏔️", "🪁", "🎡", "🍵", "🫖", "🥟", "🐪", "🇰🇿", "💙", "💛", "🤍", "🫶", "🚀"] },
  { id: "smileys", items: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "😝", "🤗", "🤭", "🤫", "🤔", "🫡", "🤐", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "💩", "🤡", "👻", "👽", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"] },
  { id: "gestures", items: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "🧠", "👀", "👁️", "👄", "🫦", "👶", "🧑", "👩", "👨", "🧑‍💻", "🧑‍🎨", "🧑‍🚀", "🧑‍🔬", "🧑‍🏫", "🕺", "💃", "🧘", "🏃", "🤸"] },
  { id: "hearts", items: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "💌", "💋", "😻", "🫀"] },
  { id: "nature", items: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🦋", "🐌", "🐞", "🐢", "🐍", "🐙", "🦀", "🐬", "🐳", "🦈", "🐊", "🐘", "🦒", "🐫", "🦌", "🐎", "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🌷", "🌹", "🌺", "🌸", "🌼", "🌻", "🌞", "🌝", "🌛", "⭐", "🌟", "💫", "☁️", "🌈", "❄️", "🔥", "💧", "🌊"] },
  { id: "food", items: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🥦", "🥕", "🌽", "🥐", "🍞", "🥨", "🧀", "🥚", "🍳", "🥞", "🧇", "🥓", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🥪", "🌮", "🥟", "🍜", "🍲", "🍣", "🍱", "🍚", "🍤", "🍦", "🍩", "🍪", "🎂", "🍰", "🧁", "🍫", "🍬", "🍭", "☕", "🍵", "🧋", "🥤", "🧃", "🍾", "🥂", "🍻"] },
  { id: "objects", items: ["⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "📷", "📸", "🎥", "📺", "📻", "🎙️", "🎧", "🎸", "🎹", "🥁", "🎺", "🎻", "🎮", "🕹️", "🎲", "🧩", "♟️", "🎯", "🎳", "🏀", "⚽", "🏈", "⚾", "🎾", "🏐", "🏓", "🏸", "🥊", "⛷️", "🏂", "🚗", "🚕", "🚌", "🚲", "🛴", "🛵", "🏍️", "✈️", "🚀", "🛸", "🚁", "⛵", "🚂", "🏠", "🏢", "🏰", "🗼", "🎡", "🎢", "⛺", "🔑", "🔒", "🔓", "🛠️", "🔧", "🔨", "⚙️", "🧲", "🧪", "🧬", "🔬", "🔭", "💡", "🔦", "🕯️", "📚", "📖", "📝", "✏️", "🖊️", "📌", "📎", "📏", "✂️", "🗂️", "📅", "📊", "📈", "📉", "💰", "💳", "🎁", "🎈", "🎉", "🎊", "🏆", "🥇", "🎖️", "🏅"] },
  { id: "symbols", items: ["✅", "❌", "❗", "❓", "‼️", "⁉️", "💯", "🔔", "🔕", "📣", "📢", "🔊", "🔇", "♻️", "⚠️", "🚫", "🔞", "🆗", "🆕", "🆙", "🆒", "🆓", "🔝", "🔜", "🔙", "➡️", "⬅️", "⬆️", "⬇️", "↩️", "↪️", "🔄", "🔁", "🔀", "▶️", "⏸️", "⏹️", "⏺️", "⏭️", "⏮️", "⏩", "⏪", "🔀", "➕", "➖", "➗", "✖️", "🟰", "♾️", "💲", "©️", "®️", "™️", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔘", "🏁", "🚩", "🎌", "🏳️", "🏴"] },
];
const RECENT_KEY = "bl_emoji_recent";
const RECENT_EVENT = "bl-emoji-recent";
const EMPTY: string[] = [];
function readRecent(): string[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return EMPTY; } }
let recentCache = { raw: "", list: EMPTY };
function recentSnapshot() { const raw = (() => { try { return localStorage.getItem(RECENT_KEY) ?? ""; } catch { return ""; } })(); if (raw !== recentCache.raw) recentCache = { raw, list: readRecent() }; return recentCache.list; }
function subscribeRecent(cb: () => void) { window.addEventListener(RECENT_EVENT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(RECENT_EVENT, cb); window.removeEventListener("storage", cb); }; }
function pushRecent(e: string) {
  const list = [e, ...readRecent().filter((x) => x !== e)].slice(0, 24);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event(RECENT_EVENT));
}

/** Вставляет текст в позицию курсора textarea и возвращает новое значение. */
export function insertAtCursor(el: HTMLTextAreaElement | null, value: string, insert: string): string {
  if (!el) return value + insert;
  const s = el.selectionStart ?? value.length, e = el.selectionEnd ?? value.length;
  const next = value.slice(0, s) + insert + value.slice(e);
  requestAnimationFrame(() => { el.focus(); const pos = s + insert.length; el.setSelectionRange(pos, pos); });
  return next;
}

export function EmojiPicker({ onPick, className, size = 20, align = "left" }: { onPick: (emoji: string) => void; className?: string; size?: number; align?: "left" | "right" }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>("bailanysta");
  const rootRef = useRef<HTMLDivElement>(null);
  const recent = useSyncExternalStore(subscribeRecent, recentSnapshot, () => EMPTY);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const tabs = [{ id: "recent", items: recent }, ...SETS];
  const current = tabs.find((x) => x.id === tab) ?? SETS[0];
  const pick = (e: string) => { pushRecent(e); onPick(e); };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={cn("btn btn-ghost btn-icon shrink-0", open ? "text-accent bg-accent-soft" : "text-saffron")} title={t("emoji.title")} aria-label={t("emoji.title")} aria-expanded={open}>
        <Smile size={size} />
      </button>
      {open && (
        <div className={cn("absolute bottom-full z-30 mb-2 w-[min(320px,calc(100vw-24px))] rounded-2xl border border-line bg-elev p-2 shadow-lg", align === "left" ? "left-0" : "right-0")} role="dialog" aria-label={t("emoji.title")}>
          <div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto">
            {tabs.map((x) => (
              <button key={x.id} type="button" onClick={() => setTab(x.id)} className={cn("chip shrink-0 px-2 py-0.5 text-[11px]", tab === x.id && "chip-active")}>{t(`emoji.${x.id}`)}</button>
            ))}
          </div>
          <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
            {current.items.map((e, i) => (
              <button key={`${e}-${i}`} type="button" onClick={() => pick(e)} className="grid h-9 w-9 place-items-center rounded-lg text-[22px] leading-none transition hover:bg-accent-soft" aria-label={e}>{e}</button>
            ))}
            {current.items.length === 0 && <p className="col-span-8 p-3 text-center text-xs text-muted">{t("emoji.noRecent")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
