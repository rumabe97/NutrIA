import json, re, sys
sys.path.insert(0, sys.argv[1])
from curated import MAP
ours = {o["slug"]: o for o in json.load(open(sys.argv[1] + "/ours.json"))}
usda = json.load(open(sys.argv[1] + "/usda.json"))
def match(words):
    need = [w for w in words if not w.startswith("-")]
    avoid = [w[1:] for w in words if w.startswith("-")]
    hits = [u for u in usda if all(re.search(r"(?<![a-z])" + re.escape(w.lower()), u["desc"].lower()) for w in need) and not any(a.lower() in u["desc"].lower() for a in avoid)]
    hits.sort(key=lambda u: len(u["desc"]))
    return hits
resolved, unresolved = {}, []
for slug, words in MAP.items():
    if slug not in ours: unresolved.append((slug, "NOT IN SEED")); continue
    hits = match(words)
    if not hits: unresolved.append((slug, "no match: " + " + ".join(words))); continue
    resolved[slug] = hits[0]
print("resolved", len(resolved), "unresolved", len(unresolved))
for s, why in unresolved: print("  ?", s, "->", why)
rows = []
for slug, u in resolved.items():
    o = ours[slug]
    k = (o["kcal"] - u["kcal"]) / max(u["kcal"], 1)
    rows.append((abs(k), slug, o, u, k))
rows.sort(key=lambda r: -r[0])
big = [r for r in rows if r[0] > 0.15 or abs(r[2]["protein"] - r[3].get("protein", 0)) > max(3, 0.25 * r[3].get("protein", 0))]
print("deviating (>15% kcal or protein off):", len(big), "of", len(rows))
with open(sys.argv[1] + "/curated_report.tsv", "w") as f:
    for _, slug, o, u, k in rows:
        f.write(f"{slug}\t{o['kcal']}/{o['protein']}/{o['carbs']}/{o['fat']}\t{u['kcal']:.0f}/{u.get('protein',0):.1f}/{u.get('carbs',0):.1f}/{u.get('fat',0):.1f}\t{k:+.0%}\t{u['desc'][:80]}\n")
json.dump({slug: u for slug, u in resolved.items()}, open(sys.argv[1] + "/resolved.json", "w"))
