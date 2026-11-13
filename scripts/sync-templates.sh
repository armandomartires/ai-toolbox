#!/usr/bin/env bash
# Regenerate every tracked planning template from the schema that owns its
# shape (ADR-0027).
#
# Why generated copies exist at all. A template must sit where the framework
# that uses it can reach it: project-workflow's and project-migration's under skills/. A schema is the one owner of shape, so the templates
# have to be derived from it or they become second owners -- which is exactly
# what they were. project-workflow's own template contradicted its SKILL.md
# about the task ID format, and nothing caught it, because both were prose.
#
# The copies are not second owners. Each schema remains the only owner; these
# files are rendered, never paraphrased, and tests/validate.sh fails when they
# drift. That is the same derived-artifact-plus-staleness-check shape
# docs/registry.md and scripts/sync-decision-standard.sh already use.
#
# 10.CURRENT_STATE.md, 40.RISK_REGISTER.md and a session record are
# generated too (S017.T003): each is one instance of a schema.
#
# NOT regenerated: 20.PLAN.md, 30.ROADMAP.md and 35.AD_HOC_TASKS.md. Those are
# indexes holding many entries, not instances of one artifact. The ad-hoc
# ENTRY has a schema and the generator prints one on request; the list it
# lives in stays hand-maintained.
set -euo pipefail
cd "$(dirname "$0")/.."

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

GEN=skills/project-workflow/scripts/new-artifact.sh
# --check compares each template against what its schema renders, in memory,
# and writes nothing. That is how tests/validate.sh tests these files without
# rewriting them -- the same need STANDARD_OUT serves in
# scripts/sync-decision-standard.sh, met without a scratch tree.
# TEMPLATES_OUT still redirects a real write, for rendering somewhere else.
OUT="${TEMPLATES_OUT:-.}"

[ -x "$GEN" ] || { echo "sync-templates.sh: cannot execute $GEN" >&2; exit 1; }

# schema path : destination, relative to the repo root
TARGETS="
skills/project-workflow/schemas/task.md:skills/project-workflow/templates/tasks/0000_TEMPLATE.md
skills/project-workflow/schemas/adr.md:skills/project-workflow/templates/decisions/ADR-0000-TEMPLATE.md
skills/project-workflow/schemas/current-state.md:skills/project-workflow/templates/10.CURRENT_STATE.md
skills/project-workflow/schemas/risk-register.md:skills/project-workflow/templates/40.RISK_REGISTER.md
skills/project-workflow/schemas/session.md:skills/project-workflow/templates/sessions/0000_TEMPLATE.md
skills/project-workflow/schemas/review.md:skills/project-workflow/templates/reviews/0000_TEMPLATE.md
skills/project-migration/schemas/task.md:skills/project-migration/templates/TASK.md
skills/project-migration/schemas/adr.md:skills/project-migration/templates/ADR.md
skills/project-migration/schemas/review.md:skills/project-migration/templates/REVIEW.md
skills/project-migration/schemas/session.md:skills/project-migration/templates/SESSION.md
skills/project-migration/schemas/plan.md:skills/project-migration/templates/PLAN.md
"

# The project-migration targets render schemas that skill owns, beside its
# scaffold script (B-040, TASK-0119). The script is copied out of this skill and
# run against other repositories, where this repo's paths mean nothing; it
# needs the rendered templates beside it. Same reason
# scripts/sync-decision-standard.sh ships a generated sibling of driver.py.
#
# Before this, the scaffold carried five inline heredocs -- a second owner of
# shape, and two of them had already drifted into failing their own schemas:
# its TASK.md was missing ## Inputs and ## Outputs / handover and still
# carried the three headings ADR-0012 retired, and its REVIEW.md was missing
# four required sections. Every repository it migrated inherited that on day
# one, where no gate of ours reaches.
#
# PLAN.md joined them with TASK-0146 (B-042): its schema was transcribed from
# a count of the six plans, so it, too, is rendered rather than hand-written.

for pair in $TARGETS; do
  schema="${pair%%:*}"
  [ -r "$schema" ] || { echo "sync-templates.sh: cannot read $schema" >&2; exit 1; }
done

# One interpreter for all of them. Spawning a bash+python3 pair per template
# cost tests/validate.sh 1.4s of a 2.1s baseline on a /mnt/c checkout --
# measured, not assumed. The generator CLI stays the single-artifact entry
# point; this shares its parser rather than reimplementing it.
# Every clause must read true in ai-toolbox AND in a repository a copy lands
# in, where none of these paths exists (B-051, TASK-0139).
BANNER="<!-- Rendered by ai-toolbox's scripts/sync-templates.sh. Shape is owned by
     ai-toolbox's {schema} (its ADR-0027).
     In ai-toolbox, edit the schema and re-render; tests/validate.sh fails on
     drift. A copy in another repository is not regenerated or checked there. -->"

TARGETS="$TARGETS" OUT="$OUT" BANNER="$BANNER" CHECK="$CHECK" \
  python3 "$(dirname "$GEN")/artifact_lib.py" sync
