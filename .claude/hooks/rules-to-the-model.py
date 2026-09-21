#!/usr/bin/env python3
"""Hands the agent the reason a hookify rule stopped it, and what to do instead.

hookify blocks well and explains badly: its message goes to the person watching
(`systemMessage`), and the agent is told only "Blocked by hook". An agent stopped without a
reason looks for a way round; one told "the owner's rule is X, do Y instead" does Y. A
warning is worse off still — the agent never sees it at all.

This is not a second rule engine. It imports hookify's own, reads the same
`.claude/hookify.*.local.md` files, and re-issues the verdict in the two fields the agent
does read: `permissionDecisionReason` for a block, `additionalContext` for a warning.

It also stands where the rules are. hookify looks for `.claude/` in the current directory,
so after a `cd apps/api` every rule is silently off; this one goes to the project root first.

Without the hookify plugin it does nothing: the rule files are inert on that machine anyway.
Any failure exits 0 — a broken messenger must not stop the work.
"""
import glob
import json
import os
import sys


def main() -> None:
    data = json.load(sys.stdin)
    event = {'Bash': 'bash', 'Edit': 'file', 'Write': 'file', 'MultiEdit': 'file'}.get(data.get('tool_name', ''))

    if event is None:
        return

    roots = glob.glob(os.path.expanduser('~/.claude/plugins/cache/*/hookify/*')) + glob.glob(
        os.path.expanduser('~/.claude/plugins/marketplaces/*/plugins/hookify')
    )
    plugin = next((root for root in roots if os.path.isfile(os.path.join(root, 'core', 'rule_engine.py'))), None)

    if plugin is None:
        return

    # The checkout this session works in: an agent's worktree has its own copy of the rules.
    here = os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()

    while not glob.glob(os.path.join(here, '.claude', 'hookify.*.local.md')):
        parent = os.path.dirname(here)

        if parent == here:
            return

        here = parent

    os.chdir(here)
    sys.path.insert(0, plugin)

    from core.config_loader import load_rules
    from core.rule_engine import RuleEngine

    data.setdefault('hook_event_name', 'PreToolUse')
    verdict = RuleEngine().evaluate_rules(load_rules(event=event), data)
    message = verdict.get('systemMessage')

    if not message:
        return

    denied = verdict.get('hookSpecificOutput', {}).get('permissionDecision') == 'deny'
    output = {'hookEventName': 'PreToolUse'}

    if denied:
        output['permissionDecision'] = 'deny'
        output['permissionDecisionReason'] = message
    else:
        output['additionalContext'] = f'A rule of this repository has something to say about that call:\n\n{message}'

    print(json.dumps({'hookSpecificOutput': output}))


try:
    main()
except Exception:  # noqa: BLE001 — see the docstring
    pass

sys.exit(0)
