#!/usr/bin/env python3
"""The hookify rules of this repository, run through hookify's own engine.

Usage: python3 .claude/hooks/test-hookify-rules.py        (from the repository root)

A rule that blocks too little is a rule nobody can rely on; one that blocks too much gets
switched off. So every rule is held to commands it must stop AND commands it must let
through — the second list is the one that finds the bugs. Skips, without failing, on a
machine where the hookify plugin is not installed: the rule files are inert there anyway.
"""
import glob
import os
import sys

ROOTS = glob.glob(os.path.expanduser('~/.claude/plugins/cache/*/hookify/*')) + glob.glob(
    os.path.expanduser('~/.claude/plugins/marketplaces/*/plugins/hookify')
)
PLUGIN = next((root for root in ROOTS if os.path.isfile(os.path.join(root, 'core', 'rule_engine.py'))), None)

if PLUGIN is None:
    print('hookify is not installed here — nothing to test (claude plugin install hookify@claude-plugins-official)')
    sys.exit(0)

sys.path.insert(0, PLUGIN)
from core.config_loader import load_rules  # noqa: E402
from core.rule_engine import RuleEngine  # noqa: E402

BLOCK, WARN, PASS = 'block', 'warn', 'pass'

# Shaped like a payment provider's keys and belonging to nobody. Spelled in halves so that no
# secret scanner — the host's, or this repository's own rule — reads this file as a leak.
FAKE_TEST_KEY = 'sk_' + 'test_' + 'abcdefgh12345678'
FAKE_LIVE_KEY = 'sk_' + 'live_' + 'abcdefghijklmnop1234'

# (what the agent runs, what must happen, which rule is expected to speak)
BASH = [
    # no-env-contents
    ('cat apps/api/.env', BLOCK, 'no-env-contents'),
    ('grep -o "^[A-Z_]*=" packages/database/.env | sort -u', BLOCK, 'no-env-contents'),
    ('head -3 apps/web/.env.local', BLOCK, 'no-env-contents'),
    ('cd apps/api && source .env', BLOCK, 'no-env-contents'),
    ('sed -n 1,20p apps/api/.env.example', PASS, None),
    ('grep -rn "process.env.DATABASE_URL" apps/api/src', PASS, None),
    ('grep -rn "import.meta.env.MODE" apps/web/src', PASS, None),
    ('ls -la apps/api/.env packages/database/.env', PASS, None),
    ('git check-ignore -v apps/api/.env', PASS, None),
    ('node .claude/hooks/env-names.mjs apps/api/.env', PASS, None),
    ('cat apps/api/src/config/env.provider.ts', PASS, None),
    ('cat .envrc.sample', PASS, None),
    # no-git-stash
    ('git stash', BLOCK, 'no-git-stash'),
    ('git stash push -u -m wip', BLOCK, 'no-git-stash'),
    ('git -C ../other stash pop', BLOCK, 'no-git-stash'),
    ('git stash list', PASS, None),
    ('git log --oneline -- docs/stashing.md', PASS, None),
    # no-skipping-checks
    ('git commit --no-verify -m x', BLOCK, 'no-skipping-checks'),
    ('git push --force origin feat/x', BLOCK, 'no-skipping-checks'),
    ('git push -f', BLOCK, 'no-skipping-checks'),
    ('gh pr merge 12 --squash --admin', BLOCK, 'no-skipping-checks'),
    ('git push --force-with-lease origin feat/x', PASS, None),
    ('git push -u origin HEAD', PASS, None),
    ('gh pr merge 12 --squash --delete-branch', PASS, None),
    # no-process-dump
    ('ps aux | grep node', BLOCK, 'no-process-dump'),
    ('ps -ef', BLOCK, 'no-process-dump'),
    ('ps -o args= -p 123', BLOCK, 'no-process-dump'),
    ('cat /proc/4242/environ', BLOCK, 'no-process-dump'),
    ('pkill -f "next start"', BLOCK, 'no-process-dump'),
    ('pgrep -fa node', BLOCK, 'no-process-dump'),
    ('ps -o comm= -p 123', PASS, None),
    ('ss -ltnpH "sport = :3001"', PASS, None),
    ('kill 123', PASS, None),
    # no-secret-in-argv
    ('curl -s -H "Authorization: Bearer $KEY" https://example.invalid/v1/models', BLOCK, 'no-secret-in-argv'),
    ("curl --header 'x-api-key: abc' https://example.invalid", BLOCK, 'no-secret-in-argv'),
    ('echo ' + FAKE_TEST_KEY, BLOCK, 'no-secret-in-argv'),
    ('curl -s -K /tmp/scratch/curl.conf https://example.invalid/v1/models', PASS, None),
    ("curl -s -H 'content-type: application/json' -H 'origin: http://localhost:3000' http://localhost:3001/api/v1/health", PASS, None),
    ("curl -s -b 'better-auth.session_token=abc' http://localhost:3001/api/v1/users/me", PASS, None),
    # production-by-hand
    ('vercel --prod', BLOCK, 'production-by-hand'),
    ('vercel env pull .env.production', BLOCK, 'production-by-hand'),
    ('npx vercel rollback', BLOCK, 'production-by-hand'),
    ('grep -n vercel docs/reference/deployment.md', PASS, None),
    ('cat apps/api/vercel.json', PASS, None),
    # production-database
    ('cd packages/database && DB=DATABASE_URL_PRO node _check.mjs', WARN, 'production-database'),
    # look-before-deleting / catastrophic-rm
    ('git reset --hard origin/main', WARN, 'look-before-deleting'),
    ('git worktree remove --force .claude/worktrees/x', WARN, 'look-before-deleting'),
    ('git branch -D agent/demo/backend', WARN, 'look-before-deleting'),
    ('rm -rf apps/web/.next', WARN, 'look-before-deleting'),
    ('rm -rf /', BLOCK, 'catastrophic-rm'),
    ('rm -rf ~', BLOCK, 'catastrophic-rm'),
    ('rm -rf $HOME', BLOCK, 'catastrophic-rm'),
    ('rm -rf .', BLOCK, 'catastrophic-rm'),
    ('rm -rf *', BLOCK, 'catastrophic-rm'),
    ('rm -f apps/api/_tmp.mjs', PASS, None),
    ('git branch -d merged-branch', PASS, None),
    ('git status --short', PASS, None),
    ('pnpm turbo lint ts:check test', PASS, None),
    # Naming a command is not running it. Each of these was, or would have been, stopped by a
    # pattern that looked for the words anywhere: a commit message about the rule, a search for
    # it, a prompt that quotes it. A rule that does that gets switched off within the week.
    ('git commit -m "docs: never use git stash here, use a worktree"', PASS, None),
    ('grep -rn "git stash" docs/ .claude/', PASS, None),
    ('claude -p "run this exact command: git stash  and report"', PASS, None),
    ('echo "a check is fixed, never skipped with --no-verify"', PASS, None),
    ('grep -n "ps aux" docs/reference/agent-team.md', PASS, None),
    ('echo "rm -rf / would be refused"', PASS, None),
    ('grep -rn "vercel --prod" docs/', PASS, None),
    ('git log --grep="cat .env"', PASS, None),
    # ...while the same words in command position are still stopped, wherever in the line.
    ('cd apps/api && git stash', BLOCK, 'no-git-stash'),
    ('true; ps aux', BLOCK, 'no-process-dump'),
    ('pnpm build || vercel --prod', BLOCK, 'production-by-hand'),
    ('echo start\ngit push --force', BLOCK, 'no-skipping-checks'),
    ('(cd apps/api && cat .env)', BLOCK, 'no-env-contents'),
]

