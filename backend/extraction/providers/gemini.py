
import json
import os
from pathlib import Path

from .base import ExtractionProvider, DemandDraft

DICTIONARY = Path(__file__).resolve().parents[1] / "dictionary"

with open(DICTIONARY / "items.json", encoding="utf-8") as f:
    ITEMS = json.load(f)


class GeminiProvider(ExtractionProvider):

    def available(self):
        if os.environ.get("OFFLINE_MODE") == "1":
            return False
        try:
            from google import genai
            return bool(
                os.environ.get("GOOGLE_API_KEY")
                or os.environ.get("GEMINI_API_KEY")
            )
        except ImportError:
            return False

    def extract(self, text: str) -> DemandDraft:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client()

            prompt = f"""
Extract a disaster-relief request into JSON with these exact keys:
item (one of: water, food, tent, blanket, medkit),
qty (number or null), camp_id (e.g. camp17 or null),
beneficiaries (number or null), urgency (critical/high/medium/low),
confidence (0.0-1.0), needs_review (true/false).
Return only valid JSON, no markdown.
Request: {text}
"""

            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    http_options=types.HttpOptions(timeout=10000)
                )
            )

            data = json.loads(response.text)

            if not isinstance(data, dict):
                raise ValueError("Expected JSON object")

            item = data.get("item")
            valid_item = item if item in ITEMS else None

            qty = data.get("qty")
            if (
                not isinstance(qty, (int, float))
                or isinstance(qty, bool)
                or qty < 0
            ):
                qty = None

            urgency = data.get("urgency", "medium")
            if urgency not in {"critical", "high", "medium", "low"}:
                urgency = "medium"

            confidence = max(
                0.0,
                min(float(data.get("confidence", 0.8)), 1.0)
            )

            return DemandDraft(
                raw_text=text,
                provider="gemini",
                item=valid_item,
                qty=qty,
                camp_id=data.get("camp_id"),
                beneficiaries=data.get("beneficiaries"),
                urgency=urgency,
                confidence=confidence,
                needs_review=(
                    bool(data.get("needs_review", False))
                    or valid_item is None
                ),
                location_text=data.get("camp_id"),
            )

        except Exception:
            return DemandDraft(
                raw_text=text,
                provider="gemini_failed",
                needs_review=True,
                confidence=0.0
            )
