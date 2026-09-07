import type { Metadata } from "next";
import { CallsView } from "@/components/calls-view";

export const metadata: Metadata = { title: "Байланыс · созвоны" };

export default function CallsPage() {
  return <CallsView />;
}
