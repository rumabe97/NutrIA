# Architecture

> **Purpose**: how the system is designed — the module map, data flow, and invariants
> that every change must respect. This is the doc agents read before touching code.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> the owner approves; updated in the same change whenever a project alters the design.

## System overview

<!-- One diagram-in-words: the apps, the packages, and how a request flows through them.
     The template baseline is documented in AGENTS.md § Repo layout — describe what THIS
     workspace adds or changes on top of it. Include a short "current state" note (what
     exists today vs. what's designed-but-unbuilt) — ROADMAP.md stays purely
     forward-looking, so this is where the live inventory belongs. -->

## Data model

<!-- The core entities and their relationships. Link to packages/database/src/schemas. -->

## Invariants

<!-- The rules that must never break, with the reason each exists. Examples from the
     template: apps never import from `database` directly; all data access goes through
     `packages/core` controllers. Add this project's own. -->

## Key decisions

<!-- One line per structural decision, linking to its record in docs/decisions/. -->
