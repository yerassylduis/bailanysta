import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { AdminPanel } from "@/components/admin-panel";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("admin.pageTitle") };
}

/** Страница есть только для администраторов; остальным — честный 404. */
export default async function AdminPage() {
  const me = await currentUser();
  if (!me || !isAdmin(me)) notFound();
  return <AdminPanel />;
}
