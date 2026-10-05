# ADR-0032 — The unattended-run binding suites run in CI, not in the gate

## Status

Accepted (2026-10-05), on the human's decision of that day. Task:
`TASK-0141`. Discharges `B-037`.

## Context

- **Both bindings ship test suites, and nothing ran them.** They are the
  Claude Code binding's, against a stub Workflow runtime, and the OpenCode
  binding's, against a stub `opencode`. `skills/unattended-ops/SKILL.md` said
  so, as did the files themselves.
- **That cost something, measured.** `98ce299` (`TASK-0103`, 2026-09-25)
  put a `must` citing a task id into the Claude Code `binding.md`.
  `check-binding.sh` rejects that by design (`ADR-0022` clause 1.4), so the
  suite went red. It stayed red on `master` for two days, three commits
  landed on top of it, and `tests/validate.sh` printed `OK` throughout.
  `TASK-0112` found it.
- **Why the gate could not simply call them.** The gate must be fast,
  offline and hermetic (`ADR-0007`, `ADR-0009`), and runs on every commit.
  - The OpenCode suite takes about 3 minutes here: 3m12s on 2026-10-05, for
    40 tests.
  - The Claude Code suite needs `node`, which a fresh clone is not
    guaranteed to have, and `ADR-0009` forbids validating runtime presence.
  - A `command -v node` guard would skip silently on a host without it,
    which `ADR-0009` calls worse than no gate.

## Decision

A `bindings` job in `.github/workflows/validate.yml` runs both suites on
every push and pull request. `tests/validate.sh` does not run them.

1. The job runs the Claude Code suite with `node --test <file>` and the
   OpenCode suite with `python3 -m unittest discover`. It prints the
   interpreters' versions first. A missing interpreter fails the step and
   never skips it.
2. A failed job fails the `validate` workflow run, so `ci-alert.yml` reports
   it on `master` as it does any red `validate`. No separate alert exists.
3. `check-binding.sh` is not run by the job: it rejects an unfilled template
   by design, and the templates are unfilled.
4. Files that are copied into consuming repositories state the wiring in
   words true there too: *in ai-toolbox, CI's `bindings` job runs these*.

## Alternatives considered

- **A second, non-hermetic local script**, run by hand like
  `tests/smoke-mcp.sh`, reporting PASS, FAIL and SKIP. Rejected by the
  human: it still depends on someone remembering to run it, which is the
  failure `B-037` measured.
- **Accept the convention** and record its cost, with nothing running the
  suites. Rejected: the cost is now measured, and the remedy is cheap.
- **Put them in `tests/validate.sh`.** Rejected for the reasons in
  *Context*: three minutes on every commit, and a runtime check `ADR-0009`
  forbids.

## Consequences

- A red binding suite is reported on the push that breaks it, by the issue
  `ci-alert` opens, instead of being found days later.
- **It is reported, not prevented.** The hook still lets the commit through,
  as `validate.yml`'s header says of CI in general: the hook prevents, CI
  reports.
- The `validate` workflow takes longer: the `bindings` job runs in parallel
  with `validate`, so its wall time is the longer of the two.
- Both suites prove control flow against stubs. Running them in CI does not
  make them evidence about a real `opencode` or a real Workflow run.
