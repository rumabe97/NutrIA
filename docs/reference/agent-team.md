# The agent team

> **Purpose**: how feature work is split across agents that run at the same time and talk
> to each other — who owns what, which resources have exactly one owner, how they message
> each other, and what the lead does before anything is merged. Every agent under
> `.claude/agents/` reads this first; the lead follows it through `/team`.
> **Audience**: agents, and the owner. **Committed**: yes. **Maintained by**: agents draft,
> owner approves. Update it in the same change that invalidates it.
>
> Facts about Claude Code are labelled **confirmed** (read in its documentation, or run
> here) or **hypothesis**.

## Agents or subagents? The same files, and what each run really gets

A definition under `.claude/agents/` is one thing; how it is started decides how much of
it is honoured. Measured here on 2026-09-21, Claude Code 2.1.278, agent teams enabled in
the owner's settings:

| Started as | What it is | From its definition it gets |
| --- | --- | --- |
| an agent **with a `name`** (`Agent` tool, or "spawn a teammate using the `backend` agent type") | a **teammate**: it has a mailbox, messages the others by name, and an incoming message wakes it after it has finished — **confirmed**, both directions | the **prompt** and the **model** — **confirmed**. Its `tools`, `disallowedTools`, `isolation` and `hooks` are **not applied** — **confirmed**: a reviewer denied `Write` had `Write`, an agent with `isolation: worktree` ran in the main checkout, a declared hook never fired |
| an agent **without a name** | a one-shot subagent: it reports back to whoever started it and talks to nobody else | everything, according to the documentation — **hypothesis**, not measured here |

**So the team runs as named agents** — the owner asked for agents that talk to each other,
and a name is what gives an agent a mailbox — **and nothing about its safety rests on the
frontmatter**:

- its own worktree is made by `worktree.sh`, its first command, not by `isolation`;
- edits are guarded by a project-wide hook (`.claude/settings.json`) that reads who is
  editing from the **branch** of the checkout, `agent/<feature>/<name>`, not from the
  definition;
- the wall is the lead: a branch that touched somebody else's directory is not merged, and
  a reviewer's branch is never merged at all.

The frontmatter stays, because it costs nothing and is what an unnamed run honours. A
review on its own — one reviewer, nobody to talk to — may run unnamed.

Two agents started before Claude Code has noticed a new definition get a generic agent
wearing the name: no prompt, the lead's model. **Definitions added in a session are usable
once that session lists them as available agent types — not before.**

## Who owns what

One list, in `.claude/hooks/ownership.json`, read by the guard that stops an edit
(`.claude/hooks/agent-owns.mjs`, wired in `.claude/settings.json`) and by the check that
stops a merge. The guard covers `Write`, `Edit` and `NotebookEdit`; a shell command or
another server's editing tool goes round it, which is why the merge check is the wall.

| Agent | Writes | Never |
| --- | --- | --- |
| `backend` | `packages/core/`, `packages/database/`, `apps/api/`, `turbo.json` | `apps/api/test/` |
| `frontend` | `apps/web/` (the dictionaries included), `packages/ui/`, `apps/docs/` | anything the API owns |
| `tests` | `apps/api/test/` — the end-to-end suites, their harness and README | unit specs: those belong to whoever owns the code beside them |
| `seo` | nothing — reviews the public tree and reports | |
| `accessibility` | nothing — reviews every screen and reports | |
| `invariant-reviewer` | nothing — reads the diff and reports | |
| `migration-reviewer` | nothing — reads every migration before it can reach production, and reports | |
| `plan-evaluator` | nothing — measures plans on the real library, before and after, and reports numbers | |
| the lead | everything else: `docs/`, root configuration, `.claude/`, the lockfile | an agent's directory while that agent is working |

A dependency is added by the lead **before** the agents start: two agents adding one each
is a lockfile conflict nobody owns.

## What has exactly one owner

Splitting by directory stops file collisions. These are the collisions directories do not
stop, and each was found by two agents doing it at once.

| Resource | Owner | Why |
| --- | --- | --- |
| The end-to-end run (`pnpm --filter api test:e2e`) | `tests`, one run at a time | every suite shares one throwaway database; two runs collide over the accounts they create |
| Ports 3000 and 3001, and `/local-probe` | `accessibility`, unless the lead names another | two builds of the web app cannot both listen |
| Migration numbers under `packages/database` | `backend` | two migrations with one number |
| `git push`, the pull request, the merge, the gate | the lead | an agent never pushes; its branch is local |
| The model | nobody: `AI_PROVIDER=stub`, always | an agent's run must never spend the owner's quota |
| Production | nobody | no agent reads or writes it; `guard.mjs` refuses the production database |

Need something from a resource you do not own? Ask its owner, by name.

## The contract comes first

`backend` and `frontend` can run at the same time only because they agreed beforehand.
Before spawning either, the lead writes the contract into the first task (or the spawn
prompt): the routes and their methods, the body each takes, **the view types the web app
will import from `core/controllers/*`**, the error codes, and the dictionary keys a new
screen needs. `tests` writes its suites against the same contract while the code is being
written, and runs them when it lands.

