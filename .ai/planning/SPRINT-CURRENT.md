# No active sprint

Phases 1, 2 and 3 are complete. No sprint is in progress and no phase is
currently defined — see `ROADMAP.md` under "Phase 4 — not yet defined".

Closed sprints are archived in `.ai/planning/sprints/`:

| Sprint | Phase | Tasks | Checkpoint |
|--------|-------|-------|-----------|
| S1 Foundation | 1 | TASK-0001…0007 | REVIEW-0003 |
| S2 Multi-client hardening | 2 | TASK-0008, TASK-0009 | REVIEW-0004 |
| S3 Automation | 3 | TASK-0011, TASK-0010 | REVIEW-0005 |

## Candidates for the next sprint
From REVIEW-0005's follow-ups and the roadmap. **Scope needs human
confirmation before briefs are written** — `AGENTS.md`'s ambiguity policy
applies, and none of these is urgent.

| Candidate | Note |
|-----------|------|
| Decide B-002's fate (skill linter) | "ready" for three sprints without being scoped. Either brief it or drop it; leaving it perpetually ready misrepresents intent. |
| Exercise the authored (Python) MCP server shape | Only `mcp-servers/_template/` uses it; `smoke-mcp.sh` handles external manifests only. Half the MCP convention has never run. Needs a real reason to author a Python server, not a synthetic one. |
| `install.sh` warns on `core.filemode=false` + wrong hook mode | `validate.sh` catches it, but the person most likely to hit it clones fresh onto Windows and runs `install.sh` first. |
| Add a git remote | A recommendation, not a requirement (ADR-0007). Would activate the inert CI workflow and let its unverified label be removed — or reveal it is wrong. |
| LM Studio UI verification | Needs a human with the GUI open. Not agent work. |

## Standing constraints for whoever scopes next
- Local git is mandatory; a remote is recommended (ADR-0007).
- `tests/validate.sh` is now a commit gate. Its hermeticity — offline, no
  network, sub-second — is load-bearing, not a nicety. Never add
  `tests/smoke-mcp.sh` to the hook.
- ADR-0005, ADR-0006 and ADR-0007 all exist because a criterion written at
  scaffold time met reality and lost. Check assumptions against the
  environment before writing criteria.
