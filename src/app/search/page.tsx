import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "@/components/search-view";
import { FeedSkeleton } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("search.pageTitle") };
}

export default function SearchPage() {
  return <Suspense fallback={<FeedSkeleton />}><SearchView /></Suspense>;
}
