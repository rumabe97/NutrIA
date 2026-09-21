---
name: public-repository-secrets
enabled: true
event: file
action: warn
conditions:
  - field: content
    operator: regex_match
    pattern: \b(sk|rk|whsec)_(live|test)_[a-z0-9]{16,}|-{5}BEGIN [A-Z ]*PRIVATE KEY-{5}|postgres(ql)?://[^\s:/@]+:[^\s@]{6,}@[a-z0-9-]+\.[a-z]
---

**This looks like a real credential going into a file, and the repository is public.** A test fixture uses an obviously fake one (`postgresql://user:pass@host/db`, a key generated inside the test). A real value belongs in a gitignored `.env`, written by the owner, never by an agent.

If it is real and it was ever committed or printed, it is burnt: tell the owner to rotate it.
