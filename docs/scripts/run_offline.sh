#!/usr/bin/env bash
# ReliefOS in a box: one command, no internet.
#   OFFLINE_MODE=1 ./scripts/run_offline.sh        (OFFLINE_MODE is set for you)
# Env: PORT (default 5000), PYTHON (default python3), SKIP_CHECKS=1 to start despite failed checks.
set -euo pipefail
cd "$(dirname "$0")/.."

export OFFLINE_MODE=1
export DATABASE_URL="${DATABASE_URL:-sqlite:///reliefos.db}"
export PORT="${PORT:-5000}"
PY="${PYTHON:-python3}"

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate
  PY=python
fi

# 1. Dependencies: use the offline pack if Flask is missing (no network needed).
if ! "$PY" -c "import flask, sqlalchemy" 2>/dev/null; then
  if [ -d offline-pack/wheels ]; then
    echo "[offline] installing from offline-pack/wheels ..."
    "$PY" -m pip install --no-index --find-links offline-pack/wheels \
      -r backend/requirements.txt -r backend/requirements-matching.txt \
      --break-system-packages 2>/dev/null || \
    "$PY" -m pip install --no-index --find-links offline-pack/wheels \
      -r backend/requirements.txt -r backend/requirements-matching.txt
  else
    echo "[offline] Flask/SQLAlchemy missing and no offline-pack/wheels found." >&2
    exit 1
  fi
fi

# 2. Basemap: create the placeholder if none exists.
if [ ! -f frontend/public/basemap/punjab_districts.geojson ] && [ ! -f frontend/dist/basemap/punjab_districts.geojson ]; then
  "$PY" scripts/make_basemap_placeholder.py
fi

# 3. Pre-flight (dictionary, gazetteer, basemap, build, CDN scan).
if ! "$PY" scripts/check_assets.py; then
  if [ "${SKIP_CHECKS:-0}" != "1" ]; then
    echo "[offline] pre-flight failed. Fix the [FAIL] lines or set SKIP_CHECKS=1." >&2
    exit 1
  fi
fi

# 4. Seed the Punjab scenario if the DB is empty (seed.py is Person 2's).
if "$PY" -c "import backend.seed.seed" 2>/dev/null; then
  "$PY" -m backend.seed.seed --if-empty || echo "[offline] seed step failed; check backend/seed/seed.py"
else
  echo "[offline] backend/seed/seed.py not found yet; skipping seed."
fi

# 5. Phones need the address, never reliefos.local.
"$PY" -m backend.offline.join || true

# 6. Start Flask: serves the React build and the API on one port.
echo "[offline] mode=offline db=$DATABASE_URL port=$PORT"
exec "$PY" -m flask --app backend.app run --host 0.0.0.0 --port "$PORT"
