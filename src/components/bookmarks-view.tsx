"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useMe } from "@/hooks/use-data";
import { Feed } from "./feed";
import { EmptyState } from "./ui";
import { useT } from "./locale-provider";

export function BookmarksView() {
  const { data: me, isPending } = useMe();
  const { t } = useT();
  if (!isPending && !me?.user) return <EmptyState title={t("feed.bookmarksOnly")} text={t("feed.bookmarksLoginText")} action={<Link href="/login" className="btn btn-primary">{t("nav.login")}</Link>} />;
  return (
    <div className="space-y-4">
      <header><h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Bookmark className="text-saffron" /> {t("nav.bookmarks")}</h1><p className="text-sm text-muted">{t("feed.bookmarksSubtitle")}</p></header>
      <Feed filter={{ scope: "bookmarks" }} emptyTitle={t("feed.bookmarksEmpty")} emptyText={t("feed.bookmarksEmptyText")} />
    </div>
  );
}
