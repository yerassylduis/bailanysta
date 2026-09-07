import type { Metadata } from "next";
import { CallsView } from "@/components/calls-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("calls.pageTitle") };
}

export default function CallsPage() {
  return <CallsView />;
}
