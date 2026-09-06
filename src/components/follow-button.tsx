"use client";

import { UserPlus, UserCheck } from "lucide-react";
import { useFollow, useMe } from "@/hooks/use-data";
import { useToast } from "./toast";
import { cn } from "@/lib/format";

export function FollowButton({ handle, following, className }: { handle: string; following: boolean; className?: string }) {
  const { data } = useMe();
  const follow = useFollow(handle);
  const toast = useToast();
  const onClick = () => {
    if (!data?.user) return toast("Войдите, чтобы подписываться");
    follow.mutate(!following, { onError: (e) => toast(e.message, "error") });
  };
  return (
    <button onClick={onClick} disabled={follow.isPending} className={cn("btn", following ? "btn-outline" : "btn-primary", className)}>
      {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
      {following ? "Вы подписаны" : "Подписаться"}
    </button>
  );
}
