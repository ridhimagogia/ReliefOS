#!/usr/bin/env bash
# Run this ONCE WITH INTERNET, before the event. It fills offline-pack/ so a fresh
# laptop with no internet can run ./scripts/run_offline.sh. Copy offline-pack/ to the USB.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python3}"
mkdir -p offline-pack/wheels

echo "[pack] python wheels"
"$PY" -m pip download -r backend/requirements.txt -r backend/requirements-matching.txt -d offline-pack/wheels

if [ -f frontend/package.json ]; then
  echo "[pack] frontend build"
  (cd frontend && npm ci && npm run build)
  rm -rf offline-pack/frontend-dist && cp -r frontend/dist offline-pack/frontend-dist
fi

if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  echo "[pack] docker images (optional)"
  docker compose pull || true
  IMAGES=$(docker compose config --images 2>/dev/null | sort -u | tr '\n' ' ')
  [ -n "$IMAGES" ] && docker save $IMAGES -o offline-pack/docker-images.tar || true
fi

echo "[pack] done. Still do by hand: Tesseract + Hindi data (hin.traineddata), licence-checked"
echo "       district GeoJSON in frontend/public/basemap/, optional tiles / local LLM model."
du -sh offline-pack
