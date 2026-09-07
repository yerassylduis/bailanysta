import type { Metadata } from "next";
import { MessagesView } from "@/components/messages";

export const metadata: Metadata = { title: "Группа" };

export default async function GroupChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MessagesView groupId={id} />;
}
