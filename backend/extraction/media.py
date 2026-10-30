
"""ReliefOS media extraction: image OCR and audio transcription."""

import mimetypes
import os
from pathlib import Path


TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def _gemini_client():
    """Create Gemini client when online mode and API key are available."""
    if os.environ.get("OFFLINE_MODE") == "1":
        return None

    if not (
        os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
    ):
        return None

    try:
        from google import genai
        return genai.Client()
    except ImportError:
        return None


def extract_image_text(image_path: str) -> dict:
    """Extract text using Gemini Vision, falling back to Tesseract."""

    path = Path(image_path)

    if not path.is_file():
        return {
            "text": "",
            "provider": "unavailable",
            "confidence": 0.0,
            "needs_review": True,
            "error": "Image file not found",
        }

    client = _gemini_client()

    # Online OCR using Gemini Vision
    if client is not None:
        try:
            from google.genai import types

            mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"

            response = client.models.generate_content(
                model=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
                contents=[
                    (
                        "Extract all visible disaster-relief request text. "
                        "Preserve quantities, camp IDs, item names and language. "
                        "Do not invent missing information."
                    ),
                    types.Part.from_bytes(
                        data=path.read_bytes(),
                        mime_type=mime_type,
                    ),
                ],
                config=types.GenerateContentConfig(
                    http_options=types.HttpOptions(timeout=20000)
                ),
            )

            text = (response.text or "").strip()

            if text:
                return {
                    "text": text,
                    "provider": "gemini_vision",
                    "confidence": 0.85,
                    "needs_review": False,
                    "error": None,
                }

        except Exception:
            # If Gemini fails, try local OCR.
            pass

    # Offline OCR using Tesseract
    try:
        import pytesseract
        from PIL import Image

        if Path(TESSERACT_PATH).is_file():
            pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

        with Image.open(path) as image:
            text = pytesseract.image_to_string(
                image,
                lang=os.environ.get("TESSERACT_LANG", "eng"),
            ).strip()

        return {
            "text": text,
            "provider": "tesseract",
            "confidence": 0.60 if text else 0.0,
            "needs_review": True,
            "error": None if text else "No readable text found",
        }

    except ImportError:
        error = "Install pytesseract and Pillow for offline OCR"
    except Exception as exc:
        error = f"OCR failed: {exc}"

    return {
        "text": "",
        "provider": "unavailable",
        "confidence": 0.0,
        "needs_review": True,
        "error": error,
    }


def transcribe_audio(audio_path: str) -> dict:
    """Transcribe audio using Gemini; retain for human review offline."""

    path = Path(audio_path)

    if not path.is_file():
        return {
            "transcript": "",
            "provider": "unavailable",
            "confidence": 0.0,
            "needs_review": True,
            "error": "Audio file not found",
        }

    client = _gemini_client()

    if client is None:
        return {
            "transcript": "",
            "provider": "unavailable",
            "confidence": 0.0,
            "needs_review": True,
            "error": (
                "Audio transcription unavailable offline; "
                "retain attachment for human review"
            ),
        }

    try:
        from google.genai import types

        mime_type = mimetypes.guess_type(path.name)[0] or "audio/wav"

        response = client.models.generate_content(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=[
                (
                    "Transcribe this disaster-relief report accurately. "
                    "Preserve the original language (Hindi, Hinglish or English), "
                    "quantities, item names, camp IDs and urgency. "
                    "Return only the spoken words. Do not summarize or invent details."
                ),
                types.Part.from_bytes(
                    data=path.read_bytes(),
                    mime_type=mime_type,
                ),
            ],
            config=types.GenerateContentConfig(
                http_options=types.HttpOptions(timeout=30000)
            ),
        )

        transcript = (response.text or "").strip()

        if not transcript:
            raise ValueError("Gemini returned an empty transcript")

        return {
            "transcript": transcript,
            "provider": "gemini_audio",
            "confidence": 0.80,
            "needs_review": True,
            "error": None,
        }

    except Exception as exc:
        return {
            "transcript": "",
            "provider": "gemini_failed",
            "confidence": 0.0,
            "needs_review": True,
            "error": str(exc),
        }

