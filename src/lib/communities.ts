/**
 * Сообщества по связям (label propagation): узел берёт самую частую метку соседей.
 * Детерминированно; одиночки без связей получают метку -1.
 */
export function communities(idsIn: string[], links: Array<{ source: string; target: string }>): Map<string, number> {
  const ids = [...idsIn].sort();
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of links) { adj.get(l.source)?.push(l.target); adj.get(l.target)?.push(l.source); }
  const label = new Map(ids.map((id, i) => [id, i]));
  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    for (const id of ids) {
      const nb = adj.get(id) ?? [];
      if (!nb.length) continue;
      const freq = new Map<number, number>();
      for (const n of nb) freq.set(label.get(n)!, (freq.get(label.get(n)!) ?? 0) + 1);
      const best = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      if (best !== label.get(id)) { label.set(id, best); changed = true; }
    }
    if (!changed) break;
  }
  for (const id of ids) if (!(adj.get(id)?.length)) label.set(id, -1);
  return label;
}
