import re
from ocr_reader import read_request
from ai_provider import parse_online

ITEMS = {
    "water_l": ["water", "water bottles", "paani"],
    "blanket": ["blanket", "blankets", "kambal"],
    "ors": ["ors", "ors packets"]
}

def parse_request(text):
    result = {
        "id": None, "item": None, "qty": None,
        "loc": None, "tier": "medium", "needs_review": False
    }

    camp = re.search(r"\bcamp\s*\d+\b", text, re.I)
    if camp:
        result["id"] = camp.group().replace(" ", "")

    text_lower = text.lower()
    for item, aliases in ITEMS.items():
        for alias in sorted(aliases, key=len, reverse=True):
            # match = re.search(r"(\d+)\s+" + re.escape(alias), text_lower)
            match = re.search(
                r"(\d+)\s+" + re.escape(alias) + r"|" +
                re.escape(alias) + r"\s+(\d+)", text_lower
            )
            if match:
                result["item"] = item
                # result["qty"] = int(match.group(1))
                result["qty"] = int(match.group(1) or match.group(2))
                break
        if result["item"]:
            break

    if any(w in text_lower for w in ["emergency", "critical"]):
        result["tier"] = "critical"
    elif any(w in text_lower for w in ["urgent", "urgently", "asap", "turant"]):
        result["tier"] = "high"

    result["needs_review"] = (
        result["id"] is None or result["item"] is None
        or result["qty"] is None
    )
    return result

if __name__ == "__main__":
    # print(parse_request("Camp 5 needs 50 kambal urgently"))
    # print(parse_request("Camp 17 needs 200 water urgently"))
    # print(parse_request("Camp 5 needs 50 kambal"))
    # print(parse_request("Camp 2 needs 100 ors packets"))
    # print(parse_request("Camp 8 water 300"))

    text = read_request("request.png")
    result = parse_request(text)

    # text = "Camp 9 ko 75 kambal urgently chahiye"
    # text = "Camp 9 needs supplies"
    # result = parse_request(text)

    if result["needs_review"]:
        try:
            result = parse_online(text)
        except Exception:
            pass

    print(result)