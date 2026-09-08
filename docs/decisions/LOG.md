# Decision log

> **Purpose**: dated one-liner decisions below the ADR bar — choices worth remembering
> that don't constrain future work enough to deserve a `NNNN-*.md` record. If a log
> entry later turns out to be load-bearing, promote it to a full record and link it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: agents, appending
> as decisions land; newest first.

<!-- Format, one line each:

- YYYY-MM-DD — decision, stated as fact. (who decided: owner | agent)
-->

- 2026-09-06 — Model routing profile set to `tiered`; safety-critical phases (allergy validation, auth, AI output validation) deviate to `quality-max`. (who decided: owner)
- 2026-09-06 — Product language is Spanish (`es-ES`); UI copy is Spanish, code identifiers and docs stay English. (who decided: owner)
- 2026-09-06 — Anthropic Claude via the Vercel AI SDK is the AI provider, chosen for first-class structured output against Zod schemas. Not yet wired — `ANTHROPIC_API_KEY` and `AI_MODEL` are reserved in `apps/api/.env.example`. (who decided: agent)
- 2026-09-06 — Env-var documentation mode: committed `.env.example` files, the template default. Nothing here is employer- or third-party-sensitive. (who decided: owner)
- 2026-09-06 — `apps/api` runs on port 3001; `apps/docs` moved from 3001 to 3002. (who decided: agent)
- 2026-09-06 — pnpm bumped 9 → 11.24.0 to match the installed toolchain; dependency build scripts are now allowlisted in `pnpm-workspace.yaml` under `allowBuilds`. (who decided: agent)
- 2026-09-06 — `configurations/eslint` declared its plugins as devDependencies, so `pnpm lint` failed everywhere with "eslint: command not found". Moved to `dependencies` and added the `eslint`/`prettier` binaries to each linting package. Reported upstream in `docs/upstream/`. (who decided: agent)
- 2026-09-07 — Fable is unavailable to the owner, so phases the `tiered` profile routes to fable run on opus at high effort instead. The routing table stays as written; the substitution is noted per plan. (who decided: owner)
- 2026-09-07 — Project 002 delivered: generation confirmed working end to end against a live database and a real AI provider. (who decided: owner)
- 2026-09-07 — A recorded health condition may cause an automatic dietary exclusion only where avoiding the substance *is* the definition of managing the condition. Coeliac disease excludes gluten; lactose intolerance is offered as a suggestion the user confirms; pregnancy and every other condition produce no dietary inference. Recorded as [`0008`](./0008-condition-exclusions.md). (who decided: owner)
- 2026-09-07 — Reuse is rotated per user and per plan version, and a user is never served last fortnight's dishes again; the prompt is told what they had and asked for a counted spread. Recorded as [`0009`](./0009-rotate-reuse-per-user.md), which amends [`0006`](./0006-reuse-before-generating.md): the cost claim bends for returning users until the library is large. (who decided: owner, by report; agent, the mechanism)
- 2026-09-08 — Recipes get an AI-drawn illustration, labelled as one, stored with the recipe and served from one public immutable route; off until the owner enables image billing. Recorded as [`0010`](./0010-illustrate-recipes-not-photograph-them.md). (who decided: owner, by request; agent, the mechanism)
- 2026-09-08 — Nutrition targets are advisory: a plan that drifts from them is delivered with the drift recorded, and only structural faults or safety bounds (minimum energy, protein ceiling) discard it. Recorded as [`0011`](./0011-nutrition-targets-are-advisory.md). (who decided: owner — "los datos son orientativos, nunca tiene que fallar la generación"; agent, the split)
- 2026-09-08 — When the model cannot fill a rotated pool, generation falls back once to the whole safe library — last fortnight's dishes included, no second model call — and records `fallback: full_library` on the plan. Excluding last fortnight ([`0009`](./0009-rotate-reuse-per-user.md)) is a variety preference and, like nutrition targets ([`0011`](./0011-nutrition-targets-are-advisory.md)), a preference never costs someone their plan. (who decided: owner — "nunca tiene que fallar la generación"; agent, the mechanism)

