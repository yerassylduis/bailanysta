import { getPost } from "@/lib/repo";
import { avatarColor, ogCard } from "@/lib/og";
import { moodById } from "@/lib/text";

export const alt = "Пост в Bailanysta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** OG-картинка поста: текст, автор, настроение, счётчики — для красивого превью ссылки. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id, null).catch(() => null);
  const shown = post?.isRepost && post.repostOf ? post.repostOf : post;
  const mood = moodById(shown?.mood);
  const text = shown ? (shown.text || (shown.media.length ? `📷 ${shown.media.length} медиа` : "Пост")) : "Пост не найден";
  const short = text.length > 220 ? text.slice(0, 217) + "…" : text;
  return ogCard(
    <>
      <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: short.length > 120 ? 44 : 56, lineHeight: 1.2, fontWeight: 700, marginTop: 24 }}>
        <span style={{ display: "block" }}>{short}</span>
      </div>
      {shown && (
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: avatarColor(shown.author.hue), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff" }}>
            {shown.author.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 700 }}>{shown.author.name}</span>
            <span style={{ color: "#9b98ab", fontSize: 22 }}>@{shown.author.handle}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 28, color: "#c9c2b2", fontSize: 26 }}>
            {mood && <span style={{ color: "#ffbf57" }}>{mood.emoji} {mood.label}</span>}
            <span>♥ {shown.likeCount}</span>
            <span>💬 {shown.commentCount}</span>
            {shown.repostCount > 0 && <span>↻ {shown.repostCount}</span>}
          </div>
        </div>
      )}
    </>,
  );
}
