#!/usr/bin/env bash
# ai-project-scaffold.sh — generic project scaffold implementing the .ai
# governance framework (context / decisions / planning / tasks / sessions /
# reviews / templates) from the project-migration specification.
#
# Usage:
#   ./ai-project-scaffold.sh <project-name> [options]
#   ./ai-project-scaffold.sh . [options]   # scaffold into existing repo
#
# Options:
#   --type python|node|generic   Stack preset for src/ and .gitignore (default: generic)
#   --no-git                     Do not run git init / commit
#   --force                      Add files into a non-empty existing directory
#                                (existing files are never overwritten)
#
# Principles applied from the spec:
#   - Only create files that provide immediate value; the rest are templates.
#   - AGENTS.md is the single source of agent instructions; CLAUDE.md symlinks to it.
#   - No secrets, no .env, no invented requirements — placeholders are marked FILL.

set -euo pipefail

# ---- Arguments -----------------------------------------------------------------
usage() { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

[ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] && usage
[ $# -ge 1 ] || usage

PROJECT="$1"; shift || true
TYPE="generic"; DO_GIT="yes"; FORCE="no"
while [ $# -gt 0 ]; do
  case "$1" in
    --type)   TYPE="$2"; shift 2 ;;
    --no-git) DO_GIT="no"; shift ;;
    --force)  FORCE="yes"; shift ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done
case "$TYPE" in python|node|generic) ;; *) echo "Invalid --type: $TYPE" >&2; exit 1 ;; esac

# ---- Guards ---------------------------------------------------------------------
if [ -d "$PROJECT" ] && [ -n "$(ls -A "$PROJECT" 2>/dev/null)" ] && [ "$FORCE" != "yes" ]; then
  echo "Directory '$PROJECT' exists and is not empty." >&2
  echo "Use --force to add missing scaffold files without overwriting." >&2
  exit 1
fi
mkdir -p "$PROJECT"
cd "$PROJECT"
PNAME="$(basename "$PWD")"
YEAR="$(date +%Y)"

# mkfile PATH  — creates parent dirs, never overwrites an existing file.
mkfile() { mkdir -p "$(dirname "$1")"; if [ ! -e "$1" ]; then cat > "$1"; fi; }

# ---- Top level --------------------------------------------------------------------
mkfile README.md <<EOF
# ${PNAME}

<!-- FILL: one-paragraph project description. -->

## Repository layout
- \`AGENTS.md\` — single source of shared instructions for all agents (read first)
- \`.ai/\` — governance: context, decisions, planning, tasks, sessions, reviews
- \`docs/\` — architecture, development, operations, deployment
- \`src/\`, \`tests/\`, \`scripts/\` — code and automation
- \`CHANGELOG.md\` — user-visible changes

## Status
See \`.ai/context/CURRENT_STATE.md\` for the current project state and the
recommended next action.
EOF

mkfile CHANGELOG.md <<EOF
# Changelog

All notable changes to ${PNAME} are documented here.

## [Unreleased]
- Scaffolded project structure (.ai governance framework).
EOF

mkfile .gitignore <<'EOF'
# --- Universal ---
__pycache__/
*.pyc
.venv/
venv/
dist/
build/
*.egg-info/
node_modules/
.env
.env.*
!.env.example
.DS_Store
*.log
coverage/
.pytest_cache/
# --- Governance ---
.ai/tasks/completed/archive/
EOF

# ---- AGENTS.md ---------------------------------------------------------------------
# The appends below must be skipped on re-run: mkfile silently no-ops when
# AGENTS.md already exists, but a plain `>>` does not, which would
# duplicate every section on a second invocation. Guard on pre-existence.
AGENTS_MD_EXISTED="no"
[ -e AGENTS.md ] && AGENTS_MD_EXISTED="yes"
mkfile AGENTS.md <<EOF
# AGENTS.md — ${PNAME}

<!-- FILL: one sentence stating what this project is. -->

## Objective and scope
<!-- FILL: what the project does, what is explicitly out of scope. -->

## Technology stack
EOF
if [ "$AGENTS_MD_EXISTED" = "no" ]; then
if [ "$TYPE" = "python" ]; then
  printf 'Python 3.10+ (src layout, pyproject.toml, hatchling), pytest.\n' >> AGENTS.md
elif [ "$TYPE" = "node" ]; then
  printf 'Node.js LTS (src layout, package.json), built-in test runner.\n' >> AGENTS.md
else
  printf '<!-- FILL: languages, frameworks, runtimes, key dependencies. -->\n' >> AGENTS.md
fi
cat >> AGENTS.md <<EOF

## Commands
<!-- FILL: adjust to the real toolchain. -->
EOF
if [ "$TYPE" = "python" ]; then
  cat >> AGENTS.md <<'EOF'
- Install: `uv sync` (or `pip install -e .[dev]`)
- Test: `pytest`
- Lint / type check: `ruff check . && mypy src`
- Build: `python -m build`
EOF
elif [ "$TYPE" = "node" ]; then
  cat >> AGENTS.md <<'EOF'
- Install: `npm ci`
- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`
EOF
else
  printf -- '- Install: <!-- FILL -->\n- Test: <!-- FILL -->\n- Lint: <!-- FILL -->\n- Build: <!-- FILL -->\n' >> AGENTS.md