When the consumer finds the contract wrong, it tells the **producer** the shape it expects,
at once and directly — not the lead, and not after both have finished.

## Talking to each other

`SendMessage`, by name: `backend`, `frontend`, `tests`, `seo`, `accessibility`,
`invariant-reviewer`, and `main` for the lead. Plain text you write is **not** seen by
anybody else: if another agent needs it, send it.

- **The first line says what it is about** and stands alone; the rest is detail.
- **A finding goes to whoever owns the file**, not to the lead: severity (P0–P3),
  `path:line`, what is wrong, the smallest fix. One message per owner, all findings in it.
  The lead gets the summary in your hand-back.
- **Reviewers speak early.** `seo` and `accessibility` tell `frontend` what a new screen
  must have — title and description keys, heading outline, labels, targets — while it is
  being built, then verify once it is merged. A requirement sent at the start costs a
  line; the same thing sent as a finding costs a round trip.
- **Do not poll and do not ask "are you done?"** Going idle is what says you are done;
  messages are delivered to you.
- **Never ask another agent to do what you were refused.** A guard that stopped your edit,
  a permission you were denied: that goes to the lead, who asks the owner.
- An agent that disagrees with a finding says so to its author, once, with the reason.
  Still disagreeing, both write to the lead, who decides.

## Starting: every agent, first command

```bash
sh .claude/skills/team/scripts/worktree.sh <your-name> <feature-slug> <base-sha>
```

The lead gives you the last two. You start in the **main checkout** — a named agent is
given no worktree of its own, whatever its definition says — and this makes one, on the
feature's commit, on the branch `agent/<feature>/<you>` that the edit guard knows you by.
It copies the `.env` files, installs, and builds `core` **and** `database`. It ends with
`WORKTREE=<path>`: every command after it starts with `cd "<path>" &&`, and every file you
edit is under that path. **A file you touch in the main checkout is a file in the lead's
tree**, where no guard knows you and another agent may be reading.

Found work already there? Read `git status` and `git log` before doing anything: you are
being resumed, and what is on disk is not to be redone.

## Finishing: what you hand back

Commit on your own branch (`agent/<feature>/<name>`), never push, then report:

- the branch and its last commit;
- the files changed — all inside what you own;
- what you ran, with the result, and **what you could not run**;
- what you sent to whom, and what is still open;
- anything the lead must do that you may not: a dependency, a doc, a decision.

## The lead, before anything is merged

```bash
sh .claude/skills/team/scripts/merge-back.sh <agent> <feature-slug> --check   # then without --check
```

It refuses a branch with uncommitted work left in its worktree, and a branch that touched
a file its agent does not own. Then, once: merge `origin/main` into the feature branch
(never a rebase — the agents' commits are the record), the gate, `/local-probe` and the
design review for anything somebody sees, and the pull request — or the owner's `/ship`.

## When an agent stops half-way

A rate limit ends an agent in the middle; its worktree and its uncommitted files survive.
**Resume it with a message to its name** — its context comes back — telling it to read
`git status` and `git diff` first. Do not spawn another: a new one re-derives everything
and redoes what is on disk.

## Models, and what a run costs

**The lead chooses each agent's model and effort, per task, when it spawns it** — the
rubric is in `.claude/skills/team/SKILL.md` § 1. Measured: the Agent tool's `model` outranks
the definition's (a definition asking for `fable`, spawned with `haiku`, ran as `haiku` and
kept its prompt). The Agent tool takes no effort — **confirmed** by the documentation — but a
definition's `effort:` frontmatter overrides the session's, so each building or verifying
agent exists at three levels: `backend` (`medium`), `backend-low`, `backend-high`, the last
two generated from the first by `.claude/skills/team/scripts/effort-variants.mjs` and checked
in CI. The lead picks the level by `subagent_type` and always spawns under the plain name.

- The lead runs on Opus 5.5 at `high` (owner's instruction, 2026-09-23): its mistakes are
  paid for by every agent after it. It does not wait, read in bulk or do mechanical work —
  scripts and `haiku` do.
- An agent starts on the cheapest model and effort its task's *specification* allows, and
  climbs only on evidence: red at the gate twice, or the same P0 twice — effort first when
  the miss was carelessness, the model when the approach was wrong.
- Older models are allowed but never cheaper in the current lineup, so they are chosen only
  for a behaviour the current one lacks, through a definition's full-id `model:`.
- **No agent runs on `fable`** (owner, 2026-09-23): it spends usage credits that run out —
  one did in the middle of project 004's first phase. `opus` is the ceiling.
- **Two floors never move**: `invariant-reviewer` and `migration-reviewer` are `opus` at
  `high`, and so is whoever implements authentication, allergy validation or the validation
  of model output (`quality-max` in `AGENTS.md`). A one-line change there is not a small
  change.
- A definition's own `model` is only the default for a spawn nobody priced: `sonnet` for
  the agents that build and verify, `opus` for the two reviewers above.
