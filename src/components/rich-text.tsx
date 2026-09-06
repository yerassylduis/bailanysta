import Link from "next/link";
import { Fragment } from "react";

/** Рендер текста поста: #теги и @упоминания становятся ссылками, переносы сохраняются. */
const TOKEN = /(#[\p{L}\p{N}_]{2,40}|@[a-z0-9_]{2,32}|https?:\/\/\S+)/giu;

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <p className={className} style={{ overflowWrap: "anywhere" }}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(TOKEN).map((part, i) => {
            if (!part) return null;
            if (part.startsWith("#")) return <Link key={i} href={`/search?q=${encodeURIComponent(part.toLowerCase())}`} className="link-tag">{part}</Link>;
            if (part.startsWith("@")) return <Link key={i} href={`/u/${part.slice(1).toLowerCase()}`} className="link-tag">{part}</Link>;
            if (/^https?:\/\//i.test(part)) return <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="link-tag underline">{part.replace(/^https?:\/\//, "")}</a>;
            return <Fragment key={i}>{part}</Fragment>;
          })}
        </Fragment>
      ))}
    </p>
  );
}
