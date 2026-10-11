#!/usr/bin/env bash
# Deploy skills to agent clients, emit agent roles, and print MCP
# registration commands.
#
# Usage: install.sh [link|copy] [--client claude-code|opencode|lm-studio-bionic|all]
#                   [--bionic-project DIR] [--only NAME[,NAME...]]
#        install.sh --status [--only NAME[,NAME...]]
#
# Selection (TASK-0164). By default every component is deployed. To deploy
# only some, name them, from skills/, agents/ and mcp-servers/ alike:
#   --only a,b          for this run (repeatable), overriding the file;
#   install.selection   at the repo root, gitignored, one name per line, `#`
#                       comments -- read by every run, --status included.
# Names are checked before anything is written: an unknown name, or a
# selection naming nothing, exits 2. A component that is NOT selected leaves
# the client: its skill link to this checkout is removed, and its emitted
# agent file is pruned (ADR-0026, amended). Both come back by re-running with
# it selected. A copy, a link elsewhere and a file this repo did not write
# are never removed; a left copy is reported. MCP commands are printed only
# for selected servers.
#
# link (default) symlinks skills into each client's skills dir, per
# ADR-0002's symlink-first preference; copy is the fallback for checkouts
# where symlinks are unavailable. The mode applies to SKILLS ONLY: agents
# are generated per client (ADR-0018), so they have no link or copy mode.
#
# On Windows (Git Bash, MSYS, Cygwin) link makes a directory JUNCTION, not
# `ln -s`: without MSYS=winsymlinks set, Git Bash's `ln -s` silently COPIES,
# so "link" left copies that every later commit made stale (TASK-0160 found
# 5.2.1 installed against 6.2.0). A junction needs no admin rights and no
# Developer Mode. Every link is verified after it is made.
#
# --status prints, per client and skill, whether the install is a link to
# this checkout or a copy, and its version against the repo's. A report,
# not a gate: nothing in validate.sh or CI calls it (ADR-0009).
#
# Overwrite policy (TASK-0006): a client target is replaced only when this
# repo owns a skill of that name, and replacing a pre-existing non-symlink
# directory is always announced. Skills the repo does not own are never
# touched. Clients whose config dir is absent are skipped, not created.
#
# Bionic (LM Studio) takes --bionic-project DIR and deploys to
# DIR/.agents/skills/ only. Its GLOBAL skills target is approval-gated by
# the vendor and is never written by this script (TASK-0072, B-018). A run
# without that flag touches no Bionic path at all.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="link"
WANT_CLIENT="all"
BIONIC_PROJECT=""
STATUS=0
ONLY="" ONLY_SET=0
while [ $# -gt 0 ]; do
  case "$1" in
    link|copy) MODE="$1" ;;
    --status)  STATUS=1 ;;
    --only)    shift; ONLY="${ONLY:+$ONLY,}${1:-}"; ONLY_SET=1 ;;
    --only=*)  ONLY="${ONLY:+$ONLY,}${1#*=}"; ONLY_SET=1 ;;
    --client)  shift; WANT_CLIENT="${1:-all}" ;;
    --client=*) WANT_CLIENT="${1#*=}" ;;
    --bionic-project) shift; BIONIC_PROJECT="${1:-}" ;;
    --bionic-project=*) BIONIC_PROJECT="${1#*=}" ;;
    -h|--help)
      # Prints the leading comment block, however long it grows. This was a
      # fixed `sed -n '2,13p'` until TASK-0072 added four lines above and
      # silently truncated the help — a line-number range is a second-hand
      # claim about a file that edits invalidate without failing anything.
      awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

WINDOWS_LINKS=0
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WINDOWS_LINKS=1 ;; esac

