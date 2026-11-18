# S011-checkpoint

**Date**: 2026-11-14
**Sprint completed**: `S011_ClaudeAlignment`

## State of the project

- `tests/validate.sh` passes at `ee09afd` in the pre-commit hook and in CI.
- 34 tasks: 28 done, 6 in review and left with the human (below).
- Claude Code is the reference harness: marketplace manifest, three plugins,
  loops as skills, the role guard as a plugin hook, permissions and sandbox
  settings, the Stop fast check, OpenTelemetry; Codex and OpenCode outputs are
  generated ports (`ADR-0065`).
- Live this sprint: the nightly evals score for real on Claude Sonnet 5.5
  (pipeline 1087); tag `ai-toolbox-skills--v0.1.2` was signed and verified with
  provenance (pipeline 1097); both Claude unattended runners passed the golden
  run (`docs/reports/2026-11-14-golden-run-comparison.md`); task-orchestrator
  0.7.2's write fence and resume paths were probed live; the gates server
  passed its handshake and sandboxed suite on Linux.
- Broken but accepted: the eval's injection suite scores 0.92 against a floor of
  1.00 (ad-hoc 075); the gates server hangs on `initialize` on Windows only;
  the engine's mid-step cut-off at a worker's turn cap is not reached while
  workers keep their reserve (`S011.T006`, closed on the human's decision); a
  probe after the close, with the reserve taken out, saw the cut-off and
  `collect`'s turn-cap report live (2026-11-15).

## What changed this sprint

Claude Code became the reference harness, with generated ports. See
`../30.ROADMAP.md`, the plan `../archive/sprints/SPRINT-S11-claude-alignment.md`
and the briefs `../tasks/S011.T0*_*.md` (`S011.T001` to `S011.T034`).

Left with the human, in review (each brief's Live criterion says what to see):

- `../tasks/S011.T001_SwitchboardLoadedVersions.md`: the VERSIONS list on the desktop
- `../tasks/S011.T002_TaskCompassOpencodePort.md`: the OpenCode TUI; OpenCode's provider key answered 401
- `../tasks/S011.T003_TaskCompassCodexPort.md`: Codex, by `docs/operations/playbooks/S011.T003-codex-live-check.md`
- `../tasks/S011.T004_DesktopToggleSwitch.md`: the square switch in both themes
- `../tasks/S011.T005_SwitchboardDesignParity.md`: the Switchboard pane's design
- `../tasks/S011.T029_AgentWatchStepsAgree.md`: the band and the Sessions pane

## Open risks / known gaps

- The pick between the two Claude unattended runners is the human's; until
  then both are maintained (the note recommends the Agent SDK runner).
- Both runners ran on Windows only through WSL; the golden run is not a CI job.
- The live eval floor (ad-hoc 075) fails every nightly run until the injection
  failures are read.
- `gates-sandbox` cannot run on the CI runner (no user namespaces; exit 77);
  the sandbox is proven in WSL only.
- Every mod port outside Claude Code (OpenCode, Codex) is unseen in its client.

## Confidence assessment

- Confident of: the signed release path, the live evals, the SDK runner on the
  fixture, the orchestrator's fence and resume, the role guard's 448 fixtures.
- Untested in practice: the mods' desktop rendering checks, the OpenCode and
  Codex ports, a golden run on a real repository, the gates HTTP path exposed
  beyond tests.
- Wants a second reader: the runner comparison, and the decision to pre-approve
  each role's guard allowlist as Bash rules in the SDK runner.
