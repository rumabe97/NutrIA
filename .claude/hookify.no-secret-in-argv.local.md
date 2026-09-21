---
name: no-secret-in-argv
enabled: true
event: bash
action: block
pattern: \b(curl|wget)\b[^\n]*(-H|--header)\s*["']?\s*(authorization|x-api-key|api-key)\s*:|\bbearer\s+[a-z0-9._~+/-]{16,}|\b(sk|rk|pk|whsec)_(live|test)_[a-z0-9]{8,}
---

**A credential on a command line is a credential in the process list, the shell history and this transcript.**

- `curl`: put the header in a config file and pass `-K <file>` (the file lives in the scratchpad, never in the repository)
- Node: read the key from the environment **inside** the script and send it with `fetch`
- Never paste a key's value into a command, even a test key
