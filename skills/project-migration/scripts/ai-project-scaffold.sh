#!/usr/bin/env bash
# ai-project-scaffold.sh — scaffold a project onto the one planning convention
# (ADR-0066): project-workflow's numbered .ai/ layout, written from the
# templates project-workflow owns, plus AGENTS.md, CLAUDE.md, README.md,
# docs/ and a stack preset.
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
#   --tracker files|gitlab|github  Where work is tracked (default: files).
#                                A forge tracker skips 30.ROADMAP.md,
#                                35.AD_HOC_TASKS.md, tasks/, reviews/ and
#                                sessions/ and writes the forge variant of
#                                20.PLAN.md (ADR-0037)
#   --gitlab-project group/name  Required with --tracker gitlab
#   --github-repo owner/name     Required with --tracker github
#
# Principles applied from the spec:
#   - Only create files that provide immediate value; the rest are templates.
#   - AGENTS.md is the single source of agent instructions; CLAUDE.md imports it with @AGENTS.md.
#   - No secrets, no .env, no invented requirements — placeholders are marked FILL.
#
# THIS SCRIPT OWNS WHICH FILES EXIST, NOT THEIR SHAPE (ADR-0027, ADR-0066).
# The numbered files, the forge variant of 20.PLAN.md and reference/ are read
# from the sibling project-workflow skill's templates/ at run time: one owner
# and no copy to drift. The skill therefore needs project-workflow installed
# beside it (it already calls its tracker.sh and migrate-layout.py). A task,
# ADR, review or session is never written here: generate it with
# project-workflow's scripts/new-artifact.sh. Do not re-inline a template as a
# heredoc; scripts/check-scaffold.sh fails when a numbered file differs from
# its owner.

set -euo pipefail

# Resolved BEFORE the cd into the target project, because after it a
# $0-relative path no longer points at the skill.
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PW_DIR="$(cd "$SKILL_DIR/.." && pwd)/project-workflow"
TEMPLATE_DIR="$PW_DIR/templates"

# Checked up front, and by name, so a missing template is one clear message
# before anything is written -- not a bare redirect error 300 lines in, after
# half a repository has been scaffolded.
for _t in 00.CONVENTIONS.md 10.CURRENT_STATE.md 20.PLAN.md 30.ROADMAP.md \
          35.AD_HOC_TASKS.md 40.RISK_REGISTER.md forge/20.PLAN.md \
          reference/tracker.md; do
  [ -r "$TEMPLATE_DIR/$_t" ] || {
    echo "ai-project-scaffold.sh: missing template $TEMPLATE_DIR/$_t" >&2
    echo "  This skill writes project-workflow's convention from that skill's" >&2
    echo "  templates/. Install project-workflow beside project-migration" >&2
    echo "  (both are in ai-toolbox's skills/)." >&2
    exit 1
  }
done
unset _t

# ---- Arguments -----------------------------------------------------------------
usage() { sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

[ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] && usage
[ $# -ge 1 ] || usage

PROJECT="$1"; shift || true
TYPE="generic"; DO_GIT="yes"; FORCE="no"
TRACKER="files"; GITLAB_PROJECT=""; GITHUB_REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --type)   TYPE="$2"; shift 2 ;;
    --tracker)        TRACKER="$2"; shift 2 ;;
    --gitlab-project) GITLAB_PROJECT="$2"; shift 2 ;;
    --github-repo)    GITHUB_REPO="$2"; shift 2 ;;
    --no-git) DO_GIT="no"; shift ;;
    --force)  FORCE="yes"; shift ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done
case "$TYPE" in python|node|generic) ;; *) echo "Invalid --type: $TYPE" >&2; exit 1 ;; esac

