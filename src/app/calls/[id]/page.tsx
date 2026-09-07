import type { Metadata } from "next";
import { CallRoom } from "@/components/call-room";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("calls.roomTitle") };
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallRoom id={id.toLowerCase()} />;
}
