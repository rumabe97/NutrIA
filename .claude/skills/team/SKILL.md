---
name: team
description: Run a piece of work as the agent team - backend, frontend, tests, seo, accessibility and invariant-reviewer in parallel, each in its own worktree, talking to each other. Use for EVERY feature or fix that touches more than one of API, web, tests or a public page - the owner's standing rule - and whenever the owner says team, agents, in parallel or equipo. Not for a one-file change, a doc or a question.
argument-hint: "[what to build, or the project and phase it belongs to]"
---

# Lead the team

You are the lead. The agents are defined in `.claude/agents/`; how they work together is
`docs/reference/agent-team.md` — **read it now**, because you enforce it. What to build:
`$ARGUMENTS`.

The owner's rule is that feature work runs as this team, every time, not only when
reminded. The failure this skill exists to prevent is doing the whole feature inline
because it looked small.

## 1. Pick the roster

| The change | Agents |
| --- | --- |
| API only | `backend`, `tests`, and `invariant-reviewer` if it touches who may read what |
| Web only, signed-in screens | `frontend`, `accessibility` |
| Web only, a public page | `frontend`, `seo`, `accessibility` |
| A feature, end to end | all six |
| A review, nothing to build | the reviewer alone, as a subagent |

Authentication, allergy validation or the validation of model output is `quality-max`:
name `fable` when spawning the implementers, which outranks their definition.

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
- The prompt: the feature slug and `<base-sha>`; the contract; its part; **who else is
  running, by name, and what each is doing**; what to hand back. Nothing it can read in
  its own definition or in the protocol.

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

Who ran, and what each delivered; what they told each other that changed the result; every
P0 and P1 and what became of it; what was not verified; what is the owner's to do.
