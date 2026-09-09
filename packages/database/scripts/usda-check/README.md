# Checking the catalogue's macros against USDA

The seed's macros are per 100 g of edible portion. Rows marked `source: 'usda'`
were set from USDA FoodData Central's **SR Legacy** table by the scripts here;
rows marked `manual` are Spanish products USDA does not carry (jamón, chorizo,
turrón, mojo, most tinned dishes) and keep values typed from BEDCA-style tables.

`curated.py` is the artefact worth keeping: one entry per slug listing the words
that identify its USDA row (`-word` excludes). It is a human decision per
ingredient — which cut, raw or cooked, lean or with fat — and the reason the
match can be trusted where a fuzzy search cannot.

```bash
# 1. Fetch SR Legacy (≈6 MB zip) and condense it — once.
mkdir -p /tmp/usda && cd /tmp/usda
curl -sSLo sr.zip https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
unzip -oq sr.zip -d sr
python3 - <<'PY'
import csv, json, glob
base = glob.glob("sr/*/")[0]; want = {"1008":"kcal","1003":"protein","1004":"fat","1005":"carbs","1079":"fiber"}
foods = {r["fdc_id"]: {"id": r["fdc_id"], "desc": r["description"], "cat": r["food_category_id"]} for r in csv.DictReader(open(base+"food.csv"))}
for r in csv.DictReader(open(base+"food_nutrient.csv")):
    k = want.get(r["nutrient_id"]);
    if k and r["fdc_id"] in foods: foods[r["fdc_id"]][k] = float(r["amount"] or 0)
json.dump([v for v in foods.values() if "kcal" in v], open("usda.json","w"))
PY

# 2. Dump the seed as JSON (from packages/database).
pnpm exec tsx -e "import { INGREDIENT_SEED } from './src/seed/ingredients'; import { INGREDIENT_NAMES_EN_GB } from './src/seed/ingredient-names'; import { writeFileSync } from 'node:fs'; writeFileSync('/tmp/usda/ours.json', JSON.stringify(INGREDIENT_SEED.map(r => ({ slug: r.slug, es: r.name, en: INGREDIENT_NAMES_EN_GB[r.slug], category: r.category, kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs, fiber: r.fiber ?? 0, source: r.source ?? 'manual' }))))"

# 3. Resolve the map and read the report; then adopt the values into the seed files.
cp scripts/usda-check/*.py /tmp/usda/ && python3 /tmp/usda/resolve.py /tmp/usda   # prints unresolved entries + curated_report.tsv
python3 /tmp/usda/apply.py /tmp/usda "$(git rev-parse --show-toplevel)"           # rewrites rows, marks source: 'usda'
pnpm test && pnpm lint:fix                                                          # the kcal-ratio test guards the result
```

`apply.py` skips a row whose USDA kcal do not sit within the seed test's macro
band (baking powder is the one case), so the test keeps its meaning. After a
new ingredient is added, give it a line in `curated.py` — or leave it out on
purpose, and say why in the row's comment.
