#!/usr/bin/env python3
"""Write the placeholder basemap (see backend/offline/basemap.py). Safe to re-run;
refuses to overwrite a real basemap unless --force."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.offline.basemap import DEFAULT_PATH, build_placeholder  # noqa: E402

if DEFAULT_PATH.exists() and "--force" not in sys.argv:
    try:
        is_placeholder = json.loads(DEFAULT_PATH.read_text(encoding="utf-8")).get("note", "").startswith("PLACEHOLDER")
    except Exception:
        is_placeholder = False
    if not is_placeholder:
        print(f"{DEFAULT_PATH} already holds a real basemap; use --force to overwrite")
        sys.exit(0)
print("written:", build_placeholder())
