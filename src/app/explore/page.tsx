import type { Metadata } from "next";
import Link from "next/link";
import { Constellation } from "@/components/constellation";
import { ExploreLists } from "@/components/explore-lists";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("explore.pageTitle") };
}

export default async function ExplorePage() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t("explore.eyebrow")}</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("explore.heading")}</h1>
        <p className="mt-1.5 max-w-xl text-sm text-ink-2">{t("explore.intro")}</p>
      </header>
      <Constellation />
      <ExploreLists />
      <p className="text-center text-xs text-muted">{t("explore.lookingFor")} <Link href="/search" className="link-tag">{t("explore.searchLink")}</Link> {t("explore.orCmdK")}</p>
    </div>
  );
}
