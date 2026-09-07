import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { AdminPanel } from "@/components/admin-panel";

export const metadata: Metadata = { title: "Админ-панель" };

/** Страница есть только для администраторов; остальным — честный 404. */
export default async function AdminPage() {
  const me = await currentUser();
  if (!me || !isAdmin(me)) notFound();
  return <AdminPanel />;
}