# Spelled in halves: `pnpm check:leaks` refuses an absolute home path in a tracked file, and
# it is right to — even here, where the path is the thing under test.
HOME_PATH = '/' + 'home/somebody/projects/app'
USERS_PATH = '/' + 'Users/somebody/code/app/'

FILES = [
    ('apps/web/src/lib/x.ts', 'const root = "' + HOME_PATH + '";', WARN, 'public-repository-paths'),
    ('docs/reference/x.md', 'Run it from ' + USERS_PATH + ' first.', WARN, 'public-repository-paths'),
    ('docs/local/notes.md', 'my checkout is ' + HOME_PATH + '/', PASS, None),
    ('apps/web/src/lib/x.ts', 'const path = join(root, "home", "page");', PASS, None),
    ('apps/api/src/x.ts', 'const key = "' + FAKE_LIVE_KEY + '";', WARN, 'public-repository-secrets'),
    ('apps/api/src/x.ts', 'const url = "postgresql://app:s3cr3tpassw0rd@db-host.example.com/app";', WARN, 'public-repository-secrets'),
    ('apps/api/src/config/Env.validation.spec.ts', "DATABASE_URL: 'postgresql://user:pass@host/db'", PASS, None),
    # Built, not written: hookify cuts a rule's frontmatter at the first run of three dashes, and a
    # literal one in a pattern once left this rule matching every file there is.
    ('apps/api/src/x.ts', '-' * 5 + 'BEGIN PRIVATE KEY' + '-' * 5, WARN, 'public-repository-secrets'),
    ('apps/web/src/lib/x.ts', 'export const answer = 42;', PASS, None),
    ('apps/api/src/x.ts', 'const price = env.STRIPE_PRICE_ID;', PASS, None),
]


def verdict(response, rule):
    """(what happened, whether the expected rule is the one that spoke)."""
    message = response.get('systemMessage', '')
    blocked = response.get('hookSpecificOutput', {}).get('permissionDecision') == 'deny' or response.get('decision') == 'block'
    happened = BLOCK if blocked else (WARN if message else PASS)

    return happened, (rule is None or f'[{rule}]' in message)


engine = RuleEngine()
failures = 0
cases = [('bash', {'tool_name': 'Bash', 'tool_input': {'command': command}}, command, want, rule) for command, want, rule in BASH] + [
    ('file', {'tool_name': 'Write', 'tool_input': {'file_path': path, 'content': content}}, f'{path} ← {content}', want, rule)
    for path, content, want, rule in FILES
]

for event, data, label, want, rule in cases:
    data['hook_event_name'] = 'PreToolUse'
    happened, right_rule = verdict(engine.evaluate_rules(load_rules(event=event), data), rule)

    if happened != want or not right_rule:
        failures += 1
        print(f'FAIL  wanted {want:5} got {happened:5}{"" if right_rule else f" (not from {rule})"}  {label}')

rules = len(load_rules())
print(f'{len(cases) - failures}/{len(cases)} cases behave, across {rules} rules')
sys.exit(1 if failures else 0)
