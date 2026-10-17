"""ReliefOS matching engine (hackathon prototype).

Per item type, solve a small transportation LP:
  maximise weighted demand covered, penalise distance.
  min  sum_sd x_sd * (lam * dist_sd  -  W * urgency_d)
  s.t. sum_d x_sd <= stock_s ;  sum_s x_sd <= need_d ; x >= 0
Run: python match.py
"""
import math
import numpy as np
from scipy.optimize import linprog

TIER = {"critical": 4.0, "high": 3.0, "medium": 2.0, "low": 1.0}


def haversine_km(a, b, detour=1.3):
    """Straight-line km * detour factor (fallback when OSRM is unavailable)."""
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h)) * detour


def urgency(d):
    """Score 1..~6: tier + vulnerability share + waiting-time ageing."""
    score = TIER[d["tier"]]
    score += 1.0 * d.get("vulnerable_share", 0.0)       # children/elderly/pregnant share 0..1
    score += min(d.get("hours_waiting", 0) / 24.0, 1.0)  # ages up to +1 over a day
    return score


def match(supplies, demands, lam=0.01, big=100.0):
    """supplies: [{id,item,qty,loc}], demands: [{id,item,qty,loc,tier,...}]. Returns moves."""
    moves = []
    for item in sorted({d["item"] for d in demands}):
        S = [s for s in supplies if s["item"] == item and s["qty"] > 0]
        D = [d for d in demands if d["item"] == item and d["qty"] > 0]
        if not S or not D:
            continue
        n, m = len(S), len(D)
        cost = np.zeros(n * m)
        dist = {}
        for i, s in enumerate(S):
            for j, d in enumerate(D):
                km = haversine_km(s["loc"], d["loc"])
                dist[i, j] = km
                cost[i * m + j] = lam * km - big * urgency(d)
        A, b = [], []
        for i in range(n):  # stock limits
            row = np.zeros(n * m); row[i * m:(i + 1) * m] = 1; A.append(row); b.append(S[i]["qty"])
        for j in range(m):  # demand limits
            row = np.zeros(n * m); row[j::m] = 1; A.append(row); b.append(D[j]["qty"])
        res = linprog(cost, A_ub=np.array(A), b_ub=np.array(b), bounds=(0, None), method="highs")
        for k, q in enumerate(res.x):
            if q >= 1:
                i, j = divmod(k, m)
                moves.append({"item": item, "from": S[i]["id"], "to": D[j]["id"], "qty": int(round(q)),
                              "km": round(dist[i, j], 1), "eta_h": round(dist[i, j] / 35 + 0.5, 1),
                              "why": f"urgency {urgency(D[j]):.1f}, {dist[i, j]:.0f} km"})
    return moves


if __name__ == "__main__":
    supplies = [
        {"id": "A-Ludhiana-WH", "item": "blanket", "qty": 10000, "loc": (30.90, 75.85)},
        {"id": "C-Patiala-NGO", "item": "ors", "qty": 4000, "loc": (30.34, 76.39)},
        {"id": "A-Ludhiana-WH", "item": "water_l", "qty": 6000, "loc": (30.90, 75.85)},
    ]
    demands = [
        {"id": "Camp17", "item": "water_l", "qty": 9000, "loc": (31.05, 75.4), "tier": "critical", "hours_waiting": 10, "vulnerable_share": 0.3},
        {"id": "B-Ferozepur", "item": "blanket", "qty": 7000, "loc": (30.93, 74.61), "tier": "high", "hours_waiting": 30},
        {"id": "B-Ferozepur", "item": "ors", "qty": 2500, "loc": (30.93, 74.61), "tier": "critical", "hours_waiting": 5},
        {"id": "Camp9", "item": "ors", "qty": 2500, "loc": (31.3, 75.57), "tier": "medium", "hours_waiting": 2},
    ]
    for mv in match(supplies, demands):
        print(mv)
