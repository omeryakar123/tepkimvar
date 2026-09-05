#!/usr/bin/env bash
# Sunucuda Caddy HSTS/308 config'ini uygular.
# Önkoşul: ssh tepkimvar çalışıyor olmalı.
set -euo pipefail

REMOTE="${1:-tepkimvar}"
# Coolify veya selfhost — yaygın yollar
for DIR in /opt/tepkimvar /root/tepkimvar /var/www/tepkimvar; do
  if ssh "$REMOTE" "test -f $DIR/docker-compose.selfhost.yml" 2>/dev/null; then
    APP_DIR="$DIR"
    break
  fi
done

if [ -z "${APP_DIR:-}" ]; then
  echo "Proje dizini bulunamadı. Manuel: ssh $REMOTE 'find / -name docker-compose.selfhost.yml 2>/dev/null | head -3'"
  exit 1
fi

echo "Proje: $APP_DIR"
ssh "$REMOTE" "set -e
  cd '$APP_DIR'
  git fetch origin main && git checkout main && git pull origin main
  docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost exec caddy \\
    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost restart caddy
  sleep 2
  echo '--- HTTP ---'
  curl -sI http://tepkimvar.com | grep -iE 'HTTP/|Location|Strict-Transport' || true
  echo '--- HTTPS ---'
  curl -sI https://tepkimvar.com | grep -iE 'HTTP/|Strict-Transport' || true
"
echo "Tamam."
