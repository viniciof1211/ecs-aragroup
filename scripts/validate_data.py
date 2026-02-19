"""Validate the generated JSON seed files."""
import json
import re

for fname in ["public/data/leads.json", "public/data/interactions.json", "public/data/score_history.json"]:
    with open(fname, encoding="utf-8") as f:
        raw = f.read()
    
    nat_count = len(re.findall(r'"NaT"', raw))
    nan_count = len(re.findall(r'"NaN"', raw))
    data = json.loads(raw)
    print(f"{fname}: {len(data)} records, NaT={nat_count}, NaN={nan_count}, size={len(raw)/1024/1024:.1f}MB")

    if fname.endswith("leads.json"):
        # Sample
        l = data[0]
        print(f"  Sample: id={l['id']}, name={l['name']}, score={l['current_score']}, segment={l['segment']}")
        print(f"  first_seen={l.get('first_seen')}, last_seen={l.get('last_seen')}")
        print(f"  channels={l.get('channels')}, interactions={l.get('interaction_count')}")
        
        # Score distribution
        from collections import Counter
        segs = Counter(l["segment"] for l in data)
        print(f"  Segments: {dict(segs)}")
        statuses = Counter(l["status"] for l in data)
        print(f"  Statuses: {dict(statuses)}")
        
        # Check for None/null first_seen
        null_first = sum(1 for l in data if not l.get("first_seen"))
        null_last = sum(1 for l in data if not l.get("last_seen"))
        print(f"  null first_seen={null_first}, null last_seen={null_last}")

    if fname.endswith("interactions.json"):
        # Check for missing timestamps
        no_ts = sum(1 for i in data if not i.get("timestamp"))
        print(f"  Missing timestamps: {no_ts}")
        # Type distribution
        from collections import Counter
        types = Counter(i.get("type", "unknown") for i in data)
        print(f"  Types: {dict(sorted(types.items(), key=lambda x: -x[1]))}")
