# ReliefOS - Person 4 scope (matching, geo, offline node)
Hackathon: Chandigarh University, 30-31 Oct. Code freeze 29 Oct.
I own: backend/routing.py, backend/matching/, backend/offline/, scripts/, backend/tests/.
I do NOT edit: frontend/src (Person 1), the Flask app and DB code (Person 2), backend/extraction dictionaries (Person 3).
If I need a change in their files, write it in HANDOFF.md instead of editing.
Rules:
- Contracts are in docs/08_tech_stack_architecture.md and docs/11_offline_infrastructure.md. Follow them exactly.
- OFFLINE_MODE=1 must never make a network call. Run pytest after every change; all tests must stay green.
- Make small changes, summarise what changed, do not refactor working code.
- Never run git push or delete files without asking me.
