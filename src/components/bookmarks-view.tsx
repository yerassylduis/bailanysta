"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useMe } from "@/hooks/use-data";
import { Feed } from "./feed";
import { EmptyState } from "./ui";

export function BookmarksView() {
  const { data: me, isPending } = useMe();
  if (!isPending && !me?.user) return <EmptyState title="Закладки только для своих" text="Войдите, чтобы сохранять посты на потом." action={<Link href="/login" className="btn btn-primary">Войти</Link>} />;
  return (
    <div className="space-y-4">
      <header><h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Bookmark className="text-saffron" /> Закладки</h1><p className="text-sm text-muted">Посты, которые вы сохранили. Видите только вы.</p></header>
      <Feed filter={{ scope: "bookmarks" }} emptyTitle="Пока ничего не сохранено" emptyText="Нажмите на закладку под любым постом — он появится здесь." />
    </div>
  );
}
