---
name: ship
description: Take the work in the tree to production - gate, commit, push, pull request, wait for CI, merge, and watch the deploy until production serves it. Only the owner starts this, by typing /ship; it commits, merges and deploys.
disable-model-invocation: true
argument-hint: "[public pages to check in production, e.g. /condiciones] [anything to leave out]"
---

# Ship

The owner typed `/ship`, and that is the go-ahead for everything below, merge included —
for the work in the tree now, and nothing later. Arguments, if any: `$ARGUMENTS`. Read
them as **public** pages to check in production once it is out, and as notes on what to
leave out. A signed-in screen among them is not an error, but it cannot be checked by
address — see step 7.

You stop, and say why, rather than work around any of these: a red gate, a red CI run, a
file you cannot account for, something that looks like a secret. Never `--no-verify`,
never `--admin`, never a force push, never `git stash` — work that is not going out stays
on a branch or a worktree.

## 1. Know what is going out

```bash
git status --short
git diff --stat
```

- Account for every path. Something you did not write in this conversation is read before
  it is staged, not after.
- Never staged: `docs/local/`, any `.env`, anything holding a key or a connection string.
- Project documents (`docs/projects/NNN-*/`, and a roadmap entry for a project the owner
  has not approved) go out only if the owner said so in this conversation. `/plan-project`
  says the owner commits those; `/ship` does not overrule it by itself.
- On `main`: `git switch -c <short-kebab-slug>` first. Nothing is committed to `main`.

## 2. The record is part of the change

Before the gate, not after the merge:

- A choice that constrains future work has an ADR (`docs/decisions/NNNN-*.md`) or a line in
  `docs/decisions/LOG.md`, with who decided.
- A rule a future agent must not break is in the nearest `AGENTS.md`.
- A new environment variable is in `Env.validation.ts`, `turbo.json` `globalEnv`,
  `apps/api/.env.example` and `docs/reference/deployment.md` — the spec for the first two
  fails otherwise.
- What the legal pages describe (what is collected, what reaches the model, how Premium
  renews and cancels) changed? Then `/privacidad` and `/condiciones` change with it.

## 3. The gate

```bash
sh .claude/skills/ship/scripts/gate.sh --full "<your scratchpad directory>"
```

`--full` is everything CI's required check runs — the migration guard, lint, types, tests
**with coverage**, the web build and every public page still static — plus format, dead
code and leaks. Without the flag it is the quick version, for while you work. The leak check runs **only here**: its
pattern list is gitignored, so CI cannot. A `format` failure is fixed with
`pnpm --filter web --filter ui format:fix` and `pnpm exec prettier --write <files>` inside
`apps/api`, then the gate runs again from the top.

A change to what somebody sees has been through the design review
(`apps/web/AGENTS.md` § Design review) **before** it ships: reviewed with the owner's
`apple-web-design` skill, P0 and P1 fixed, looked at with `/local-probe`. If it has not,
do that now and fix what it finds; the verdict goes in the pull request's `## Checked`.

## 4. Commit

Stage by path, then read `git status --short` again. One commit unless the work is two
unrelated things.

The title is a sentence saying what is now true, the way this history reads: *The shopping
list can be sent, and the nearest shops are a tap away*. No `feat:` prefix, no ticket
number, no full stop. The body says why, and what was deliberately not done. End with the
attribution lines this session's system reminder gives, exactly as given.

## 5. Pull request

```bash
git push -u origin HEAD        # the pre-push hook runs lint, types and tests again
gh pr create --title "<the commit title>" --body "<below>"
```

The body is in English, like the repository: `## What` (what changed and why, as bullets),
`## Checked` (what was run and what was looked at, and what could not be), `## Docs` when
the record changed. Anything the owner must do for it to work — a variable on Vercel, a
switch on `/admin` — is the last line of `## What`. End with the pull-request attribution
line from the system reminder.

## 6. CI, then merge

```bash
sh .claude/skills/ship/scripts/wait-for-ci.sh <number>     # run it in the background
```

One line back: green, failed (and how to read why), or never appeared. **Not**
`gh pr checks --watch`: started right after the pull request is opened it sees only the
host's checks, all green, and returns before Actions has registered its own — a false green
one step from a merge. And never a model looking every minute: waiting costs nothing when a
script does it.

Both `lint · types · tests` and `end-to-end` must pass. The two Vercel checks read
*Canceled by Ignored Build Step* on every branch but `main`, on purpose: that is not a
failure. On a red run: read the log (`gh run view <id> --log-failed`), fix it on the
branch, push, and wait again. Report and stop after the second red run.

```bash
gh pr merge <number> --squash --delete-branch
git switch main && git pull origin main
```

## 7. Production

```bash
sh .claude/skills/ship/scripts/wait-for-deploy.sh "$(git rev-parse origin/main)" <pages from the arguments>
```

It waits for Vercel to report both production deployments of that commit to GitHub, then
asks the API's health route and each page for a 200. A migration in the change runs during
the API's build, against production — say so in the report. A failed deployment is
reported with its state and left alone: no revert, no redeploy, without the owner.

**Only public pages can be asked for a 200.** A signed-in screen (`PROTECTED` in
`apps/web/src/proxy.ts`: `/perfil`, `/plan`, `/inicio`…) redirects a caller with no session
to sign-in, and the script reports it as *needs a session, not checked* rather than as a
failure. The two deployments succeeding is what says the commit is live. To show the
**change** is, find it in what production serves: for a stylesheet, fetch a public page,
follow its `/_next/static/…css` links and grep for the new rule; for markup only a session
reaches, say in the report that it was not seen in production and how the owner can see it.

For a change whose effect is not a page — an endpoint, a header, a redirect — ask
production for that, by hand, and show the answer.

## 8. Report, in Spanish

What went out and the pull request number; what CI said; what production answered; what
was left out and why; what is now the owner's to do. Then update memory if something
about how this project ships turned out to be different from what memory says.
