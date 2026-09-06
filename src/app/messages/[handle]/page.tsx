import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findUserByHandle } from "@/lib/repo";
import { MessagesView } from "@/components/messages";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const u = await findUserByHandle(handle.toLowerCase()).catch(() => null);
  return { title: u ? `Чат с ${u.name}` : "Сообщения" };
}

export default async function ChatPage({ params }: Props) {
  const { handle } = await params;
  const h = handle.toLowerCase();
  if (!(await findUserByHandle(h).catch(() => null))) notFound();
  return <MessagesView handle={h} />;
}
