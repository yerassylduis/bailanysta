import { Suspense } from "react";
import { HomeFeed } from "@/components/home-feed";
import { FeedSkeleton } from "@/components/ui";

export default function HomePage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <HomeFeed />
    </Suspense>
  );
}
