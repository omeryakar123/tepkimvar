#!/usr/bin/env bash
# Tek seferlik: yerel SSH anahtarını sunucuya ekler (root parolası sorulur).
set -euo pipefail
KEY="$HOME/.ssh/tepkimvar_ed25519.pub"
HOST="${1:-root@131.123.39.95}"
if [ ! -f "$KEY" ]; then
  echo "Anahtar yok: $KEY — önce ssh-keygen ile oluşturulmalı."
  exit 1
fi
echo "Public key sunucuya ekleniyor: $HOST"
ssh-copy-id -i "$KEY" "$HOST"
echo ""
echo "Test: ssh tepkimvar 'hostname'"
echo "Sonra: ./scripts/reload-caddy-production.sh"