fi
cat >> AGENTS.md <<'EOF'

## Project structure
- `.ai/` — governance layer: see `.ai/README.md`
- `docs/` — architecture, development, operations, deployment docs
- `src/` — application code; `tests/` — automated tests; `scripts/` — automation
- `docs/registry`-style generated indexes are allowed but must be regenerated
  by a script, never hand-edited.

## Security and secrets policy
- Never commit secrets, tokens, passwords, private keys, or `.env` files
  containing credentials. Provide `.env.example` instead.
- Do not add dependencies that introduce known vulnerabilities without an ADR.

## Git rules
- Before changes: check `git status`, current branch, remote, uncommitted
  changes, recent commits.
- One task = one commit. Never include unrelated changes in a commit.
- Never delete or overwrite human changes without explicit authorization.
- At task end: run validations, review the diff, commit with a clear message,
  push to the remote, record commit hash and push result in the task log.
- Never force-push without explicit authorization. If the push fails,
  diagnose and document; do not declare the task complete.
- Simple checks (status, diff analysis, test runs) may be delegated to a
  subagent; the main agent still verifies results.

## Documentation rules
- Update `.ai/context/CURRENT_STATE.md` after any significant change.
- Decisions with lasting impact get an ADR in `.ai/decisions/`; not every
  small change.
- Plans must be concrete enough for another agent to implement without a
  long clarification conversation.

## Definition of done
A task is complete only when: implementation finished; acceptance criteria
satisfied; relevant tests pass; known failures documented; documentation
updated; no secrets included; diff reviewed; task marked `done`; local
commit exists; commit pushed and hash recorded in the task log; next
action clear.

## Ambiguity policy
If requirements are significantly ambiguous or risky, stop and ask the
human. State assumptions explicitly. Do not invent requirements.

## Destructive change policy
Deletions, overwrites, migrations that discard history, and force-pushes
require explicit human authorization recorded in the task file.

## Planning references
- Roadmap: `.ai/planning/ROADMAP.md`
- Backlog: `.ai/planning/BACKLOG.md`
- Active sprint: `.ai/planning/SPRINT-CURRENT.md`
- Tasks: `.ai/tasks/` — Current state: `.ai/context/CURRENT_STATE.md`

## Mandatory task process
Every task follows the work cycle:
1. Gather context (AGENTS.md, CURRENT_STATE, sprint, task, git status).
2. Perceive (knowns, gaps, assumptions — no invented requirements).
3. Plan (scope, likely files, acceptance criteria, validation commands,
   stopping conditions; ask the human if ambiguity or risk is significant).
4. Act (small, reversible changes only within task scope).
5. Observe (record outputs, errors, tests, git changes).
6. Evaluate against acceptance criteria; diagnose failures before retry.
7. Repeat only with a clear next action; stop when criteria are met.
File templates: `.ai/templates/`.
EOF
fi # AGENTS_MD_EXISTED

# ---- CLAUDE.md (symlink with fallback, per ADR-0002) -------------------------------
CLAUDE_MD_FALLBACK="no"
if [ ! -e "CLAUDE.md" ]; then
  if ! ln -s AGENTS.md CLAUDE.md 2>/dev/null; then
    # Symlinks unreliable on this checkout (e.g. Windows without
    # core.symlinks=true). ADR-0002 fallback: copy, not a stub, and
    # re-sync at the start of any session that touches agent instructions.
    cp AGENTS.md CLAUDE.md
    CLAUDE_MD_FALLBACK="yes"
  fi
fi

# ---- .ai governance layer -----------------------------------------------------------
mkfile .ai/README.md <<'EOF'
# .ai — governance layer

- `context/` — CURRENT_STATE.md, PROJECT_MAP.md, GLOSSARY.md
- `decisions/` — ADR-NNNN-*.md (lasting decisions only)
- `planning/` — ROADMAP.md, BACKLOG.md, SPRINT-CURRENT.md, plans/
- `tasks/` — TODO.md, TASK-*.md, completed/
- `sessions/` — SESSION-*.md, INDEX.md (short records, not transcripts)
- `reviews/` — REVIEW-*.md
- `templates/` — PLAN, TASK, SESSION, ADR, REVIEW

