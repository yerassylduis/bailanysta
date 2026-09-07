import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findUserByHandle } from "@/lib/repo";
import { Profile } from "@/components/profile";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const [u, { t }] = await Promise.all([findUserByHandle(handle.toLowerCase()).catch(() => null), getT()]);
  return { title: u ? `${u.name} (@${u.handle})` : t("nav.profile"), description: u?.bio || undefined };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const h = handle.toLowerCase();
  // Честный 404 для несуществующего профиля (а не «пустая» страница со статусом 200).
  if (!(await findUserByHandle(h).catch(() => null))) notFound();
  return <Profile handle={h} />;
}
