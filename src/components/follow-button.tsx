"use client";

import { UserPlus, UserCheck } from "lucide-react";
import { useFollow, useMe } from "@/hooks/use-data";
import { useToast } from "./toast";
import { cn } from "@/lib/format";
import { useT } from "./locale-provider";

export function FollowButton({ handle, following, className }: { handle: string; following: boolean; className?: string }) {
  const { data } = useMe();
  const follow = useFollow(handle);
  const toast = useToast();
  const { t } = useT();
  const onClick = () => {
    if (!data?.user) return toast(t("posts.loginToFollow"));
    follow.mutate(!following, { onError: (e) => toast(e.message, "error") });
  };
  return (
    <button onClick={onClick} disabled={follow.isPending} className={cn("btn", following ? "btn-outline" : "btn-primary", className)}>
      {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
      {following ? t("posts.following") : t("posts.follow")}
    </button>
  );
}
