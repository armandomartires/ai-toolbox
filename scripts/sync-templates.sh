#!/usr/bin/env bash
# Regenerate every tracked planning template from the schema that owns its
# shape (ADR-0027).
#
# Why generated copies exist at all. A template must sit where the framework
# that uses it can reach it: project-workflow's under skills/ (and project-migration's plan). A schema is the one owner of shape, so the templates
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
skills/project-migration/schemas/plan.md:skills/project-migration/templates/PLAN.md
"

# The one project-migration target renders the plan schema that skill keeps,
# beside its scaffold script. Its task, ADR, review and session schemas and
# templates are gone: project-workflow owns them (ADR-0066, S017.T008), and
# the scaffold reads project-workflow's templates at run time. The frozen
# shapes of the legacy artifacts are tests/legacy-schemas/, rendered by nothing.

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
