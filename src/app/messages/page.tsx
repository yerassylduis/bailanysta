import type { Metadata } from "next";
import { MessagesView } from "@/components/messages";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("nav.messages") };
}

export default function MessagesPage() {
  return <MessagesView />;
}
