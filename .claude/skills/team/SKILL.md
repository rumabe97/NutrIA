---
name: team
description: Run a piece of work as the agent team - backend, frontend, tests, seo, accessibility and invariant-reviewer in parallel, each in its own worktree, talking to each other. Use for EVERY feature or fix that touches more than one of API, web, tests or a public page - the owner's standing rule - and whenever the owner says team, agents, in parallel or equipo. Not for a one-file change, a doc or a question.
argument-hint: "[what to build, or the project and phase it belongs to]"
model: fable
---

# Lead the team

You are the lead. The agents are defined in `.claude/agents/`; how they work together is
`docs/reference/agent-team.md` — **read it now**, because you enforce it. What to build:
`$ARGUMENTS`.

The owner's rule is that feature work runs as this team, every time, not only when
reminded. The failure this skill exists to prevent is doing the whole feature inline
because it looked small.

## 0. What you are paid for, and what you are not

You run on the strongest model because your mistakes multiply: a wrong split, a vague
contract or a missed invariant is paid for by every agent after you. (This skill asks for
`fable` for the turn that plans; later turns run on the session's model — if that is a
weaker one, say so in the report.) **Everything else you do as cheaply as it can be done
well.** The owner's words: no cannons for flies.

- **You do not wait.** Waiting is a script in the background; the session is told when it
  ends. `sh .claude/skills/ship/scripts/wait-for-ci.sh <pr>` and
  `wait-for-deploy.sh` — never a model looking every minute, yours least of all.
- **You do not read in bulk.** To learn where something lives, how many places use it, or
  what a log says, spawn an `Explore` agent on `haiku` and take its conclusion. Your context
  is the most expensive in the room; spend it on decisions.
- **You do not do the mechanical work** — the gate, formatting, a rename, a merge check are
  scripts or the cheapest agent.
- **Machines verify first.** The gate, the end-to-end run, the probe, `merge-back.sh`,
  `check-migrations.mjs`. A reviewing model is spent only on what a machine cannot judge.

## 1. Split the work, pick the roster, and price every task

Write the task list **before** anything is spawned, one line each: what, which agent, which
model, and why that model. It goes in your report, so the owner can see what was spent on
what.

| The change | Agents |
| --- | --- |
| API only | `backend`, `tests`; `invariant-reviewer` if it touches who may read what |
| A schema change, however small | the above, and **always** `migration-reviewer` |
| Prompts, the scheduler, portion sizing, validation, the allergy layer | the above, and **always** `plan-evaluator` |
| Web only, signed-in screens | `frontend`, `accessibility` |
| Web only, a public page | `frontend`, `seo`, `accessibility` |
| A feature, end to end | whichever of the above its parts call for — not all eight by reflex |
| A review, nothing to build | the reviewer alone |

**The model is yours to choose, per task, at spawn** — the Agent tool's `model` outranks the
definition's (measured: a definition asking for `fable`, spawned with `haiku`, ran as
`haiku` and kept its prompt). Effort cannot be set per agent: agents inherit yours, so the
model and the size of the prompt are the two levers you have.

| Model | A task belongs here when… | For instance |
| --- | --- | --- |
| *none — a script* | a machine can do it and say so in a line | waiting for CI or a deploy, the gate, `merge-back.sh`, the probe's measurements, formatting |
| `haiku` | it is finding, counting, summarising, or an edit whose every character you can specify | where a symbol is used; what a failed run's log says; add one key to both dictionaries; re-check that a fixed finding is fixed |
| `sonnet` | the contract is complete: files named, shapes given, the test that proves it named | a route from a written contract; unit tests for named uncovered lines; an end-to-end suite from the contract; an SEO or accessibility verification pass |
| `opus` | a decision is still open inside the task, or the cause is unknown | a feature whose design you could not finish; a failure nobody understands yet; a refactor across modules |
| `fable` | a mistake is a safety or privacy failure, or the judgement is the deliverable | `invariant-reviewer` and `migration-reviewer`, always; implementing authentication, allergy validation or the validation of model output (`quality-max`); an SEO audit of the landing page; ruling on a disputed P0 |

**The more precisely you specify, the cheaper the agent that can do it.** A paragraph of
yours that names the file, the function and the failing case moves a task from `opus` to
`sonnet`; that is the best trade in this skill, and the reason the lead is the strong model.

**Start at the cheapest model the specification allows, and climb only on evidence**: the
same task red at the gate twice, or a reviewer's P0 on the same point twice. Then spawn the
next model up **on the same branch**, with the failing output — the one case where an agent
is replaced rather than resumed. Never climb because a task *feels* important, and never
drop below the floors above because a change *looks* small: a one-line migration drops a
column as thoroughly as a long one.

