#!/usr/bin/env bash
# Публикация Bailanysta на GitHub одной командой.
# 1) авторизация (один раз):  GH_CONFIG_DIR=$HOME/.gh-config gh auth login
# 2) запуск:                  ./scripts/publish.sh [имя-репозитория]
set -euo pipefail
export GH_CONFIG_DIR="${GH_CONFIG_DIR:-$HOME/.gh-config}"   # ~/.config недоступен (owned by root)
REPO="${1:-bailanysta}"
cd "$(dirname "$0")/.."
gh auth status >/dev/null 2>&1 || { echo "Сначала: GH_CONFIG_DIR=\$HOME/.gh-config gh auth login"; exit 1; }
if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin main
else
  gh repo create "$REPO" --public --source=. --remote=origin --push \
    --description "Bailanysta — уютная соцсеть: посты с настроением, созвездие связей и ИИ-соавтор Муза (nFactorial)"
fi
gh repo view --web
