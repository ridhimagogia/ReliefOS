#!/usr/bin/env python3
"""Pre-flight for the offline box. Exit 1 if a REQUIRED asset is missing.

Also scans the built frontend for CDN / public-tile URLs (hidden online
dependencies are the classic 'worked on my laptop' failure).
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.offline.basemap import validate_geojson  # noqa: E402

fails, warns = 0, 0


def ok(msg):
    print(f"  [OK]   {msg}")


def warn(msg):
    global warns
    warns += 1
    print(f"  [WARN] {msg}")


def fail(msg):
    global fails
    fails += 1
    print(f"  [FAIL] {msg}")


def need_file(label, *paths):
    for p in paths:
        if (ROOT / p).exists():
            ok(f"{label}: {p}")
            return
    fail(f"{label} missing (looked for: {', '.join(paths)})")


print("ReliefOS offline pre-flight")
need_file("item dictionary", "backend/extraction/dictionary/items.json")
need_file("unit dictionary", "backend/extraction/dictionary/units.json")
need_file("gazetteer", "backend/seed/gazetteer.json")

base = next((ROOT / p for p in ("frontend/dist/basemap/punjab_districts.geojson",
                                "frontend/public/basemap/punjab_districts.geojson")
             if (ROOT / p).exists()), None)
if base is None:
    fail("GeoJSON basemap missing (run: python scripts/make_basemap_placeholder.py)")
else:
    good, msg = validate_geojson(base)
    (ok if good else fail)(f"basemap {base.relative_to(ROOT)}: {msg}")
    if "placeholder" in msg:
        warn("basemap is the coarse placeholder; swap in licence-checked district data")

dist = ROOT / "frontend" / "dist"
if not (dist / "index.html").exists():
    fail("frontend/dist/index.html missing (run the Vite build, or restore it from offline-pack/)")
else:
    ok("frontend build present")
    pat = re.compile(r"https?://(?:[\w.-]*\.)?(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|"
                     r"fonts\.googleapis\.com|fonts\.gstatic\.com|tile\.openstreetmap\.org)")
    hits = {}
    for f in dist.rglob("*"):
        if f.is_file() and f.suffix in {".html", ".js", ".css", ".json"}:
            try:
                for m in pat.finditer(f.read_text(encoding="utf-8", errors="ignore")):
                    hits.setdefault(m.group(1), set()).add(f.name)
            except OSError:
                pass
    for host, files in hits.items():
        warn(f"build references {host} in {', '.join(sorted(files))[:80]} (check the Network tab; must not load offline)")
    if not hits:
        ok("no CDN or public-tile URLs found in the build")

if shutil.which("tesseract"):
    try:
        langs = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True, timeout=10)
        has_hin = "hin" in (langs.stdout + langs.stderr)
        (ok if has_hin else warn)("tesseract found" + ("" if has_hin else " but Hindi (hin) data is missing"))
    except Exception:
        warn("tesseract found but --list-langs failed")
else:
    warn("tesseract not installed (printed-list OCR unavailable)")

if shutil.which("ollama"):
    ok("ollama found (local LLM possible; keep it only if the gold set says so)")
else:
    ok("no local LLM runtime: chain will be Rules only (fine)")

try:
    import scipy  # noqa: F401
    ok("scipy present (LP optimiser available)")
except ImportError:
    warn("scipy missing: LP toggle falls back to greedy")

print(f"\n{fails} failure(s), {warns} warning(s)")
sys.exit(1 if fails else 0)
