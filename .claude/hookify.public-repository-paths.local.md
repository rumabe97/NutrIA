---
name: public-repository-paths
enabled: true
event: file
action: warn
conditions:
  - field: content
    operator: regex_match
    pattern: /(home|Users)/[a-z][\w.-]*/
  - field: file_path
    operator: not_contains
    pattern: docs/local
---

**An absolute home path names the machine and the person who wrote the line, and this repository is public.** `pnpm check:leaks` fails on it, and CI cannot run that check — only this machine can.

Write the path relative to the repository root, or derive it at run time (`git rev-parse --show-toplevel`, `import.meta.url`).
