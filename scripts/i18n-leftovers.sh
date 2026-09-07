#!/bin/sh
# Печатает строки с кириллицей вне комментариев — кандидаты на перевод. Использование: scripts/i18n-leftovers.sh src/components/foo.tsx
for f in "$@"; do
  perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//.*$}{}gm; s{\{/\*.*?\*/\}}{}gs' "$f" | grep -nE "[А-Яа-яЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ]" | sed "s|^|$f:|"
done
