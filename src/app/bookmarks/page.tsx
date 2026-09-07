import type { Metadata } from "next";
import { BookmarksView } from "@/components/bookmarks-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("nav.bookmarks") };
}

export default function BookmarksPage() {
  return <BookmarksView />;
}
