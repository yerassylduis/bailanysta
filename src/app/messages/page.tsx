import type { Metadata } from "next";
import { MessagesView } from "@/components/messages";

export const metadata: Metadata = { title: "Сообщения" };

export default function MessagesPage() {
  return <MessagesView />;
}