# The work tracker (ADR-0037). Same rules as project-workflow's tracker.sh,
# which reads the tracker.conf written below; ai-toolbox's tests/validate.sh
# runs both against each other. The path is a name, never a host or URL.
SEG='[A-Za-z0-9][A-Za-z0-9._-]*'
case "$TRACKER" in
  files)
    [ -z "$GITLAB_PROJECT$GITHUB_REPO" ] || {
      echo "--gitlab-project and --github-repo need --tracker gitlab or github" >&2; exit 1; }
    TRACKER_PATH="" ;;
  gitlab)
    [ -z "$GITHUB_REPO" ] || { echo "--github-repo belongs to --tracker github" >&2; exit 1; }
    [[ "$GITLAB_PROJECT" =~ ^$SEG(/$SEG)+$ ]] || {
      echo "--tracker gitlab needs --gitlab-project group/name (a path, not a URL)" >&2; exit 1; }
    TRACKER_PATH="$GITLAB_PROJECT"; TRACKER_KEY="gitlab_project"; FORGE_NAME="GitLab" ;;
  github)
    [ -z "$GITLAB_PROJECT" ] || { echo "--gitlab-project belongs to --tracker gitlab" >&2; exit 1; }
    [[ "$GITHUB_REPO" =~ ^$SEG/$SEG$ ]] || {
      echo "--tracker github needs --github-repo owner/name (a path, not a URL)" >&2; exit 1; }
    TRACKER_PATH="$GITHUB_REPO"; TRACKER_KEY="github_repo"; FORGE_NAME="GitHub" ;;
  *) echo "Invalid --tracker: $TRACKER (files | gitlab | github)" >&2; exit 1 ;;
esac
unset SEG
if [ "$TRACKER" = files ]; then
  AI_LAYOUT="numbered state files, decisions, tasks, reviews, sessions, reference"
else
  AI_LAYOUT="numbered state files, decisions, reference (work is tracked on ${FORGE_NAME}: tracker.conf)"
