import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/repo";
import { PostDetail } from "@/components/post-detail";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getPost(id, null).catch(() => null);
  const { t } = await getT();
  return p ? { title: t("posts.metaTitle", { name: p.author.name, excerpt: `${p.text.slice(0, 60)}${p.text.length > 60 ? "…" : ""}` }) } : { title: t("posts.pageTitle") };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  if (!(await getPost(id, null).catch(() => null))) notFound();
  return <PostDetail id={id} />;
}