Process, statuses, and definition of done are defined in AGENTS.md.
Update context files at the end of every significant task.
EOF

mkfile .ai/context/CURRENT_STATE.md <<EOF
# Current State

- Current objective: <!-- FILL -->
- Product status: scaffolded; no features implemented yet.
- Completed features: none.
- Incomplete features: <!-- FILL or "none yet" -->
- Blockers: none.
- Risks: <!-- FILL -->
- Expected current branch: main
- Latest relevant commit: initial scaffold
- Recommended next action: create TASK-0001 in .ai/tasks/
- Known tests and validations: <!-- FILL -->
- Environment validated in: <!-- FILL (e.g. Windows 11 + WSL) -->
- Dev/staging/production differences: <!-- FILL; delete section if single-environment -->
EOF

mkfile .ai/context/PROJECT_MAP.md <<'EOF'
# Project Map

Document relationships and responsibilities — not every file.

## Main modules
<!-- FILL: module → responsibility -->

## Entry points
<!-- FILL: how the application starts -->

## Data flows and integrations
<!-- FILL: inputs, outputs, external systems -->

## Configuration and persistence
<!-- FILL: config files, databases, storage -->

## Tests and scripts
<!-- FILL: what tests cover, what scripts automate -->

## Fragile or unknown areas
<!-- FILL -->
EOF

mkfile .ai/context/GLOSSARY.md <<'EOF'
# Glossary

- <!-- FILL: term — definition -->
EOF

mkfile .ai/decisions/ADR-0001-repo-structure.md <<EOF
# ADR-0001 — Adopt .ai governance structure

## Status
Accepted (${YEAR})

## Context
The project needs a structure understandable by humans and by programming
agents of varying capability, with planning separated from implementation
and progress resumable in a new conversation.

## Decision
Adopt the .ai framework (context / decisions / planning / tasks /
sessions / reviews / templates) with AGENTS.md as the single source of
agent instructions and CLAUDE.md as a symlink to it. Stack preset:
${TYPE}.

## Consequences
- Every task is documented, validated, and traceable to a commit.
- Operational context lives in files, not in conversation history.
EOF

mkfile .ai/planning/ROADMAP.md <<'EOF'
# Roadmap

## Vision
<!-- FILL: one paragraph -->

## Phase 1 — <!-- FILL -->
- Objectives:
- Milestones:
- Exit criteria:

## Dependencies between phases
<!-- FILL -->

## Risks
<!-- FILL -->

Phases decompose into sprints (.ai/planning/SPRINT-CURRENT.md); sprints
decompose into executable tasks (.ai/tasks/TASK-*.md).
EOF

mkfile .ai/planning/BACKLOG.md <<'EOF'
# Backlog

| ID | Title | Priority | Value | Dependencies | Risk | Status | Ready when |
|----|-------|----------|-------|--------------|------|--------|-----------|
EOF

mkfile .ai/planning/SPRINT-CURRENT.md <<'EOF'
# Sprint — S1

- Objective: <!-- FILL -->
- Time reference: <!-- FILL -->
- Included tasks:
- Recommended order:
- Dependencies:
- Success criteria:
- Risks:
- Completed tasks: none. Blocked tasks: none.
- Recommended next task:
EOF

mkfile .ai/planning/plans/.gitkeep </dev/null

mkfile .ai/tasks/TODO.md <<'EOF'
# TODO

- [ ] TASK-0001 — <!-- FILL: first executable task --> (planned)
EOF

mkfile .ai/tasks/completed/.gitkeep </dev/null

mkfile .ai/sessions/INDEX.md <<'EOF'
# Session Index

| Session | Date | Agent | Objective | Tasks | Result |
|---------|------|-------|-----------|-------|--------|
EOF

mkfile .ai/reviews/.gitkeep </dev/null

# ---- .ai templates -----------------------------------------------------------------
mkfile .ai/templates/TASK.md <<'EOF'
# TASK-XXXX — Title

## Objective
## Minimal context
## Scope
### Included
### Not included
## Preconditions
## Likely files
## Execution plan
1.
## Acceptance criteria
- [ ]
## Mandatory validations
- [ ] <!-- FILL: test/lint/build commands -->
## Risks and rollback
## Dependencies
## Expected result
## Status
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent/human
- Created:
- Updated:
## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
EOF

mkfile .ai/templates/PLAN.md <<'EOF'
# PLAN-XXXX — Title

## Objective
## Context consulted
## Phases / steps
## Tasks generated
## Acceptance criteria
## Risks
## Human decisions required
EOF

mkfile .ai/templates/SESSION.md <<'EOF'
# SESSION-YYYYMMDD-HHMM — Title

