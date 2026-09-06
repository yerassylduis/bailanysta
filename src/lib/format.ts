/** Относительное время: «только что», «5 мин», «3 ч», «вчера», «12 авг». */
export function timeAgo(iso: string, now = Date.now()): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((now - d) / 1000));
  if (s < 45) return "только что";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const days = Math.floor(h / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};

export const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
