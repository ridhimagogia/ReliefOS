import os
from .providers.base import DemandDraft
from .providers.rules import RulesProvider
from .providers.gemini import GeminiProvider

def extract(text: str) -> DemandDraft:
    """
    Try providers in order: Gemini (online only) -> Rules (always).
    OFFLINE_MODE=1 skips Gemini entirely.
    """
    providers = []
    if os.environ.get("OFFLINE_MODE") != "1":
        providers.append(GeminiProvider())
    providers.append(RulesProvider())

    for provider in providers:
        if not provider.available():
            continue
        result = provider.extract(text)
        if result.confidence >= 0.8:
            return result

    # fallback: return whatever rules gave us
    return RulesProvider().extract(text)
