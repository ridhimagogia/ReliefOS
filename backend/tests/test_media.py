
import os
import pytest

from backend.extraction.media import (
    extract_image_text,
    transcribe_audio,
)
from backend.extraction.chain import extract


def test_missing_image_returns_review(tmp_path, monkeypatch):
    monkeypatch.setenv("OFFLINE_MODE", "1")

    result = extract_image_text(str(tmp_path / "missing.png"))

    assert result["text"] == ""
    assert result["provider"] == "unavailable"
    assert result["needs_review"] is True
    assert result["error"] == "Image file not found"


def test_offline_audio_returns_review(tmp_path, monkeypatch):
    monkeypatch.setenv("OFFLINE_MODE", "1")

    audio = tmp_path / "sample.wav"
    audio.write_bytes(b"test audio")

    result = transcribe_audio(str(audio))

    assert result["transcript"] == ""
    assert result["provider"] == "unavailable"
    assert result["needs_review"] is True


def test_missing_audio_returns_review(tmp_path, monkeypatch):
    monkeypatch.setenv("OFFLINE_MODE", "1")

    result = transcribe_audio(str(tmp_path / "missing.wav"))

    assert result["transcript"] == ""
    assert result["needs_review"] is True
    assert result["error"] == "Audio file not found"


def test_ocr_text_flows_into_demand_parser():
    ocr_text = "Camp 5 needs 50 kambal urgently"

    demand = extract(ocr_text)

    assert demand.item == "blanket"
    assert demand.qty == 50
    assert demand.camp_id == "camp5"
    assert demand.urgency == "high"
    assert demand.needs_review is True


def test_real_offline_ocr_sample(monkeypatch):
    monkeypatch.setenv("OFFLINE_MODE", "1")

    image_path = "prototype/ai/request.png"

    if not os.path.isfile(image_path):
        pytest.skip("Prototype OCR sample image is unavailable")

    result = extract_image_text(image_path)

    assert result["provider"] == "tesseract"
    assert result["text"]
    assert result["needs_review"] is True