- Date:
- Agent/model:
- Objective:
- Context consulted:
- Tasks worked on:
- Decisions:
- Commands and validations:
- Problems:
- Commit/push:
- Next action:
EOF

mkfile .ai/templates/ADR.md <<'EOF'
# ADR-XXXX — Title

## Status
## Context
## Decision
## Consequences
EOF

mkfile .ai/templates/REVIEW.md <<'EOF'
# REVIEW-XXXX — Title

- Task(s) reviewed:
- Reviewer:
- Diff summary:
- Findings:
- Validation results:
- Verdict: approve | request changes
- Follow-up tasks:
EOF

# ---- docs/ ---------------------------------------------------------------------------
mkfile docs/architecture/README.md <<'EOF'
# Architecture
High-level design: modules, components, data flows, integration points,
and significant technical trade-offs. Reference ADRs in .ai/decisions/.
EOF

mkfile docs/development/README.md <<'EOF'
# Development
How to set up a local environment, run tests, follow coding conventions,
and structure contributions. Keep AGENTS.md concise and link here for depth.
EOF

mkfile docs/operations/README.md <<'EOF'
# Operations
How to run, configure, and monitor the system; how to deploy, validate a
deployment, and roll back; which steps require human approval.
EOF

mkfile docs/deployment/README.md <<'EOF'
# Deployment
Environment model (development / staging / production), deployment steps,
validation gates, backup and rollback procedures.
Delete this directory if the project has no deployment targets.
EOF

# ---- Code layer (stack presets) --------------------------------------------------------
if [ "$TYPE" = "python" ]; then
  PKG="$(echo "$PNAME" | tr '[:upper:]-' '[:lower:]_')"
  mkfile pyproject.toml <<EOF
[project]
name = "${PKG}"
version = "0.1.0"
description = "<!-- FILL -->"
requires-python = ">=3.10"
dependencies = []

[project.optional-dependencies]
dev = ["pytest", "ruff", "mypy"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/${PKG}"]
EOF
  mkfile "src/${PKG}/__init__.py" <<EOF
"""${PNAME}"""
EOF
  mkfile "src/${PKG}/__main__.py" <<'EOF'
def main() -> None:
    raise SystemExit("TODO: implement entry point")


if __name__ == "__main__":
    main()
EOF
  mkfile tests/test_placeholder.py <<'EOF'
def test_placeholder():
    assert True
EOF
elif [ "$TYPE" = "node" ]; then
  mkfile package.json <<EOF
{
  "name": "$(echo "$PNAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "lint": "echo 'FILL: configure linter'",
    "build": "echo 'FILL: configure build'"
  }
}
EOF
  mkfile src/index.js <<'EOF'
export function main() {
  // TODO: implement entry point
}
EOF
  mkfile tests/placeholder.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert";

test("placeholder", () => {
  assert.ok(true);
});
EOF
else
  mkfile src/README.md <<'EOF'
# src
<!-- FILL: application code. Keep modules cohesive and documented in
.ai/context/PROJECT_MAP.md -->
EOF
  mkfile tests/README.md <<'EOF'
# tests
<!-- FILL: automated tests. A task cannot be done until these pass. -->
EOF
fi

mkfile scripts/README.md <<'EOF'
# scripts
Automation helpers (setup, validation, deployment). Each script must be
idempotent, executable, and safe to re-run.
EOF

# ---- Git ------------------------------------------------------------------------------
if [ "$DO_GIT" = "yes" ] && [ ! -d .git ]; then
  git init -q
  git add -A
  git commit -qm "chore: scaffold ${PNAME} with .ai governance structure" --no-gpg-sign
fi

# ---- Report ----------------------------------------------------------------------------
echo "Scaffolded '${PNAME}' (type: ${TYPE})"
echo
echo "Next steps:"
echo "  1. Fill the <!-- FILL --> markers in AGENTS.md, README.md,"
echo "     and .ai/context/CURRENT_STATE.md."
echo "  2. Replace TODO.md's placeholder with your first executable task"
echo "     (cp .ai/templates/TASK.md .ai/tasks/TASK-0001-*.md)."
echo "  3. Delete directories that do not apply (e.g. docs/deployment/)."
echo "  4. Windows checkouts: verify CLAUDE.md symlink with"
echo "     git ls-files -s CLAUDE.md (mode 120000 = OK)."
if [ "$CLAUDE_MD_FALLBACK" = "yes" ]; then
  echo "  5. Symlink failed — CLAUDE.md was written as a plain copy of"
  echo "     AGENTS.md (ADR-0002 fallback). Record an ADR documenting"
  echo "     this environment's symlink limitation, and re-sync the copy"
  echo "     at the start of any session that touches agent instructions."
fi
