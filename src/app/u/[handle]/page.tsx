import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findUserByHandle } from "@/lib/repo";
import { Profile } from "@/components/profile";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const u = await findUserByHandle(handle.toLowerCase()).catch(() => null);
  return { title: u ? `${u.name} (@${u.handle})` : "Профиль", description: u?.bio || undefined };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const h = handle.toLowerCase();
  // Честный 404 для несуществующего профиля (а не «пустая» страница со статусом 200).
  if (!(await findUserByHandle(h).catch(() => null))) notFound();
  return <Profile handle={h} />;
}
