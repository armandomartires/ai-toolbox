#!/usr/bin/env bash
# Prove the gather_subset guard fires, and fires correctly, against seven
# fixtures.
#
# Usage: tests/gather-subset-guard.sh
#
# NOT part of tests/validate.sh and must not be folded into it. The mandatory
# gate is offline, hermetic and fast (AGENTS.md); this harness needs
# `ansible-lint` installed, which is not a dependency of this repository and
# cannot be made one without breaking the gate's hermetic property (ADR-0009).
# Nothing in this repository runs this script automatically -- it is manual, by
# design, and the guard it proves is shipped for OTHER repositories to wire in.
#
# WHY THIS HARNESS EXISTS AT ALL
#   TASK-0027 observed that a custom ansible-lint rule which is not in the
#   active profile and not named in `enable_list` is LOADED, LISTED, and NEVER
#   EVALUATED -- at exit 0. So "lint passed" is not evidence the rule ran, and
#   an adopter could believe the guard is installed while it does nothing. That
#   is worse than no guard, because it is trusted. This harness is the
#   fires-proof that TASK-0027 made a precondition of recommending the
#   ansible-lint route at all.
#
# OUTCOMES ARE THREE, NEVER TWO
#   PASS - every fixture produced its expected verdict
#   FAIL - a fixture produced the wrong verdict (a real defect)
#   SKIP - could not attempt (ansible-lint not installed). NOT a pass.
#
# WHAT A PASS PROVES
#   That the rule loads, is evaluated, distinguishes both accepted exclusion
#   forms, resolves a bare hostname through inventory group membership, reports
#   ambiguity distinguishably, and stays silent on safe plays.
# WHAT A PASS DOES NOT PROVE
#   That a node cannot hang. The hazard is not reproducible on demand; this is
#   a syntax check. See skills/ansible-ops/references/hazards.md class 1.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

RULE_DIR="skills/ansible-ops/scripts"
FIX_DIR="skills/ansible-ops/fixtures/gather-subset"
RULE_ID="gather-subset-mounts"

# Resolve ansible-lint: PATH first, then the known local venv. A SKIP here is
# an honest outcome, not a pass.
LINT=""
if command -v ansible-lint >/dev/null 2>&1; then
  LINT="$(command -v ansible-lint)"
elif [ -x "$HOME/.venvs/sigma-ansible/bin/ansible-lint" ]; then
  LINT="$HOME/.venvs/sigma-ansible/bin/ansible-lint"
fi

if [ -z "$LINT" ]; then
  echo "SKIP: ansible-lint not found on PATH or in ~/.venvs/sigma-ansible/."
  echo "SKIP: a SKIP is not a pass -- the guard is unproven in this environment."
  exit 0
fi

echo "gather-subset-guard: using $LINT"
"$LINT" --version 2>/dev/null | head -1

# A scratch project directory, because ansible-lint resolves configuration from
# the project root and writes ansible.log into its working directory. Never run
# it inside a directory whose contents matter (TASK-0027 finding 4).
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/playbooks" "$WORK/inventory" "$WORK/rules"
cp "$RULE_DIR/gather_subset_guard.py" "$WORK/rules/"
cp "$FIX_DIR"/f*.yml "$WORK/playbooks/"
cp "$FIX_DIR/inventory.yml" "$WORK/inventory/"

# The rule must be explicitly enabled. This is the trap the harness exists to
# expose: without enable_list the rule loads, lists, and never fires.
#
# NOTE the absence of a `rules:` block. Per-rule configuration is NOT possible
# for a custom rule: the config schema's `$defs.rule` sets
# `additionalProperties: false`, so `rules: {gather-subset-mounts: {...}}` is a
# FATAL config error (exit 3, no linting). Configuration is by environment
# variable instead -- see the rule's docstring. The first version of this
# harness wrote that block and every fixture "failed"; the cause was the
# config, not the rule.
cat > "$WORK/.ansible-lint" <<EOF
profile: production
enable_list:
  - $RULE_ID
EOF

# Point the rule at the fixture inventory via its environment contract.
export GATHER_SUBSET_GUARD_HAZARD_GROUPS="pve_cluster"
export GATHER_SUBSET_GUARD_INVENTORY="inventory/inventory.yml"

# Match on the rule's OWN MESSAGES, never on the rule id alone.
#
# Verified necessary: the id appears in ansible-lint's *error* output too
# ("Invalid configuration file ... $.rules['gather-subset-mounts'] ..."), so an
# id-only grep reported "fired" for four fixtures when the rule had not run at
# all -- and reported "FIRED but should be silent" for the four that must be
# silent. Every result was wrong in the direction that looked like a working
# harness for the fire cases. This is the sibling of TASK-0042's lesson: match
# on the check's own message, not on a string that appears in unrelated output.
FIRED='(MISSING EXCLUSION|AMBIGUOUS TARGET)'

run_fixture() {
  ( cd "$WORK" && "$LINT" -r rules -R --nocolor "playbooks/$1" 2>&1 )
}

