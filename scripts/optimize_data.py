"""
Optimize data files for browser consumption.
Splits the large monolithic JSON files into:
  - leads.json          : Full lead records (keep as-is, ~18MB, loaded once)
  - interactions_index.json : Lightweight index {lead_id -> count} for dashboard
  - interactions/{lead_id}.json : Per-lead interaction files for lazy loading
  - score_history_index.json : Per-lead latest score + trend for dashboard
  - score_history/{lead_id}.json : Per-lead score history for profile view
"""
import json
import os
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data")

def run():
    # ─── Load full data ───
    print("[OPT] Loading data files...")
    with open(os.path.join(DATA_DIR, "interactions.json"), encoding="utf-8") as f:
        interactions = json.load(f)
    print(f"  interactions: {len(interactions)}")

    with open(os.path.join(DATA_DIR, "score_history.json"), encoding="utf-8") as f:
        score_history = json.load(f)
    print(f"  score_history: {len(score_history)}")

    # ─── Group by lead_id ───
    int_by_lead = defaultdict(list)
    for i in interactions:
        int_by_lead[i["lead_id"]].append(i)

    hist_by_lead = defaultdict(list)
    for s in score_history:
        hist_by_lead[s["lead_id"]].append(s)

    # ─── Write per-lead interaction files ───
    int_dir = os.path.join(DATA_DIR, "interactions")
    os.makedirs(int_dir, exist_ok=True)
    
    print(f"[OPT] Writing {len(int_by_lead)} per-lead interaction files...")
    for lead_id, ints in int_by_lead.items():
        path = os.path.join(int_dir, f"{lead_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(ints, f, ensure_ascii=False, separators=(",", ":"))

    # ─── Write per-lead score history files ───
    hist_dir = os.path.join(DATA_DIR, "score_history")
    os.makedirs(hist_dir, exist_ok=True)

    print(f"[OPT] Writing {len(hist_by_lead)} per-lead score history files...")
    for lead_id, hist in hist_by_lead.items():
        path = os.path.join(hist_dir, f"{lead_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(hist, f, ensure_ascii=False, separators=(",", ":"))

    # ─── Write interactions index (lightweight) ───
    # Just lead_id -> interaction count + channel list + latest timestamp
    int_index = {}
    for lead_id, ints in int_by_lead.items():
        channels = list(set(i.get("channel", "unknown") for i in ints))
        types = list(set(i.get("type", "unknown") for i in ints))
        latest = max((i.get("timestamp", "") for i in ints), default="")
        int_index[lead_id] = {
            "count": len(ints),
            "channels": channels,
            "types": types,
            "latest": latest,
        }

    idx_path = os.path.join(DATA_DIR, "interactions_index.json")
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(int_index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  interactions_index.json: {os.path.getsize(idx_path) / 1024:.0f} KB")

    # ─── Write score history index (latest per lead) ───
    hist_index = {}
    for lead_id, hist in hist_by_lead.items():
        if hist:
            latest = hist[-1]  # already sorted by time
            hist_index[lead_id] = {
                "score": latest["score"],
                "previous_score": latest["previous_score"],
                "delta": latest["delta"],
                "trend": latest["trend"],
                "snapshots": len(hist),
            }

    hidx_path = os.path.join(DATA_DIR, "score_history_index.json")
    with open(hidx_path, "w", encoding="utf-8") as f:
        json.dump(hist_index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  score_history_index.json: {os.path.getsize(hidx_path) / 1024:.0f} KB")

    # ─── Summary ───
    total_int_files = sum(os.path.getsize(os.path.join(int_dir, f)) for f in os.listdir(int_dir))
    total_hist_files = sum(os.path.getsize(os.path.join(hist_dir, f)) for f in os.listdir(hist_dir))
    print(f"\n[OPT] ═══════════════════════════════════════")
    print(f"  Per-lead interaction files: {len(int_by_lead)} files, {total_int_files/1024/1024:.1f} MB total")
    print(f"  Per-lead score history files: {len(hist_by_lead)} files, {total_hist_files/1024/1024:.1f} MB total")
    print(f"  interactions_index.json: {os.path.getsize(idx_path)/1024:.0f} KB")
    print(f"  score_history_index.json: {os.path.getsize(hidx_path)/1024:.0f} KB")
    print(f"[OPT] ✓ Done!")

if __name__ == "__main__":
    run()