# --- Selection (TASK-0164) ---------------------------------------------------
# One namespace across the three deployable kinds, built from the same skips
# the deploy loops use. Space-delimited strings, not associative arrays, so
# this stays bash 3 compatible.
SKILL_NAMES=" " ROLE_NAMES=" " SERVER_NAMES=" "
for d in skills/*; do
  n=$(basename "$d"); case "$n" in _template*) continue ;; esac
  [ -f "$d/SKILL.md" ] && SKILL_NAMES="$SKILL_NAMES$n "
done
for d in agents/*; do
  n=$(basename "$d"); case "$n" in _template*) continue ;; esac
  [ -f "$d/agent.md" ] && ROLE_NAMES="$ROLE_NAMES$n "
done
for d in mcp-servers/*; do
  n=$(basename "$d"); case "$n" in _template*) continue ;; esac
  { [ -f "$d/pyproject.toml" ] || [ -f "$d/server.json" ]; } && SERVER_NAMES="$SERVER_NAMES$n "
done
for n in $SKILL_NAMES $ROLE_NAMES $SERVER_NAMES; do
  k=0
  for list in "$SKILL_NAMES" "$ROLE_NAMES" "$SERVER_NAMES"; do
    [[ "$list" == *" $n "* ]] && k=$((k + 1))
  done
  if [ "$k" -gt 1 ]; then
    echo "component name '$n' exists in more than one of skills/, agents/, mcp-servers/;" >&2
    echo "  a selection could not say which. Rename one." >&2
    exit 2
  fi
done

SELECTION_FILE="install.selection"
SEL_SOURCE="all" SEL=" "
add_sel() { [[ "$SEL" == *" $1 "* ]] || SEL="$SEL$1 "; }
if [ "$ONLY_SET" -eq 1 ]; then
  SEL_SOURCE="--only"
  for n in ${ONLY//,/ }; do add_sel "$n"; done
elif [ -f "$SELECTION_FILE" ]; then
  SEL_SOURCE="$SELECTION_FILE"
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"; line="${line//$'\r'/}"
    for n in $line; do add_sel "$n"; done
  done < "$SELECTION_FILE"
fi
if [ "$SEL_SOURCE" != "all" ]; then
  if [ "$SEL" = " " ]; then
    echo "$SEL_SOURCE selects no components. Name at least one, or delete" >&2
    echo "  $SELECTION_FILE to deploy everything." >&2
    exit 2
  fi
  unknown=""
  for n in $SEL; do
    [[ "$SKILL_NAMES$ROLE_NAMES$SERVER_NAMES" == *" $n "* ]] || unknown="$unknown $n"
  done
  if [ -n "$unknown" ]; then
    echo "unknown component(s) in $SEL_SOURCE:$unknown -- nothing was installed." >&2
    echo "  skills:     $SKILL_NAMES" >&2
    echo "  agents:     $ROLE_NAMES" >&2
    echo "  mcp-servers:$SERVER_NAMES" >&2
    exit 2
  fi
  count=0; for n in $SEL; do count=$((count + 1)); done
  total=0; for n in $SKILL_NAMES $ROLE_NAMES $SERVER_NAMES; do total=$((total + 1)); done
  echo "selection: $count of $total components, from $SEL_SOURCE"
fi
is_selected() { [ "$SEL_SOURCE" = "all" ] || [[ "$SEL" == *" $1 "* ]]; }

# The roles emit-agents.py is told to emit: absent means all.
EMIT_ONLY=()
if [ "$SEL_SOURCE" != "all" ]; then
  roles=""
  for n in $ROLE_NAMES; do is_selected "$n" && roles="${roles:+$roles,}$n"; done
  EMIT_ONLY=("--only=$roles")
fi

# Remove a link - a symlink or a junction - and never what it points at.
# NEVER `rm -rf` a link path: on a junction some tools recurse into the
# target, and the target is this repository's skill.
unlink_dir() {
  if [ "$WINDOWS_LINKS" -eq 1 ]; then
    MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$1")" >/dev/null
  else
    rm -f "$1"
  fi
}

# Link $2 to $1, then prove it: a "link" that is really a copy is how the
# installed skills went stale unnoticed (TASK-0160).
make_link() {
  local src="$1" dest="$2"
  [ -L "$dest" ] && unlink_dir "$dest"
  if [ "$WINDOWS_LINKS" -eq 1 ]; then
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$dest")" "$(cygpath -w "$src")" >/dev/null
  else
    ln -s "$src" "$dest"
  fi
  if [ ! -L "$dest" ] || [ "$(cd "$dest" && pwd -P)" != "$(cd "$src" && pwd -P)" ]; then
    echo "ERROR: $dest is not a link to $src. Refusing to report it deployed." >&2
    exit 1
  fi
}

# Deploy every non-template skill into $1, in mode $2, reporting as $3.
#
# Shared by the global CLIENTS loop below and the Bionic project path, which
# is the whole reason it is a function: the overwrite policy in it is load
# bearing (`ln -sfn` against a real directory silently links INSIDE it), and
# a second copy of that policy is a second thing to keep correct. The
# registry generator's duplicated per-section loops were removed for the
# same reason in TASK-0011.
deploy_skills() {
  local target="$1" mode="$2" label="$3" d name dest
  mkdir -p "$target"
  for d in skills/*; do
    name=$(basename "$d")
    case "$name" in _template*) continue ;; esac
    [ -f "$d/SKILL.md" ] || continue
    dest="$target/$name"
    if ! is_selected "$name"; then
      # Only a link to THIS checkout's skill is ours to remove; it comes back
      # by re-running with the skill selected. A copy may hold local edits.
      if [ -L "$dest" ] && [ "$(cd "$dest" 2>/dev/null && pwd -P)" = "$(cd "$d" && pwd -P)" ]; then
        unlink_dir "$dest"
        echo "skill unlinked: $name -> $label (not selected)"
      elif [ -e "$dest" ] && [ ! -L "$dest" ]; then
        echo "  NOTICE: $name is not selected, but $dest is a copy; left in place"
      fi
      continue
    fi
    # A pre-existing real directory must be removed before linking:
    # `ln -sfn` against a real directory silently creates the link *inside*
    # it, leaving the stale skill in place and reporting success.
    if [ -L "$dest" ]; then
      unlink_dir "$dest"
    elif [ -e "$dest" ]; then
      echo "  NOTICE: replacing pre-existing directory $dest (repo owns skill '$name')"
      rm -rf "$dest"
    fi
    case "$mode" in
      link) make_link "$(pwd)/$d" "$dest" ;;
      copy) cp -r "$d" "$dest" ;;
    esac
    echo "skill deployed: $name -> $label ($mode)"
  done
}

skill_version() { # the frontmatter version of a SKILL.md, quotes stripped
  awk '/^[[:space:]]*version:/ { v = $2; gsub(/["\047\r]/, "", v); print v; exit }' "$1"
}

# Clients this script can deploy skills to. tests/validate.sh reads these
# names from here and requires configs/<name>/README.md for each, so the
# names must match the configs/ directory names exactly.
#
# A fourth column (agents target) rather than a second table: the gate's
# parse anchors on the FIRST field (`grep -oE '^[a-z0-9_-]+\|'`), so extra
# columns are invisible to it, and the loop below reads fields positionally
# with `IFS='|' read`. Both verified before choosing (TASK-0040). A second
# table would have introduced a second list of client names that could
# disagree with this one — the defect the config-pairing check exists to
# prevent, reintroduced one level up.
#
# The agents directory names are TASK-0036's OBSERVED values, not the
# documented ones: OpenCode discovers both `agents/` (documented) and
# `agent/` (undocumented), and this repo writes the documented plural.
# name|skills target dir|parent dir that must already exist|agents target dir
CLIENTS="
claude-code|${HOME}/.claude/skills|${HOME}/.claude|${HOME}/.claude/agents
opencode|${HOME}/.config/opencode/skills|${HOME}/.config/opencode|${HOME}/.config/opencode/agents
"
# Bionic (LM Studio's agent-oriented workspace) is intentionally absent,
# but NOT for the reason previously recorded here. It does have an Agent
# Skills target - ~/.lmstudio/skills/ globally, <project>/.agents/skills/
# per project - documented in Bionic's own bundled skill-management
# SKILL.md. The earlier claim rested on ~/.lmstudio/hub/skills/, which is a
# hub cache, sibling to hub/models and hub/presets (ADR-0020 corrects this).
#
# It stays out of THIS TABLE because every row here is a global target under
# $HOME, and Bionic's writable target is per-project. B-018 was closed by
# TASK-0072: the project half is now deployed by --bionic-project DIR,
# handled after the loop below, and the global half stays manual because it
# is approval-gated. The full reasoning is at that block, not here, so there
# is one owner of it. See configs/lm-studio-bionic/README.md.

if [ "$STATUS" -eq 1 ]; then
  while IFS='|' read -r client target parent _; do
    [ -n "$client" ] || continue
    if [ ! -d "$parent" ]; then
      echo "$client: not installed ($parent absent)"
      continue
    fi
    for d in skills/*; do
      name=$(basename "$d")
      case "$name" in _template*) continue ;; esac
      [ -f "$d/SKILL.md" ] || continue
      dest="$target/$name" want=$(skill_version "$d/SKILL.md")
      if [ -L "$dest" ] && [ "$(cd "$dest" 2>/dev/null && pwd -P)" = "$(cd "$d" && pwd -P)" ]; then
        state="linked" have="$want"
      elif [ -L "$dest" ]; then
        state="linked elsewhere: $(readlink "$dest")"
        have=$(skill_version "$dest/SKILL.md" 2>/dev/null || true)
      elif [ -f "$dest/SKILL.md" ]; then
        state="COPY" have=$(skill_version "$dest/SKILL.md")
      else
        state="absent" have=""
      fi
      flag=""
      if ! is_selected "$name"; then
        state="$state (not selected)"
      elif [ "$have" != "$want" ]; then
        flag="  STALE"
      fi
      printf '%-12s %-18s %-8s (repo %s) %s%s\n' \
        "$client" "$name" "${have:--}" "$want" "$state" "$flag"
    done
  done <<EOF
$CLIENTS
EOF
  exit 0
fi

# Activate the tracked pre-commit hook (ADR-0007). Hooks live in
# .githooks/ rather than .git/hooks/ so they are version-controlled and
# survive a fresh clone; core.hooksPath is the one-line activation.
# Idempotent: only reports when it actually changes something.
if [ -d .githooks ] && git rev-parse --git-dir >/dev/null 2>&1; then
  current=$(git config --get core.hooksPath || true)
  if [ "$current" = ".githooks" ]; then
    : # already active, stay quiet
  else
    git config core.hooksPath .githooks
    echo "git hooks activated: core.hooksPath=.githooks (was ${current:-unset})"
  fi

  # Warn if the hook's mode *as git records it* is not executable
  # (TASK-0014). tests/validate.sh fails on this authoritatively; the
  # warning exists here because this is the first script a fresh clone
  # runs, and on a core.filemode=false checkout the problem is invisible
  # locally — the hook runs fine here while being silently ignored by any
  # machine that honours the executable bit. Advisory only: never exits
  # non-zero (skill deployment is unrelated) and never mutates the index.
  hook_mode=$(git ls-files -s .githooks/pre-commit 2>/dev/null | awk '{print $1}')
  if [ -n "$hook_mode" ] && [ "$hook_mode" != "100755" ]; then
    echo "  WARNING: .githooks/pre-commit is recorded in git as $hook_mode, not 100755."
    echo "           The commit gate will be silently skipped on any machine that"
    echo "           honours the executable bit. Fix with:"
    echo "             git update-index --chmod=+x .githooks/pre-commit"
    if [ "$(git config --get core.filemode || true)" = "false" ]; then
      echo "           NOTE: core.filemode=false on this checkout, so 'chmod +x' alone"
      echo "           will NOT fix this — git ignores the filesystem bit here. Use the"
      echo "           git update-index command above. See docs/operations/runbook.md."
    fi
  fi
fi

deployed_any=0
while IFS='|' read -r client target parent agents_target; do
  [ -n "$client" ] || continue
  case "$WANT_CLIENT" in
    all) ;;
    "$client") ;;
    *) continue ;;
  esac
  if [ ! -d "$parent" ]; then
    echo "client skipped: $client (not installed: $parent absent)"
    continue
  fi
  deployed_any=1
  deploy_skills "$target" "$MODE" "$client"

  # Agents are EMITTED, never linked (ADR-0018 clause 3): a per-client file's
  # content differs by definition, so it cannot be a symlink to one source.
  # $MODE deliberately does not apply here — there is no link or copy mode
  # for agents.
  #
  # NO FRESHNESS CHECK EXISTS OR MAY BE ADDED. Emission creates a copy
  # outside the repo whose currency nothing verifies; that is an accepted
  # weakness, not an oversight. ADR-0018 clause 4: "anyone who later 'fixes'
  # this by checking the deployed copy breaks every fresh clone and CI."
  # ADR-0009: "a gate that cannot pass on a clean checkout stops being run,
  # and a gate that is not run is worse than no gate, because it is still
  # trusted." The control is that this is cheap and idempotent — re-run it.
  # Skills need no such control when linked: a link cannot drift. Agents are
  # still copies. `--status` reports both cases and is no gate (TASK-0160).
  #
  # Pruning is narrow, and it is a decision, not a convenience (ADR-0026,
  # the human's, 2026-09-24): when a role in agents/ stops declaring a
  # client, emit-agents.py removes that client's file for it — only a
  # regular file whose frontmatter names that role — and prints
  # "agent pruned". A role DELETED from agents/ is still never pruned: its
  # name is no longer known here, so its agent stays live until removed by
  # hand.
  #
  # Exits non-zero if emission is REFUSED for a declared capability the
  # client cannot enforce (clause 8). That failure is intentional and must
  # not be softened to a warning.
  if [ -d agents ]; then
    mkdir -p "$agents_target"
    python3 scripts/emit-agents.py "$client" "$agents_target" ${EMIT_ONLY[@]+"${EMIT_ONLY[@]}"} || {
      echo "agent emission failed for $client" >&2
      exit 1
    }
  fi
done <<EOF
$CLIENTS
EOF

# --- Bionic: PROJECT skills only -------------------------------------------
# Deliberately outside the CLIENTS table. Every row there is a GLOBAL target
# under $HOME that the loop probes and skips when absent; Bionic's writable
# target is <project>/.agents/skills/, which has no such location — it is
# wherever the caller's project is. A row would have had to invent one, most
# likely this repo's own directory, which is not a Bionic project. So the
# caller names it, because the caller is the only honest source of that fact.
#
# Keeping it out of that table also keeps it out of tests/validate.sh's
# client-pairing parse, which reads the first field of each line in the
# CLIENTS block. (configs/lm-studio-bionic/README.md exists anyway.)
#
# THE GLOBAL TARGET IS NOT AUTOMATED, AND THAT IS THE DECISION, NOT A GAP.
# ~/.lmstudio/skills/ is approval-gated by the vendor: Bionic's own bundled
# skill-management/SKILL.md:31 says "DO NOT edit global skills directly",
# routing installs through a skill.install tool call that PROMPTS THE USER.
# This script is non-interactive and idempotent, so it cannot drive that
# gate — and a script that wrote the path directly would be working around a
# vendor control rather than supporting the client. Do not "finish" this by
# adding the global path. See B-018 and configs/lm-studio-bionic/README.md.
case "$WANT_CLIENT" in
  all|lm-studio-bionic)
    if [ -n "$BIONIC_PROJECT" ]; then
      if [ ! -d "$BIONIC_PROJECT" ]; then
        echo "--bionic-project: not a directory: $BIONIC_PROJECT" >&2
        echo "  Name an existing project. This script creates .agents/skills/ inside it," >&2
        echo "  never the project itself." >&2
        exit 2
      fi
      deployed_any=1
      deploy_skills "$BIONIC_PROJECT/.agents/skills" "$MODE" "lm-studio-bionic (project)"
      # No agent emission: ADR-0020 found no user-authored agent-role
      # directory in Bionic, so there is no surface to emit into. Stated
      # rather than left as a silent absence.
      echo "  note: no agent roles emitted for Bionic — it has no user-authored"
      echo "        agent-role directory (ADR-0020). Skills only."
    elif [ "$WANT_CLIENT" = "lm-studio-bionic" ]; then
      echo "lm-studio-bionic requires --bionic-project DIR." >&2
      echo "  Its PROJECT skills target is DIR/.agents/skills/, which is writable." >&2
      echo "  Its GLOBAL target (~/.lmstudio/skills/) is deliberately never written" >&2
      echo "  by this script: the vendor routes global installs through an" >&2
      echo "  approval-gated skill.install tool call (\"DO NOT edit global skills" >&2
      echo "  directly\"), which a non-interactive installer cannot drive." >&2
      echo "  Install those by hand — see configs/lm-studio-bionic/README.md." >&2
      exit 2
    fi
    ;;
esac

if [ "$deployed_any" -eq 0 ]; then
  echo "no matching client for --client '$WANT_CLIENT'" >&2
  exit 2
fi

any_server=0
for n in $SERVER_NAMES; do is_selected "$n" && any_server=1; done
[ "$any_server" -eq 1 ] || exit 0
echo
echo "Register MCP servers (adjust commands per client):"
for d in mcp-servers/*/; do
  d="${d%/}"
  name=$(basename "$d")
  case "$name" in _template*) continue ;; esac
  is_selected "$name" || continue
  if [ -f "$d/pyproject.toml" ]; then
    # cwd-independent, so the printed line is also what a client config needs
    # (TASK-0088; the same form tests/smoke-mcp.sh launches).
    echo "  uv --directory \"$PWD/$d\" run $name"
  elif [ -f "$d/server.json" ]; then
    # External server (ADR-0005): print the real launch command and the
    # environment it needs, straight from the manifest.
    python3 - "$d/server.json" <<'PY'
import json, shlex, sys
m = json.load(open(sys.argv[1]))
print("  " + " ".join(shlex.quote(a) for a in m["launch"]["command"])
      + "   # %s (%s, transport=%s)" % (m["name"],
                                        m["upstream"]["package"],
                                        m["launch"]["transport"]))
req = [k for k, v in m.get("environment", {}).items() if v.get("required")]
if req:
    print("      requires env: " + ", ".join(sorted(req)))
for p in m.get("preconditions", []):
    print("      precondition: " + p)
if m.get("capabilities", {}).get("destructive"):
    print("      WARNING: exposes destructive tools - see "
          + m.get("authorization", {}).get("task", "the task file"))
PY
  fi
done
