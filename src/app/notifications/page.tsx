import type { Metadata } from "next";
import { NotificationsView } from "@/components/notifications-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("nav.notifications") };
}

export default function NotificationsPage() {
  return <NotificationsView />;
}
