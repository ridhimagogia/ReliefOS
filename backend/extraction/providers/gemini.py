import json, os
from .base import ExtractionProvider, DemandDraft

class GeminiProvider(ExtractionProvider):
    def available(self):
        if os.environ.get("OFFLINE_MODE") == "1":
            return False
        try:
            from google import genai  # noqa
            return bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"))
        except ImportError:
            return False

    def extract(self, text: str) -> DemandDraft:
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
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    http_options=types.HttpOptions(timeout=10000)
                )
            )
            data = json.loads(response.text)
            return DemandDraft(
                raw_text=text, provider="gemini",
                item=data.get("item"), qty=data.get("qty"),
                camp_id=data.get("camp_id"),
                beneficiaries=data.get("beneficiaries"),
                urgency=data.get("urgency", "medium"),
                confidence=float(data.get("confidence", 0.8)),
                needs_review=data.get("needs_review", False),
                location_text=data.get("camp_id"),
            )
        except Exception as e:
            return DemandDraft(raw_text=text, provider="gemini_failed",
                               needs_review=True, confidence=0.0)
