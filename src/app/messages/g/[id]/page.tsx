import type { Metadata } from "next";
import { MessagesView } from "@/components/messages";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("messages.group") };
}

export default async function GroupChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MessagesView groupId={id} />;
}
