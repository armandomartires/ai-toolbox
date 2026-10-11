#!/usr/bin/env bash
# Fail when a tracked file names a private host (TASK-0162).
#
# WHY: the `github` mirror is public (ADR-0028), so a tracked file is a
# published one. AGENTS.md has said "the intranet hostname never goes in a
# tracked file" since TASK-0123, and nothing checked it: by 2026-10-11 eleven
# files named internal hosts.
#
# The names to look for can never be written in this repository, so they come
# from two untracked places:
#   1. the `origin` remote's host, its first label and its parent domain --
#      unless origin is a public forge or absent, which derives nothing;
#   2. <git-common-dir>/info/private-patterns -- one fixed string per line,
#      case-insensitive, `#` comments and blank lines ignored. git never tracks
#      it, and every worktree of the repository reads the same file.
#
# Output names `file:line` and where the pattern came from, never the pattern,
# because this output reaches CI logs and chat transcripts.
#
# WHAT THIS PROVES: no tracked file in the working tree contains any pattern.
# WHAT IT DOES NOT PROVE: anything about git history, commit messages, or a
# host that is neither origin nor listed in private-patterns. With nothing
# configured it says so and exits 0: there is nothing private to protect.
#
# Usage: check-private-names.sh [REPO]     (default: the current directory)
set -euo pipefail

cd "${1:-.}"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "check-private-names: not a git work tree: $(pwd)" >&2
  exit 2
}

# A first label this generic would match ordinary prose ("the gitlab host").
GENERIC_LABELS=" git gitlab github gitea forgejo forge code repo repos scm vcs www srv server host "
PUBLIC_FORGES=" github.com gitlab.com bitbucket.org codeberg.org ssh.github.com "

# The host part of a remote URL, lowercased, or nothing for a local path.
host_of() {
  local url="$1" h=""
  case "$url" in
    *://*) h="${url#*://}"; h="${h%%/*}"; h="${h##*@}"; h="${h%%:*}" ;;
    *@*:*) h="${url#*@}"; h="${h%%:*}" ;;
  esac
  printf '%s' "$h" | tr '[:upper:]' '[:lower:]'
}

patterns=()   # parallel arrays: the string, and where it came from
sources=()
add() { [ -n "$1" ] && { patterns+=("$1"); sources+=("$2"); }; return 0; }

url="$(git remote get-url origin 2>/dev/null || true)"
host="$(host_of "$url")"
if [ -n "$host" ] && [[ "$PUBLIC_FORGES" != *" $host "* ]]; then
  add "$host" "origin host"
  if [[ ! "$host" =~ ^[0-9.]+$ ]] && [[ "$host" == *.* ]]; then
    label="${host%%.*}" parent="${host#*.}"
    if [ "${#label}" -ge 4 ] && [[ "$GENERIC_LABELS" != *" $label "* ]]; then
      add "$label" "origin host, first label"
    fi
    # Only a parent with its own dot is specific: "example.com" yes, "lan" no.
    [[ "$parent" == *.* ]] && add "$parent" "origin host, parent domain"
  fi
fi

pfile="$(git rev-parse --git-common-dir)/info/private-patterns"
n=0
if [ -f "$pfile" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    case "$line" in ''|'#'*) continue ;; esac
    n=$((n + 1))
    add "$line" "private-patterns #$n"
  done < "$pfile"
fi

if [ "${#patterns[@]}" -eq 0 ]; then
  echo "check-private-names: nothing private configured (origin is a public forge or absent, and no info/private-patterns) -- nothing checked"
  exit 0
fi

found=0
for i in "${!patterns[@]}"; do
  # -I skips binaries; tracked files only, which includes anything staged.
  hits="$(git grep -n -I -i -F -e "${patterns[$i]}" -- . 2>/dev/null | cut -d: -f1,2 || true)"
  [ -n "$hits" ] || continue
  found=1
  while IFS= read -r h; do
    echo "PRIVATE NAME: $h (${sources[$i]})"
  done <<< "$hits"
done

[ "$found" -eq 0 ] || exit 1
echo "check-private-names: OK (${#patterns[@]} patterns)"
