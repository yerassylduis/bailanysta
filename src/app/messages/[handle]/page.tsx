import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findUserByHandle } from "@/lib/repo";
import { MessagesView } from "@/components/messages";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const u = await findUserByHandle(handle.toLowerCase()).catch(() => null);
  const { t } = await getT();
  return { title: u ? t("messages.chatWith", { name: u.name }) : t("nav.messages") };
}

export default async function ChatPage({ params }: Props) {
  const { handle } = await params;
  const h = handle.toLowerCase();
  if (!(await findUserByHandle(h).catch(() => null))) notFound();
  return <MessagesView handle={h} />;
}
