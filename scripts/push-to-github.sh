#!/bin/bash
# Создаёт репозиторий dipomm-main на GitHub и пушит main.
# Использование:
#   GITHUB_TOKEN=ghp_xxxx bash scripts/push-to-github.sh
# Токен: GitHub → Settings → Developer settings → Personal access tokens → repo

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GH="$ROOT/.tools/gh_2.93.0_macOS_arm64/bin/gh"
REPO="maksimzukov/dipomm-main"

if [[ ! -x "$GH" ]]; then
  echo "gh CLI не найден в .tools/. Запустите из корня проекта после установки gh."
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Укажите GITHUB_TOKEN (Personal Access Token с правом repo)."
  echo "Пример: GITHUB_TOKEN=ghp_xxxx bash scripts/push-to-github.sh"
  exit 1
fi

cd "$ROOT"
echo "$GITHUB_TOKEN" | "$GH" auth login --with-token
"$GH" auth setup-git

if "$GH" repo view "$REPO" >/dev/null 2>&1; then
  echo "Репозиторий $REPO уже существует."
else
  echo "Создаю репозиторий $REPO ..."
  "$GH" repo create "$REPO" --public --description "Фермерский маркетплейс «Свои Ряды» (FastAPI)"
fi

git remote set-url origin "https://github.com/$REPO.git"
git push -u origin main

echo "Готово: https://github.com/$REPO"
