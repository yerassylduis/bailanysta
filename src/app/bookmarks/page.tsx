import type { Metadata } from "next";
import { BookmarksView } from "@/components/bookmarks-view";

export const metadata: Metadata = { title: "Закладки" };

export default function BookmarksPage() {
  return <BookmarksView />;
}
