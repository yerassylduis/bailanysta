import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("settings.title") };
}

export default function SettingsPage() {
  return <SettingsView />;
}
