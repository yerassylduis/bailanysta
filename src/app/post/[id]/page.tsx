import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/repo";
import { PostDetail } from "@/components/post-detail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getPost(id, null).catch(() => null);
  return p ? { title: `${p.author.name}: «${p.text.slice(0, 60)}${p.text.length > 60 ? "…" : ""}»` } : { title: "Пост" };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  if (!(await getPost(id, null).catch(() => null))) notFound();
  return <PostDetail id={id} />;
}
