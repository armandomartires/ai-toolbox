#!/usr/bin/env bash
# Generate docs/registry.md — the index of every deployable component.
#
# One emit path serves every section. The four component kinds differ in
# only three ways: where their components live, how their name/description
# are extracted (YAML frontmatter, TOML, or JSON), and whether a third
# discriminator column applies (MCP servers: Shape; agents: Clients).
# Everything common — the header, the template skip, sorted output, the
# `?` fallback — lives here once.
#
# That single template skip is the point: the rule "templates are not
# deployable components" previously existed once per section, so adding it
# to one section did not reach the others, and the same leak had to be
# fixed three times (TASK-0005, TASK-0006, TASK-0008). See B-007 /
# TASK-0011. tests/validate.sh independently asserts that no generated row
# points at a _template* path, so a regression here fails a check rather
# than reaching a commit.
set -euo pipefail
cd "$(dirname "$0")/.."
REG=docs/registry.md

# Strip one matching pair of surrounding quotes from a YAML scalar.
#
# TASK-0018: without this, a quoted `description: "..."` reached the
# registry with its quotes intact, while an unquoted one did not — so the
# defect was visible only in the two components that quote their
# frontmatter and invisible in the rest. ADR-0008's skill linter accepts
# both forms deliberately, which is correct: the *generator* normalizes,
# the schema does not dictate style.
#
# Only a matching leading/trailing pair is removed, so a description that
# merely contains a quote is untouched.
unquote() {
  local s="$1"
  case "$s" in
    '"'*'"') [ ${#s} -ge 2 ] && s="${s:1:${#s}-2}" ;;
    "'"*"'") [ ${#s} -ge 2 ] && s="${s:1:${#s}-2}" ;;
  esac
  printf '%s' "$s"
}

# Print the items of a top-level YAML block sequence in the frontmatter of
# $2, one per line. Deliberately the same shape tests/validate.sh's seq()
# accepts — block sequences only — so a list this cannot read is a list
# that cannot pass the gate either.
fm_seq() {
  awk -v key="$1" -v q="\"'" '
    NR == 1 && /^---[[:space:]]*$/ { fm = 1; next }
    !fm                           { exit }
    /^---[[:space:]]*$/           { exit }
    $0 ~ "^" key ":[[:space:]]*$" { inlist = 1; next }
    inlist {
      if (!match($0, /^[[:space:]]+-[[:space:]]+/)) exit
      v = substr($0, RLENGTH + 1)
      sub(/[[:space:]]+$/, "", v)
      # Same matching-pair rule as unquote(), so a value containing a
      # quote is left alone.
      n = length(v)
      if (n >= 2 && substr(v, 1, 1) == substr(v, n, 1) &&
          index(q, substr(v, 1, 1)) > 0) v = substr(v, 2, n - 2)
      print v
    }
  ' "$2"
}

# Print "name<TAB>description", plus a third tab-separated field for the
# kinds that carry a discriminator column, or nothing if the directory does
# not hold that kind of component.
#   $1 = kind (skill|mcp|loop|agent), $2 = component directory
extract() {
  local kind="$1" d="$2" f name desc clients
  case "$kind" in
    skill|loop|agent)
      # All three kinds carry YAML frontmatter with the same two keys; they
      # differ only in filename.
      case "$kind" in
        skill) f="$d/SKILL.md" ;;
        loop)  f="$d/loop.md" ;;
        agent) f="$d/agent.md" ;;
      esac
      [ -f "$f" ] || return 1
      name="$(unquote "$(awk '/^name:/{sub(/^name: */,"");print;exit}' "$f")")"
      desc="$(unquote "$(awk '/^description:/{sub(/^description: */,"");print;exit}' "$f")")"
      if [ "$kind" = agent ]; then
        # Sorted, not frontmatter order: two roles with the same coverage
        # must render identically however their authors happened to write
        # the list, or the column invites a distinction that is not there.
        clients="$(fm_seq clients "$f" | sort | paste -sd, - | sed 's/,/, /g')"
        printf '%s\t%s\t%s\n' "$name" "$desc" "$clients"
      else
        printf '%s\t%s\n' "$name" "$desc"
      fi
      ;;
    mcp)
      # Two shapes (ADR-0005): authored Python packages carry
      # pyproject.toml, external upstream packages carry server.json.
      # Shape is derived from which marker file is present, never
      # self-declared, so it cannot contradict the directory's contents.
      if [ -f "$d/pyproject.toml" ]; then
        f="$d/pyproject.toml"
        printf '%s\t%s\t%s\n' \
          "$(grep '^name = ' "$f" | head -1 | sed 's/name = //;s/"//g')" \
          "$(grep '^description = ' "$f" | head -1 | sed 's/description = //;s/"//g')" \
          python
      elif [ -f "$d/server.json" ]; then
        python3 -c '
