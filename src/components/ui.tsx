"use client";

import Link from "next/link";
import { cn } from "@/lib/format";
import type { UserDto } from "@/lib/types";

/* --------------------------------- Аватар -------------------------------- */

const HUES = [168, 34, 210, 350, 90, 265, 20, 140];

export function Avatar({ user, size = 40, className }: { user: Pick<UserDto, "handle" | "name" | "hue">; size?: number; className?: string }) {
  const h = HUES[user.hue % HUES.length];
  const initials = user.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || user.handle[0].toUpperCase();
  return (
    <div
      className={cn("relative shrink-0 select-none rounded-full text-white font-display font-bold flex items-center justify-center", className)}
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${h} 60% 52%), hsl(${(h + 40) % 360} 65% 42%))`,
        boxShadow: `inset 0 -${size / 10}px ${size / 5}px rgba(0,0,0,.18)`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

/* --------------------------------- Скелетоны ----------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function PostSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full!" />
        <div className="flex-1 space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-20" /></div>
      </div>
      <div className="mt-4 space-y-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-11/12" /><Skeleton className="h-3.5 w-2/3" /></div>
      <div className="mt-5 flex gap-4"><Skeleton className="h-6 w-14" /><Skeleton className="h-6 w-14" /></div>
    </div>
  );
}

export function FeedSkeleton({ n = 4 }: { n?: number }) {
  return <div className="space-y-4">{Array.from({ length: n }, (_, i) => <PostSkeleton key={i} />)}</div>;
}

/* --------------------------------- Разное -------------------------------- */

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card fade-in flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 h-12 w-12 rounded-full bg-accent-soft" style={{ boxShadow: "0 0 0 10px var(--saffron-soft)" }} />
      <h3 className="font-display text-lg font-b700">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function UserLink({ user, className }: { user: UserDto; className?: string }) {
  return (
    <Link href={`/u/${user.handle}`} className={cn("group inline-flex items-center gap-2", className)}>
      <Avatar user={user} size={32} />
      <span className="leading-tight">
        <span className="block text-sm font-semibold group-hover:underline">{user.name}</span>
        <span className="block text-xs text-muted">@{user.handle}</span>
      </span>
    </Link>
  );
}

/** Логотип: шанырак — круг с перекрестьем, символ дома и связи. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13" stroke="var(--accent)" strokeWidth="2.6" />
      <path d="M16 3v26M3 16h26M6.8 6.8l18.4 18.4M25.2 6.8 6.8 25.2" stroke="var(--saffron)" strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
      <circle cx="16" cy="16" r="4" fill="var(--accent)" />
    </svg>
  );
}
