# Title (e.g. Brand, Domain, Verification, Supabase runbook)

> **Purpose**: one evergreen reference doc — domain knowledge, a living design contract,
> a subsystem/functional spec (numbered requirements, data models, API surfaces — PRDs
> cite their stable IDs), a verification playbook (how to exercise the app empirically
> and read results), or a runbook (including owner-only ops steps agents must know about
> but cannot perform). Copy this file to `docs/reference/NAME.md` — or co-locate it next
> to the code it governs, linked from here (see AGENTS.md § Rules). Outlives any
> project; updated in the same change that invalidates it (same rule as ARCHITECTURE.md).
> Boundary: a subsystem's own contract belongs here; the cross-cutting system shape and
> its invariants belong in `docs/ARCHITECTURE.md`.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> owner approves.
>
> Evidential content rule: label facts as **confirmed** (verified, with how) or
> **hypothesis** (best current belief, with the open question). Reference docs are
> trusted by every future agent — an unlabeled guess becomes a false fact.

## Content

<!-- Structure freely per subject. For runbooks: numbered steps, marking owner-only
     ones explicitly. For domain knowledge: group by concept, cite evidence. -->
