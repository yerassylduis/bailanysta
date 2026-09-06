import { getProfile } from "@/lib/repo";
import { avatarColor, ogCard } from "@/lib/og";

export const alt = "Профиль в Bailanysta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await getProfile(handle.toLowerCase(), null).catch(() => null);
  return ogCard(
    p ? (
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48, marginTop: 24 }}>
        <div style={{ width: 200, height: 200, borderRadius: 999, background: avatarColor(p.hue), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {p.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>{p.name}</span>
          <span style={{ fontSize: 32, color: "#4be0d6" }}>@{p.handle}</span>
          {p.bio && <span style={{ fontSize: 28, color: "#c9c2b2", lineHeight: 1.3 }}>{p.bio.slice(0, 120)}</span>}
          <div style={{ display: "flex", gap: 36, fontSize: 26, color: "#9b98ab", marginTop: 12 }}>
            <span><b style={{ color: "#f6f1e6" }}>{p.stats.posts}</b> постов</span>
            <span><b style={{ color: "#f6f1e6" }}>{p.stats.followers}</b> подписчиков</span>
            <span><b style={{ color: "#f6f1e6" }}>{p.stats.likesReceived}</b> лайков</span>
          </div>
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: 56, fontWeight: 700 }}>Профиль не найден</div>
    ),
  );
}