fi

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
- \`.ai/\` — governance: ${AI_LAYOUT}
- \`docs/\` — architecture, development, operations, deployment
- \`src/\`, \`tests/\`, \`scripts/\` — code and automation
- \`CHANGELOG.md\` — user-visible changes

## Status
See \`.ai/10.CURRENT_STATE.md\` for the current project state and
\`.ai/20.PLAN.md\` for what is in flight and the next action.
EOF

# Absent, tracker.conf means files; it is written anyway so the answer shows.
{
  echo "# Work tracker for this project: files | gitlab | github (ADR-0037 in"
  echo "# ai-toolbox; project-workflow's templates/reference/tracker.md)."
  echo "# Written by ai-project-scaffold.sh on $(date +%Y-%m-%d). Changing it is a"
  echo "# decision: record an ADR. Absent, this file means files."
  echo "tracker = ${TRACKER}"
  [ -z "$TRACKER_PATH" ] || echo "${TRACKER_KEY} = ${TRACKER_PATH}"
} | mkfile tracker.conf

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
- `.ai/` — governance layer: see `.ai/00.CONVENTIONS.md`
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
- At task end: run validations, review the diff, commit with a subject that
  names the task (`<Imperative summary> (S###.T###)`), push, and confirm
  the remote holds the same hash. Git is the record: the brief does not
  carry its own hash, and no follow-up commit adds it.
- End every task with a short report: Result, Changed, Verified, Pushed,
  Next — one line each.
- Never force-push without explicit authorization. If the push fails,
  diagnose and document; do not declare the task complete.
- Simple checks (status, diff analysis, test runs) may be delegated to a
  subagent; the main agent still verifies results.

## Documentation rules
- Update `.ai/10.CURRENT_STATE.md` after any significant change: edit
  the state it describes; do not append a narrative (history is in git).
- Decisions with lasting impact get an ADR in `.ai/decisions/`; not every
  small change.
- Plans must be concrete enough for another agent to implement without a
  long clarification conversation.

## Definition of done
A task is complete only when: implementation finished; acceptance criteria
satisfied; relevant tests pass; known failures documented; documentation
updated; no secrets included; diff reviewed; task marked `done`; the
commit subject names the task; the push is confirmed in the task report;
next action clear.

## Ambiguity policy
If requirements are significantly ambiguous or risky, stop and ask the
human. State assumptions explicitly. Do not invent requirements.

## Destructive change policy
Deletions, overwrites, migrations that discard history, and force-pushes
require explicit human authorization recorded in the task file.

EOF
if [ "$TRACKER" = files ]; then
cat >> AGENTS.md <<'EOF'
## Planning references
- Convention: `.ai/00.CONVENTIONS.md`; detail on demand in `.ai/reference/`
- Current state: `.ai/10.CURRENT_STATE.md`; risks: `.ai/40.RISK_REGISTER.md`
- Plan in flight: `.ai/20.PLAN.md`; roadmap: `.ai/30.ROADMAP.md`
- Ad-hoc findings: `.ai/35.AD_HOC_TASKS.md`
- Tasks: `.ai/tasks/S###.T###_Name.md`; decisions: `.ai/decisions/ADR-NNNN-*.md`
EOF
else
cat >> AGENTS.md <<EOF
## Planning references
- Work tracker: ${FORGE_NAME} project \`${TRACKER_PATH}\` (\`tracker.conf\`).
  Tasks are issues, sprints are milestones, the board is the plan; the
  mapping is project-workflow's \`templates/reference/tracker.md\`.
- Convention: \`.ai/00.CONVENTIONS.md\`; current state: \`.ai/10.CURRENT_STATE.md\`;
  plan (forge variant, no task list): \`.ai/20.PLAN.md\`; decisions: \`.ai/decisions/\`
- End-user documentation lives in the project wiki; developer and
  operations docs stay in \`docs/\`.
EOF
# On a forge the task id is the issue number (tracker.md, *Identifiers*).
sed 's/(S###\.T###)/(#123, the issue)/' AGENTS.md > AGENTS.md.tmp
mv AGENTS.md.tmp AGENTS.md
fi
cat >> AGENTS.md <<'EOF'

## Mandatory task process
Every task follows the work cycle:
1. Gather context (AGENTS.md, 10.CURRENT_STATE, 20.PLAN, task, git status).
2. Perceive (knowns, gaps, assumptions — no invented requirements).
3. Plan (scope, likely files, acceptance criteria, validation commands,
   stopping conditions; ask the human if ambiguity or risk is significant).
4. Act (small, reversible changes only within task scope).
5. Observe (record outputs, errors, tests, git changes).
6. Evaluate against acceptance criteria; diagnose failures before retry.
7. Repeat only with a clear next action; stop when criteria are met.
Generate every artifact from project-workflow's schemas with its
`new-artifact.sh --kind task|adr|review|session`; never copy one and imitate it.
EOF
fi # AGENTS_MD_EXISTED

# ---- CLAUDE.md (regular file importing AGENTS.md, ADR-0061) -----------------------
# A symlink breaks on checkouts without core.symlinks; the import line does not.
if [ ! -e "CLAUDE.md" ]; then
  printf '%s
' '@AGENTS.md' '' '# Claude Code notes' ''     'Claude-only facts go here. Everything shared lives in AGENTS.md; do not copy it.' > CLAUDE.md
fi

# ---- .ai governance layer -----------------------------------------------------------
# Read from project-workflow's templates (one owner). The forge variant of
# 20.PLAN.md holds state and no task list; 30, 35, tasks/, reviews/ and
# sessions/ belong to a files tracker (ADR-0037), so writing them on a forge
# would leave two owners of "what's next".
mkfile .ai/00.CONVENTIONS.md < "$TEMPLATE_DIR/00.CONVENTIONS.md"
mkfile .ai/10.CURRENT_STATE.md < "$TEMPLATE_DIR/10.CURRENT_STATE.md"
if [ "$TRACKER" = files ]; then
  mkfile .ai/20.PLAN.md < "$TEMPLATE_DIR/20.PLAN.md"
  mkfile .ai/30.ROADMAP.md < "$TEMPLATE_DIR/30.ROADMAP.md"
  mkfile .ai/35.AD_HOC_TASKS.md < "$TEMPLATE_DIR/35.AD_HOC_TASKS.md"
else
  mkfile .ai/20.PLAN.md < "$TEMPLATE_DIR/forge/20.PLAN.md"
fi
mkfile .ai/40.RISK_REGISTER.md < "$TEMPLATE_DIR/40.RISK_REGISTER.md"
for _r in "$TEMPLATE_DIR"/reference/*.md; do
  mkfile ".ai/reference/$(basename "$_r")" < "$_r"
done
unset _r

mkfile .ai/decisions/ADR-0001-repo-structure.md <<EOF
# ADR-0001 — Adopt the .ai planning convention

**Status**: accepted
**Date**: $(date +%Y-%m-%d)
**Sprint / task**: scaffold

## Context
The project needs a structure understandable by humans and by programming
agents of varying capability, with planning separated from implementation
and progress resumable in a new conversation.

## Decision
Adopt the one planning convention (ai-toolbox ADR-0066): the numbered files of
\`.ai/00.CONVENTIONS.md\`, sprint-prefixed task ids, \`ADR-NNNN-title.md\`
decisions, with AGENTS.md as the single source of agent instructions and
CLAUDE.md importing it (@AGENTS.md). Stack preset: ${TYPE}. Work tracker:
${TRACKER}${TRACKER_PATH:+ (${TRACKER_PATH})}, declared in tracker.conf.

## Alternatives considered
- A free-form docs folder: nothing tells a cold session what is current, so
  each one rediscovers it.
- Planning only in an issue tracker: offline sessions and agents without
  forge access cannot read it.

## Consequences
- Every task is documented, validated, and traceable to a commit.
- Operational context lives in files, not in conversation history.
- Artifacts are generated from project-workflow's schemas, so their shape is
  checkable.
EOF

if [ "$TRACKER" = files ]; then
  mkfile .ai/tasks/.gitkeep </dev/null
  mkfile .ai/reviews/.gitkeep </dev/null
  mkfile .ai/sessions/.gitkeep </dev/null
fi

# ---- docs/ ---------------------------------------------------------------------------
mkfile docs/project-map.md <<'EOF'
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

mkfile docs/glossary.md <<'EOF'
# Glossary

- <!-- FILL: term — definition -->
EOF

mkfile docs/architecture/README.md <<'EOF'
# Architecture
High-level design: modules, components, data flows, integration points,
and significant technical trade-offs. Reference ADRs in .ai/decisions/; the project map is project-map.md.
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
docs/project-map.md -->
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
echo "Scaffolded '${PNAME}' (type: ${TYPE}, tracker: ${TRACKER}${TRACKER_PATH:+ ${TRACKER_PATH}})"
echo
echo "Next steps:"
echo "  1. Fill the <!-- FILL --> markers in AGENTS.md, README.md,"
echo "     .ai/10.CURRENT_STATE.md and .ai/40.RISK_REGISTER.md."
if [ "$TRACKER" = files ]; then
echo "  2. Write the first sprint into .ai/20.PLAN.md and .ai/30.ROADMAP.md, then the"
echo "     first task. Generate it, do not copy a template and imitate it:"
echo "       ${PW_DIR}/scripts/new-artifact.sh --kind task"
echo "     and prove it with ${PW_DIR}/scripts/check-artifact.sh."
else
echo "  2. File the first issue on ${FORGE_NAME} (${TRACKER_PATH}). Generate its body,"
echo "     do not copy a template and imitate it:"
echo "       ${PW_DIR}/scripts/new-artifact.sh --kind task"
echo "     prove it with ${PW_DIR}/scripts/check-artifact.sh, then paste it."
echo "     Labels and milestones: project-workflow's templates/reference/tracker.md."
fi
echo "  3. Delete directories that do not apply (e.g. docs/deployment/)."
echo "  4. Keep CLAUDE.md to Claude-only notes under its @AGENTS.md first line."
