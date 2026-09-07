"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePost } from "@/hooks/use-data";
import { PostCard } from "./post-card";
import { Comments } from "./comments";
import { EmptyState, PostSkeleton } from "./ui";
import { useT } from "./locale-provider";

export function PostDetail({ id }: { id: string }) {
  const q = usePost(id);
  const { t } = useT();
  return (
    <div className="space-y-4">
      <Link href="/" className="btn btn-ghost -ml-2 px-2 text-sm"><ArrowLeft size={16} /> {t("posts.toFeed")}</Link>
      {q.isPending ? <PostSkeleton /> : q.isError ? (
        <EmptyState title={t("posts.notFoundTitle")} text={t("posts.notFoundText")} action={<Link href="/" className="btn btn-outline">{t("posts.toFeed")}</Link>} />
      ) : (
        <>
          <PostCard post={q.data} detail />
          <Comments postId={id} postText={q.data.text} />
        </>
      )}
    </div>
  );
}
