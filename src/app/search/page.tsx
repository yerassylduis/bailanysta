import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "@/components/search-view";
import { FeedSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Поиск" };

export default function SearchPage() {
  return <Suspense fallback={<FeedSkeleton />}><SearchView /></Suspense>;
}
