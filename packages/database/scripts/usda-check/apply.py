import json, re, sys, glob
S, R = sys.argv[1], sys.argv[2]
resolved = json.load(open(S + "/resolved.json"))
ours = {o["slug"]: o for o in json.load(open(S + "/ours.json"))}
files = glob.glob(R + "/packages/database/src/seed/ingredients/*.ts")
BAND = (0.6, 1.6)
def fmt(x): 
    v = round(x, 1); return str(int(v)) if v == int(v) else str(v)
adopted, skipped, changes = 0, [], []
for path in files:
    src = open(path).read(); out = src
    for slug, u in resolved.items():
        m = re.search(r"^  \{ [^\n]*slug: '" + re.escape(slug) + r"'[^\n]*\},?$", out, re.M)
        if not m: continue
        row = m.group(0)
        kcal, p, c, f, fib = round(u["kcal"]), u.get("protein", 0), u.get("carbs", 0), u.get("fat", 0), u.get("fiber", 0)
        est = 4 * p + 4 * max(c - fib, 0) + 9 * f + 2 * fib
        if est >= 15 and not (BAND[0] <= kcal / est <= BAND[1]):
            skipped.append((slug, kcal, round(est), u["desc"][:60])); continue
        new = row
        new = re.sub(r"carbs: [0-9.]+", f"carbs: {fmt(c)}", new)
        new = re.sub(r"fat: [0-9.]+", f"fat: {fmt(f)}", new)
        new = re.sub(r"kcal: [0-9.]+", f"kcal: {kcal}", new)
        new = re.sub(r"protein: [0-9.]+", f"protein: {fmt(p)}", new)
        if re.search(r"fiber: [0-9.]+", new): new = re.sub(r"fiber: [0-9.]+", f"fiber: {fmt(fib)}", new)
        elif fib >= 0.5: new = re.sub(r"(fat: [0-9.]+),", rf"\1, fiber: {fmt(fib)},", new, count=1)
        if re.search(r"source: '[a-z]+'", new): new = re.sub(r"source: '[a-z]+'", "source: 'usda'", new)
        else: new = re.sub(r"(slug: '[^']+')", r"\1, source: 'usda'", new, count=1)
        if new != row:
            o = ours[slug]
            changes.append((abs(o["kcal"] - kcal) / max(kcal, 1), slug, o["kcal"], kcal, o["protein"], p, u["desc"][:55]))
        out = out.replace(row, new); adopted += 1
    if out != src: open(path, "w").write(out)
changes.sort(key=lambda x: -x[0])
print(f"adopted {adopted} rows from USDA; {len(changes)} changed a number; {len(skipped)} skipped (macro ratio out of band)")
for s in skipped: print("  skipped", s)
print("largest corrections (ours → USDA kcal, protein):")
for d, slug, k0, k1, p0, p1, desc in changes[:25]: print(f"  {slug:28} {k0:>4}→{k1:<4} kcal  p {p0:>5}→{p1:<5}  {desc}")
json.dump([c[1] for c in changes], open(S + "/changed.json", "w"))
