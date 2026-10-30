# Honest Disclosures🚑

This file records what is real, what is synthetic, and what changed during the build.
Judges and evaluators should read this alongside the demo.

---

## Demo data

All camp names, depot locations, supply quantities and demand messages shown in the demo
are **synthetic**. They are based on a fictional Punjab-flood scenario created for this
hackathon. No real victim data, no real inventory records and no real government data
are used or implied.

---

## Distances

All distances shown in the UI are **straight-line estimates** (haversine formula x 1.3
road factor). They are not road-routed. The UI labels them "straight-line estimate" wherever
they appear.

---

## Frontend rebuild

The original prototype (in `prototype/`) used structured input fields: the coordinator
typed item, quantity, urgency and location into a form. This defeated the product's core
promise — that coordinators should never have to structure data themselves.

On 30 Oct 2026, the frontend was **rebuilt from scratch** in `frontend/` using
React 19, TypeScript strict, Vite and Tailwind 4. The new frontend accepts only
unstructured input (pasted text, photo, voice, call notes). Structured fields appear
only as read-only output chips after parsing.

The old prototype folder is kept for reference and for the rollback git tag.

---

## AI pipeline

- **Online:** Gemini API handles text extraction, OCR (photos) and speech-to-text (voice).
- **Offline:** A rules-based parser (no network required) handles text. Its confidence is
  capped at 0.65, so every offline record goes to the Review Queue for human verification.
- **If neither works:** the submission is saved as a `needs_review` record with the
  original file attached. A human reads or listens to it.

The AI **proposes**. The coordinator **decides**. Nothing is dispatched automatically.

---

## False-report protection

Public reports (from the `/public` page) are always unverified and always in the
Review Queue. They cannot enter matching without a coordinator clicking Verify.
A trust score (0-1) is computed from rule-based signals (unknown location, implausible
quantity, sender reputation, corroboration). Critical unverified reports are pinned to
the top of the queue with a "call back before dispatch" banner.

A determined attacker with many SIMs and plausible details can still get through the
automatic checks. The system lowers the odds, makes the cost small (a proposal behind
a human gate, not a dispatch), and keeps everything traceable in the audit log.

---

## Parser accuracy

Accuracy figures (X of 20 correct on item, qty, camp) will be recorded in
`docs/06_pitch_defense.md` after the live test run on 30 Oct. The number on the
slides is the real measured number, not an estimate.

---

## What is not built

- WhatsApp Business API integration (needs Meta approval)
- Automated helpline (needs Exotel/Twilio)
- 112 integration (government system, no API access)
- Road routing (haversine estimate only)
- OTP or role-based auth beyond coordinator/public split
- Native driver app
- Production infrastructure or Docker