## 2. Branch first, and nothing else

```bash
git status --short                       # a dirty tree is dealt with before, not during
git switch -c feat/<slug>                # never on main, never on another open branch
git rev-parse HEAD                       # <base-sha>: every agent starts from here
```

Add any **new dependency now**, yourself, and commit it: two agents adding one each is a
lockfile conflict nobody owns. Then `<base-sha>` is the commit after that.

## 3. Write the contract

Before spawning `backend` and `frontend`: the routes and methods, each body, **the view
types the web app will import from `core/controllers/*`**, the error codes, the dictionary
keys a new screen needs, and what must **not** be possible (whose data a route may never
return). It goes in the spawn prompt of all three of `backend`, `frontend` and `tests`,
word for word the same. Skipping this is what makes one agent wait for the other.

## 4. Spawn them together

**As named agents** — one message, every Agent call in it, so they start at the same
moment. A name is what gives an agent a mailbox; without one it can talk to nobody.
Spawn only agent types this session lists as available: a definition it has not noticed
yet yields a generic agent wearing the name, with none of the prompt.

- `subagent_type` and `name` both the agent's name (`backend`, `frontend`, …): the name is
  how the others address it. Do **not** pass `isolation`: the agent makes its own worktree.
- `model`: the one your task list gave it. Always pass it; the definition's is only the
  default for a spawn nobody priced.
- The prompt: the feature slug and `<base-sha>`; the contract; its part; **who else is
  running, by name, and what each is doing**; what to hand back. **Nothing it can read in
  its own definition or in the protocol** — every line of a spawn prompt is paid for again
  on every turn that agent takes. Point at a file and a line rather than quoting it.
- A reviewer is given a range — `git diff <base>...<branch>` — not "the repository".

With several agents and real dependencies, add one task per agent to the shared list
(`tests` runs after `backend` lands; reviewers verify after `frontend` lands). Teams are
experimental, and enabled in the owner's settings.

Reviewers start **with** the implementers, not after: `seo` and `accessibility` send
`frontend` what a screen must have while it is being built; `tests` writes suites from the
contract.

## 5. While they run

- **Your own tree stays clean.** `git status --short` in the main checkout should show
  nothing new: a file appearing there is an agent working outside its worktree. Find out
  whose, and send it back to its `WORKTREE`.
- Do not relay what they can say to each other. Answer what only you can: a decision, a
  dependency, a doc.
- When a consumer reports the shape it expects, make sure the producer has it **now**.
- A refused edit or a denied permission reported to you goes to the owner. You do not do
  for an agent what it was refused.
- **An agent that stops half-way is resumed, not replaced**: a message to its name, telling
  it to read `git status` and `git diff` first.
- **An agent whose work is merged and verified is ended** (a shutdown request to its name).
  An idle agent costs nothing until something wakes it, and a stray message will.

## 6. Bring the work back

For each implementer, in this order — `backend`, `frontend`, `tests`:

```bash
sh .claude/skills/team/scripts/merge-back.sh <agent> <slug> --check
sh .claude/skills/team/scripts/merge-back.sh <agent> <slug>
```

A refusal is a conversation with that agent, never a `--force`. Then tell `tests` the
merged commit for its full run, and `seo`, `accessibility` and `invariant-reviewer` to
verify on it. Findings go to the owners; fixes come back the same way. **A P0 from anybody
holds the merge.**

## 7. Finish as the lead

Merge `origin/main` into the feature branch once — a merge, not a rebase. Write what is
yours: the ADR or `LOG.md` line, the `AGENTS.md` rule, `deployment.md`. Then the gate, and
the pull request — or tell the owner it is ready for `/ship`:

```bash
sh .claude/skills/ship/scripts/gate.sh "<scratchpad>"
sh .claude/skills/ship/scripts/wait-for-ci.sh <pr>        # in the background; never poll
```

## 8. Clean up, looking first

```bash
git worktree list
git -C <worktree> status --short         # anything here is somebody's work: read it
git worktree remove <worktree> && git branch -d agent/<slug>/<agent>
```

Only worktrees of this feature, only once merged. A worktree you did not create is the
owner's to decide on.

## Report, in Spanish

The task list as it was run — task, agent, model, and any climb with its reason; what each
delivered; what they told each other that changed the result; every P0 and P1 and what
became of it; what was not verified; what is the owner's to do.