import json, sys
m = json.load(open(sys.argv[1]))
print("%s\t%s\texternal" % (m.get("name", "?"),
                            m.get("description", "").replace("\n", " ")))
' "$d/server.json"
      else
        return 1
      fi
      ;;
  esac
}

# Emit one registry section.
#   $1 = section title, $2 = kind, $3 = parent directory
#   $4 = header label for the third column ("Shape", "Clients"), empty for
#        a section that has none. extract() must supply a third field for
#        any kind passed a label here.
emit_section() {
  local title="$1" kind="$2" parent="$3" label="${4:-}"
  echo "## $title"
  if [ -n "$label" ]; then
    echo "| Name | $label | Description | Path |"
    # Width is the label plus its two padding spaces, matching every other
    # separator cell here ("Name" -> 6). Cosmetic — markdown ignores it —
    # but a generated file that stays aligned is a generated file whose
    # diffs are only ever about content.
    echo "|------|$(printf '%*s' $(( ${#label} + 2 )) '' | tr ' ' -)|-------------|------|"
  else
    echo "| Name | Description | Path |"
    echo "|------|-------------|------|"
  fi
  [ -d "$parent" ] || return 0
  local d base meta name desc extra
  # Sorted for a stable diff across filesystems.
  for d in $(printf '%s\n' "$parent"/*/ | sed 's:/$::' | sort); do
    base=$(basename "$d")
    # THE template skip. One place, all sections.
    case "$base" in _template*) continue ;; esac
    meta=$(extract "$kind" "$d") || continue
    IFS=$'\t' read -r name desc extra <<<"$meta"
    if [ -n "$label" ]; then
      echo "| ${name:-?} | ${extra:-?} | ${desc:-} | $d |"
    else
      echo "| ${name:-?} | ${desc:-} | $d |"
    fi
  done
}

{
  echo "# Component Registry"
  echo
  echo "GENERATED by scripts/sync-registry.sh — do not hand-edit."
  echo
  emit_section "Skills"      skill skills
  echo
  emit_section "MCP Servers" mcp   mcp-servers Shape
  echo
  emit_section "Loops"       loop  loops
  echo
  # Agents carry no Shape column: one shape only. A role's `mode`
  # (primary/subagent) is arguably the most consequential fact about it,
  # but it is *self-declared* frontmatter rather than derived from the
  # directory's contents, and ADR-0005's Clarification is explicit that a
  # self-declared field can contradict those contents while a derived one
  # cannot. Declined deliberately (TASK-0039), not overlooked.
  #
  # `clients` GETS A COLUMN ANYWAY, AND THAT IS NOT A REVERSAL OF THE
  # ABOVE (TASK-0060, closing ADR-0018 clause 8.5 and B-026). `clients` is
  # self-declared too, so the paragraph above would seem to exclude it.
  # The distinction is *what the field does*, not how it is written:
  #
  #   - `mode` is CARRIED THROUGH. scripts/emit-agents.py copies it into
  #     the OpenCode role and drops it for Claude Code, which has no such
  #     field. A wrong `mode` therefore produces a file that exists and
  #     looks right, and the registry would be repeating a claim the repo
  #     cannot check — exactly the self-declaration ADR-0005 warns about.
  #   - `clients` is ACTED ON. It is the gate in emit-agents.py's per-
  #     client loop: a role not naming a client is skipped and NO FILE IS
  #     WRITTEN for it. So the column does not report a claim, it reports
  #     the emitter's own input — the one fact an *index of deployable
  #     components* is for. A wrong `clients` is visible immediately as a
  #     missing or unexpected role in the client's config directory.
  #
  # Note what is NOT the argument: "validate.sh constrains it to a closed
  # set" is true (CLIENTS = {claude-code, opencode}) but does not separate
  # the two, because `mode` is closed-set checked as well (MODES). The
  # separator is the emitter, and only the emitter.
  #
  # So this does not weaken the case against a `mode` column; it states
  # the test that case implies. A self-declared field earns a column when
  # the toolchain acts on it, and `mode` still does not.
  emit_section "Agents"      agent agents Clients
} > "$REG"
echo "Registry written to $REG"
