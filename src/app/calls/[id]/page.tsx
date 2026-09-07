import type { Metadata } from "next";
import { CallRoom } from "@/components/call-room";

export const metadata: Metadata = { title: "Созвон" };

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallRoom id={id.toLowerCase()} />;
}