# Guard against the harness silently testing nothing: a config error means no
# linting happened, and every verdict below would be meaningless.
config_ok() {
  local out
  out="$(run_fixture f2-play-keyword-exclusion.yml)"
  if printf '%s' "$out" | grep -q "Invalid configuration file"; then
    echo "FAIL: ansible-lint rejected the harness config -- nothing was linted."
    printf '%s\n' "$out" | sed 's/^/       /'
    exit 1
  fi
}
config_ok

fail=0
pass=0

# expect_fire <fixture> <expected-message-substring> <human-label>
expect_fire() {
  local fx="$1" want="$2" label="$3" out
  out="$(run_fixture "$fx")"
  if printf '%s' "$out" | grep -Eq "$FIRED"; then
    if printf '%s' "$out" | grep -q "$want"; then
      echo "  PASS  $fx -> fired, $label"
      pass=$((pass + 1))
    else
      echo "  FAIL  $fx -> fired but WRONG MESSAGE (wanted: $want)"
      printf '%s\n' "$out" | sed 's/^/        /'
      fail=1
    fi
  else
    echo "  FAIL  $fx -> DID NOT FIRE (expected $label)"
    printf '%s\n' "$out" | sed 's/^/        /'
    fail=1
  fi
}

# expect_silent <fixture> <human-label>
expect_silent() {
  local fx="$1" label="$2" out
  out="$(run_fixture "$fx")"
  if printf '%s' "$out" | grep -Eq "$FIRED"; then
    echo "  FAIL  $fx -> FIRED but should be silent ($label)"
    printf '%s\n' "$out" | sed 's/^/        /'
    fail=1
  else
    echo "  PASS  $fx -> silent, $label"
    pass=$((pass + 1))
  fi
}

echo
echo "Fixtures that MUST fire:"
expect_fire f1-group-no-exclusion.yml \
  "MISSING EXCLUSION" "hazard group, no exclusion"
expect_fire f4-ambiguous-hosts.yml \
  "AMBIGUOUS TARGET" "unresolvable wildcard pattern, reported as ambiguous"
expect_fire f6-bare-hostname-no-exclusion.yml \
  "MISSING EXCLUSION" "BARE HOSTNAME resolved through inventory (D1/D2)"
expect_fire f7-module-defaults-wrong-scope.yml \
  "MISSING EXCLUSION" "module_defaults scoped to a non-setup target (D3)"

echo
echo "Fixtures that MUST stay silent:"
expect_silent f2-play-keyword-exclusion.yml "play-keyword exclusion accepted"
expect_silent f3-module-defaults-exclusion.yml \
  "module_defaults scoped to setup accepted"
expect_silent f5a-facts-disabled-bare-host.yml \
  "gather_facts: false on a hazard host"
expect_silent f5b-localhost-facts-enabled.yml \
  "localhost with facts is not hazard-class"

# The two failure messages must be distinguishable, or an operator cannot tell
# "you forgot the exclusion" from "I could not tell what this targets".
echo
echo "Message distinguishability (fixture 1 vs fixture 4):"
m1="$(run_fixture f1-group-no-exclusion.yml | grep -c 'MISSING EXCLUSION')"
m4="$(run_fixture f4-ambiguous-hosts.yml | grep -c 'AMBIGUOUS TARGET')"
x1="$(run_fixture f1-group-no-exclusion.yml | grep -c 'AMBIGUOUS TARGET')"
x4="$(run_fixture f4-ambiguous-hosts.yml | grep -c 'MISSING EXCLUSION')"
if [ "$m1" -ge 1 ] && [ "$m4" -ge 1 ] && [ "$x1" -eq 0 ] && [ "$x4" -eq 0 ]; then
  echo "  PASS  the two findings do not share a message"
  pass=$((pass + 1))
else
  echo "  FAIL  messages overlap: f1 ambiguous=$x1, f4 missing=$x4"
  fail=1
fi

# The negative control for the harness itself. Without enable_list the rule is
# loaded but not evaluated, so a fixture that MUST fire goes silent. If this
# control does not reproduce that silence, the harness is not testing what it
# claims and its other results mean less than they appear to.
echo
echo "Negative control -- rule NOT enabled (must go silent):"
cat > "$WORK/.ansible-lint" <<EOF
profile: production
EOF
ctrl="$(run_fixture f6-bare-hostname-no-exclusion.yml)"
if printf '%s' "$ctrl" | grep -Eq "$FIRED"; then
  echo "  FAIL  rule fired without enable_list -- the documented trap did not"
  echo "        reproduce, so this harness is not proving what it claims"
  fail=1
else
  echo "  PASS  silent without enable_list -- the trap is real and reproduced,"
  echo "        which is why enable_list is a wiring REQUIREMENT not advice"
  pass=$((pass + 1))
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "gather-subset-guard: PASS ($pass checks)"
  exit 0
fi
echo "gather-subset-guard: FAIL"
exit 1
