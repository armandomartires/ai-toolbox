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

Notes:
- "Port first MCP server" was split into 0005 (mechanism) + 0007 (payload)
  by `.ai/planning/plans/PLAN-0001-port-ansible-mcp-server.md`.
- S3 ran 0011 before 0010 despite the numbering, so the new commit gate
  would guard an already-corrected generator.
- S4's TASK-0016 is `done` as *documentation*: it turned an uncompletable
  item into a written human procedure. The LM Studio UI check itself is
  still unperformed and is not claimed — see `docs/operations/runbook.md`
  and `configs/lm-studio/README.md`.
- Every task above is `done`. Nothing is in flight. Open items and who can
  act on each are listed in `.ai/planning/SPRINT-CURRENT.md`.
