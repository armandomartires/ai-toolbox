# Sprint S11 — Claude-centric alignment (OPEN)

**Opened 2026-11-10 on the human's decision** (`TASK-0286`), in the same commit that added **Phase 11** to `ROADMAP.md`. S10 closed 2026-09-26 on `REVIEW-0012` and is archived in `planning/sprints/`.

The sprint's plan, decisions record, dependencies and order are in `planning/sprints/SPRINT-S11-claude-alignment.md`; its source is the answered alignment plan in `docs/reports/2026-11-10-alignment/`. Twenty briefs, `TASK-0266` to `TASK-0285`, all `planned`. Start with the P0 items (`TASK-0266` to `TASK-0270`), which have no item dependencies.

- **The tier ADR is pre-accepted.** The human accepted on 2026-11-10, in advance, the ADR `TASK-0268` drafts, within that brief's scope: it supersedes `ADR-0018` clause 7 for Claude Code emission only, with the D3 table. A draft that goes further goes back to the human.
- **Human-gated in the sprint:** live exposure of gates over HTTP (`TASK-0285`), the nightly eval schedule and spend (`TASK-0267`, `TASK-0278`), and `TASK-0271`'s ADR for the refused terms that pass measurement.

The next task id is the next number not yet used in `.ai/tasks/`.

## Open, not scheduled

1. **`worktree-only` on Claude Code.** Measured as not enforced (`TASK-0111`). To decide: keep emission refused, redefine the term, or have the roles stop declaring it.
2. **OpenCode binding.** Bulk staging (`TASK-0097`) and gate-map reads (`TASK-0098`, `B-030`) are tested against stubs only.
3. **`ansible-ops`.** All nine gates were exercised once (`TASK-0116`). A guest-level change with a real PVE snapshot has not been.
4. **`ADR-0022` F8.** The only open falsifier, and it applies only to Bionic (S10.4).
5. **Secrets backends, live (`ADR-0034`).** `provision` and the GitLab and GitHub `put` are proven against stubs only (`TASK-0156`, `TASK-0157`). The first real run needs the Vault admin login, the `secrets-provisioner` policy, and a scratch repository.
6. **Forge trackers, live (`ADR-0037`).** No project runs on a `gitlab` or `github` tracker yet; `glab` and `gh` are not on this host. The mapping and the unattended run's snapshot procedure (`ADR-0038`) are unexercised.
7. **An untested commitment.** "If a sprint shrinks, cut a product, never the spike." Restate it in the next plan that risks shrinking.

## Known limitation

- **`git add -- .`** cannot be denied at OpenCode's glob layer (`TASK-0083`). The rule lives in the bodies of `git-ops` and `closer`. Reopen only if OpenCode's matcher changes.

## Closed, not to be re-raised

- Backlog items: `B-018`, `B-021`, `B-023`, `B-024`, `B-026` to `B-035`, `B-043`.
- The `ansible-core` version recount (`TASK-0108`, `TASK-0115`).
- `ADR-0022` F7 and F9 (`TASK-0114`).
- The Claude Code binding's first real run (`TASK-0113`).
