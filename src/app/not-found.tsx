import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return <EmptyState title={t("nav.notFoundTitle")} text={t("nav.notFoundText")} action={<Link href="/" className="btn btn-primary">{t("nav.toHome")}</Link>} />;
}
