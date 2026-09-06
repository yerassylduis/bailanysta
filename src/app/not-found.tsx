import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return <EmptyState title="Здесь ничего нет" text="Страница потерялась где-то в степи." action={<Link href="/" className="btn btn-primary">На главную</Link>} />;
}
