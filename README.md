# ReliefOS: Research Hub

Team Koshish | Zinnovatio 4.0 (30-31 Oct 2026, Chandigarh University) | Track: AI for Smart and Sustainable Cities

> After a disaster, supplies usually exist. What fails is matching supply to demand, in time, at scale.

## Repo map

| File | What it holds |
|---|---|
| `docs/01_problem_and_stats.md` | Verified numbers for the pitch and the problem framing |
| `docs/02_case_studies.md` | Kerala 2018, Punjab 2025, Pakistan 2022, with lessons for ReliefOS |
| `docs/03_datasets.md` | Datasets for the prototype, NLP training and map layers |
| `docs/04_reading_list.md` | Papers, handbooks and sites, grouped by topic and priority |
| `docs/05_study_roadmap.md` | 15-day plan to Oct 30, what each member studies |
| `docs/06_pitch_defense.md` | Likely judge questions and how to answer them |
| `docs/07_competitive_landscape.md` | Existing tools and where ReliefOS is different (verify items marked) |
| `docs/08_tech_stack_architecture.md` | Stack, data model, AI pipeline, matching algorithm, API, screens |

Disaster relief supply-to-demand matching: field reports -> structured demand -> matched against stock -> ranked moves on a map.

- `docs/architecture.md`: system, workflow, matching and data-model diagrams (Mermaid, renders on GitHub) and stack decisions
- `docs/hackathon-plan.md`: what to build before, hour-by-hour plan, must/don't, demo script, judge Q&A
- `research/reading-list-and-resources.md`: what to study, papers, case studies, datasets (not yet web-verified)
- `prototype/match.py`: working LP matching engine (`pip install scipy numpy && python prototype/match.py`)

## Verification convention

- **[V]** = checked against a source during research (source linked).
- **[B]** = background knowledge, not re-verified. Check before putting it on a slide.
