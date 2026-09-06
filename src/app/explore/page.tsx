import type { Metadata } from "next";
import Link from "next/link";
import { Constellation } from "@/components/constellation";
import { ExploreLists } from "@/components/explore-lists";

export const metadata: Metadata = { title: "Созвездие" };

export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Шоқжұлдыз</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Созвездие связей</h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-2">Каждая звезда — человек, каждая линия — подписка. Размер звезды — сколько постов, сияние — сколько подписчиков. Наведите, чтобы увидеть чьё-то небо; кликните, чтобы попасть в профиль.</p>
      </header>
      <Constellation />
      <ExploreLists />
      <p className="text-center text-xs text-muted">Ищете конкретное? <Link href="/search" className="link-tag">Поиск по постам и тегам</Link> или ⌘K.</p>
    </div>
  );
}
