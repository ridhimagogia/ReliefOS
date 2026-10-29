
from dataclasses import dataclass, field
from typing import List, Optional
import abc


@dataclass
class DemandDraft:
    item: Optional[str] = None
    qty: Optional[float] = None
    unit: Optional[str] = None
    location_text: Optional[str] = None
    camp_id: Optional[str] = None
    beneficiaries: Optional[int] = None
    urgency: str = "medium"
    confidence: float = 0.0
    provider: str = "unknown"
    needs_review: bool = True
    raw_text: str = ""
    source: str = "coordinator"
    verified: bool = True
    kind: str = "demand"
    language: str = "en"
    duplicate_of: Optional[str] = None
    report_count: int = 1


class ExtractionProvider(abc.ABC):
    @abc.abstractmethod
    def available(self) -> bool:
        pass

    @abc.abstractmethod
    def extract(self, text: str) -> DemandDraft:
        pass
