# TODO

- [x] TASK-0001 — Port and harmonize the project-migration skill (done)
- [x] TASK-0002 — Extend the skill frontmatter schema (done)
- [x] TASK-0003 — Harmonize the project-workflow skill (done)
- [x] TASK-0004 — Allow external (Node/npm) MCP servers alongside authored Python ones (done)
- [x] TASK-0005 — External MCP server shape: manifest, scripts, validation (done)
- [x] TASK-0007 — Port the ansible MCP server (done)
- [x] TASK-0006 — Client config snapshots and multi-client skill deployment (done)

## Sprint S2 — Multi-client hardening
- [x] TASK-0008 — Author the first loop component (release-check) (done)
- [x] TASK-0009 — MCP server smoke-test harness (done)

## Sprint S3 — Automation
- [x] TASK-0011 — De-duplicate the registry generator; reject template rows (done)
- [x] TASK-0010 — Pre-commit hook running validate.sh; inert CI workflow (done)

## Sprint S4 — Closing the open loops
- [x] TASK-0012 — Skill linter, frontmatter rules only (done; B-002 closed)
- [x] TASK-0013 — MIT LICENSE backing the skills' `license:` claims (done; B-004 closed)
- [x] TASK-0014 — install.sh warns on the core.filemode=false hook trap (done)
- [x] TASK-0015 — Env vars documented + enforced; git remote wired; CI verified (done)
- [x] TASK-0016 — LM Studio UI runbook procedure; ADR-0010 on the Python shape (done)

## Post-S4 (no sprint open)
- [x] TASK-0017 — Record the LM Studio UI verification (PASS); fix the
      `WORKSPACE_ROOT` placeholder trap; close Phase 2's last criterion (done)
- [x] TASK-0018 — Close B-001 as superseded (ADR-0011); fix the registry
      quote leak and add three registry-integrity checks (done)
- [x] TASK-0019 — Retract the false default-branch mismatch claim (done)

## Sprint S5 — Session handover contract (open)
Planned by `.ai/planning/plans/PLAN-0002-session-handover-contract.md`;
decisions in ADR-0012. Run in order — each depends on the one above.
- [x] TASK-0020 — Skill: `reference/session-handover.md`; restore
      `00.CONVENTIONS.md` to its byte budget (done — 3087→3060; found
      the budget target was ambiguous, and that TASK-0021 has two checks
      that cannot fail)
- [x] TASK-0021 — Skill: task-template `Inputs`/`Outputs`; version
      `3.1.0` (done — merged `Files touched` into `Outputs`, correcting
      a false claim in ADR-0012; both clients are symlinks so two
      planned checks were struck as unfailable)
- [x] TASK-0022 — This repo: merge into the two contract sections in
      `.ai/templates/TASK.md` (done — **three** sections merged, not
      four: measuring showed `Minimal context` carries narrative up to 82
      lines that a table would destroy. 16→15 sections)
- [x] TASK-0023 — `validate.sh`: handover-omission check with the
      `≥ 0020` boundary (done — 7 proof cases; they exposed that
      `.ai/tasks/completed/` could hide a brief from the check, fixed
      before shipping)

**Sprint S5 complete.** Next: `REVIEW-0007` (S5 checkpoint).

Notes:
- "Port first MCP server" was split into 0005 (mechanism) + 0007 (payload)
  by `.ai/planning/plans/PLAN-0001-port-ansible-mcp-server.md`.
- S3 ran 0011 before 0010 despite the numbering, so the new commit gate
  would guard an already-corrected generator.
- S4's TASK-0016 was `done` as *documentation*: it turned an uncompletable
  item into a written human procedure. The human then ran that procedure,
  and TASK-0017 records the result — so the pair is the intended shape:
  agent writes the procedure, human executes, agent records the evidence.
  The check passed **and** found a defect (placeholder `WORKSPACE_ROOT`),
  which is the argument for running verifications rather than assuming them.
- **TASK-0019 was missing from this list entirely** until S5's planning
  session added it. It was done, recorded in `SPRINT-CURRENT.md` and in
  `.ai/tasks/`, and simply never checked off here — a small instance of
  exactly the omission class S5 exists to catch, found by reading this
  file rather than by any check.
- S5 is the first sprint since S1 planned from a written plan
  (`PLAN-0002`) rather than a backlog item. Its ordering is a dependency
  chain, not a preference: the skill is canonical (ADR-0004), so its
  shape settles before this repo adopts it, and nothing is enforced
  until the shape stops moving.
