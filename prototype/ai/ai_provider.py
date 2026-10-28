import json
from google import genai
from google.genai import types

client = genai.Client()

def parse_online(text):
    prompt = f"""
Extract a disaster-relief request into JSON.
Use only these item names: water_l, blanket, ors.
tier must be critical, high, medium, or low.
Never invent coordinates; use null for unknown values.
Set needs_review true if required information is missing.

Return only this structure:
{{"id": null, "item": null, "qty": null,
"loc": null, "tier": "medium", "needs_review": true}}

Request: {text}
"""
    # response = client.models.generate_content(
    #     model="gemini-3.8-flash",
    #     contents=prompt,
    #     config={"response_mime_type": "application/json"}
    # )


    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            http_options=types.HttpOptions(timeout=10000)
        )
    )
    return json.loads(response.text)


if __name__ == "__main__":
    print(parse_online("Camp 9 ko 75 kambal urgently chahiye"))

    print("AI provider file started")