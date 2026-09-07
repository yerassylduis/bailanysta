import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

/**
 * Общий каркас OG-карточек (1200×630) для шаринга в Telegram/WhatsApp/X.
 * Шрифт с кириллицей подгружается с Google Fonts на сервере и кэшируется в памяти процесса.
 */
let fontPromise: Promise<ArrayBuffer | null> | null = null;
async function loadFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const css = await fetch("https://fonts.googleapis.com/css2?family=Manrope:wght@700&subset=cyrillic", {
          headers: { "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0 Safari/537.36" },
        }).then((r) => r.text());
        const url = /src: url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
        if (!url) return null;
        return await fetch(url).then((r) => r.arrayBuffer());
      } catch { return null; }
    })();
  }
  return fontPromise;
}

const HUES = [168, 34, 210, 350, 90, 265, 20, 140];

export function avatarColor(hue: number) { return `hsl(${HUES[hue % HUES.length]} 62% 50%)`; }

export async function ogCard(children: ReactNode) {
  const font = await loadFont();
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 64,
        background: "linear-gradient(135deg, #0b1020 0%, #141b30 60%, #0f2a2c 100%)", color: "#f6f1e6",
        fontFamily: "Manrope, sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, border: "4px solid #4be0d6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#4be0d6" }} />
          </div>
          Expert Bailanysta
          <span style={{ color: "#9b98ab", fontSize: 22, fontWeight: 700, marginLeft: 8 }}>байланыс — это связь</span>
        </div>
        {children}
      </div>
    ),
    { width: 1200, height: 630, fonts: font ? [{ name: "Manrope", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
