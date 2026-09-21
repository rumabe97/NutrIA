// Stops a team agent from editing a file another agent owns.
//
// Wired for the whole project in .claude/settings.json, NOT in the agents' own
// frontmatter: measured on Claude Code 2.1.278, an agent spawned with a name runs as a
// teammate, and a teammate gets its definition's prompt and model and none of its `tools`,
// `isolation` or `hooks`. A guard only the definition declares is a guard that never runs.
//
// So who is editing is worked out here, in this order:
//   1. a name passed as the argument (a definition's own hook, where those do run);
//   2. a name Claude Code puts in the hook's input, if it ever does;
//   3. the branch of the checkout the file is in — `agent/<feature>/<name>`, which is where
//      `worktree.sh` puts every agent. Any other branch is the lead's, and is left alone.
//
// The map is ownership.json, beside this file, and is the same one the lead's merge-back
// check reads — one list, so the two cannot disagree.
//
// It is a guard rail, not a wall: a shell command, or another server's editing tool, can
// still write anywhere. The wall is the lead refusing to merge a branch that touched
// somebody else's directory (.claude/skills/team/scripts/merge-back.sh), and never merging
// a reviewer's branch at all. This exists so the mistake is caught at the first keystroke,
// with the name of who to talk to, instead of at the merge.
//
// Exit 2 blocks the call and hands stderr to the agent. Anything unexpected exits 0: a
// broken guard must not stop the work.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const map = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ownership.json'), 'utf8'));
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;

  if (!target) process.exit(0);

  // The checkout the file is in — the main one or an agent's worktree. `.git` is a
  // directory in the first and a file in the second, and either marks the root.
  let root = resolve(dirname(target));

  while (!existsSync(join(root, '.git'))) {
    const parent = dirname(root);

    // Not in a repository at all: a scratchpad, /tmp. Nobody owns that.
    if (parent === root) process.exit(0);

    root = parent;
  }

  // A worktree's `.git` is a file naming the main checkout's git directory; following it
  // is how a worktree anywhere on disk is recognised as this repository, and how another
  // repository (the owner's design skill, say) is recognised as none of this team's business.
  const mainOf = checkout => {
    const marker = join(checkout, '.git');
    const pointer = statSync(marker).isFile() ? readFileSync(marker, 'utf8').match(/^gitdir:\s*(.+?)[\\/]\.git[\\/]worktrees[\\/]/m) : null;

    return resolve(pointer ? pointer[1] : checkout);
  };
  const here = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

  if (mainOf(root) !== mainOf(here)) process.exit(0);

  // The branch of that checkout, read from its HEAD without starting git.
  const branchOf = checkout => {
    const marker = join(checkout, '.git');
    const gitDir = statSync(marker).isFile() ? readFileSync(marker, 'utf8').match(/^gitdir:\s*(.+)$/m)?.[1].trim() : marker;
    const head = gitDir ? readFileSync(join(gitDir, 'HEAD'), 'utf8').match(/^ref: refs\/heads\/(.+)$/m)?.[1] : undefined;

    return head?.match(/^agent\/[^/]+\/([^/]+)$/)?.[1];
  };
  const named = [process.argv[2], input.agent_type, input.agent_name, input.teammate_name].find(name => name && map[name]);
  const agent = named ?? branchOf(root);
  const mine = agent ? map[agent] : undefined;

  if (!mine) process.exit(0);

  const path = relative(root, resolve(target)).split(sep).join('/');
  const under = prefix => path === prefix || path.startsWith(prefix);

  if (mine.owns.some(under) && !mine.except.some(under)) process.exit(0);

  const owner = Object.entries(map).find(([, entry]) => entry.owns.some(under) && !entry.except.some(under))?.[0] ?? 'the lead';
  const mineText = mine.owns.length > 0 ? mine.owns.join(', ') : 'nothing — it reviews and reports';

  console.error(
    `${path} is not ${agent}'s to edit (${agent} owns: ${mineText}). It belongs to ${owner}. ` +
      `Do not work around this with a shell command: send ${owner} a message saying what you need changed and why ` +
      `(docs/reference/agent-team.md § Talking to each other).`
  );
  process.exit(2);
} catch {
  process.exit(0);
}
