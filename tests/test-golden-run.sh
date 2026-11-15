#!/usr/bin/env bash
# test-golden-run.sh - the golden unattended run's dry run, with no key and no
# network: skills/unattended-ops/templates/bindings/agent-sdk/runner.py against
# the stub claude_agent_sdk, on the three-task calc.py fixture. Run by the
# `golden-run-dry` CI job (.gitlab/ci/golden-run.yml). Not in tests/validate.sh
# (it needs a Linux python3 for fcntl, and takes about 20 s).
# Usage: tests/test-golden-run.sh
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
python3 "$root/skills/unattended-ops/templates/bindings/agent-sdk/tests/golden_fixture.py" dry-run "$work/golden"
