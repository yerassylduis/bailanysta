/**
 * Проверка словарей: у kk и en должны быть все ключи ru (с учётом форм множественного числа),
 * лишних ключей быть не должно, подстановки {var} должны совпадать.
 * Запуск: npm run check:i18n
 */
import { DICTS } from "../src/lib/i18n/index";

const base = (k: string) => k.replace(/\.(one|few|many|other)$/, "");
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
let bad = 0;
for (const [ns, d] of Object.entries(DICTS)) {
  const ruKeys = new Set(Object.keys(d.ru).map(base));
  for (const loc of ["kk", "en"] as const) {
    const keys = new Set(Object.keys(d[loc]).map(base));
    for (const k of ruKeys) if (!keys.has(k)) { console.log(`✗ ${ns}.${k}: нет в ${loc}`); bad++; }
    for (const k of keys) if (!ruKeys.has(k)) { console.log(`✗ ${ns}.${k}: лишний в ${loc}`); bad++; }
    for (const [k, v] of Object.entries(d[loc])) {
      const ruV = d.ru[k] ?? d.ru[`${base(k)}.other`] ?? d.ru[`${base(k)}.many`] ?? d.ru[base(k)];
      if (ruV !== undefined && vars(ruV) !== vars(v)) { console.log(`✗ ${ns}.${k}: подстановки ${loc} «${vars(v)}» ≠ ru «${vars(ruV)}»`); bad++; }
    }
  }
}
const total = Object.values(DICTS).reduce((s, d) => s + Object.keys(d.ru).length, 0);
console.log(bad ? `${bad} проблем` : `✓ словари согласованы (${total} ключей ru)`);
process.exit(bad ? 1 : 0);
