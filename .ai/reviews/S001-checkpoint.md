# REVIEW-0003 — Sprint S1 (Foundation) end-of-sprint checkpoint

- Task(s) reviewed: TASK-0001 through TASK-0007 (the whole sprint),
  ADR-0002 through ADR-0005, PLAN-0001
- Reviewer: agent (opencode), 2026-09-13
- Diff summary: `e72b78c..HEAD` — 7 tasks, 4 ADRs, 1 plan. Component layer
  went from empty to 2 skills + 1 external MCP server, all registered and
  deployed. Scripts went from single-client/Python-only to two clients and
  two MCP shapes, with validation covering skills, MCP manifests, and
  client/wiring-doc pairing.

## Sprint objective vs. outcome

Objective was "migrate existing skills, MCP servers, and loops into the
component layer with full validation."

| Success criterion | Result |
|---|---|
| `tests/validate.sh` green | pass — and its coverage tripled (frontmatter, MCP shape + manifest, client pairing) |
| Registry lists all ported components | pass — and no longer lists templates as real components |
| `install.sh` verified in Claude Code | pass — plus OpenCode, plus ansible MCP `✔ Connected` from a clean install |
| Loops migrated | **not done** — no loop component exists; the objective named loops and the sprint never scoped one |

Verdict on scope: the sprint delivered more than planned on MCP servers
and deployment, and nothing at all on loops. That is worth naming rather
than rounding up to "complete" — `loops/` still holds only its template.

## Findings

### What the sprint got right
- **Every rule change was tested against reality before being written
  down.** ADR-0005 exists because the Python-only stack rule met its first
  real server and lost. The `server.json` schema was paper-checked against
  two servers that were *not* being ported, which is why it needed no
  changes when the real one arrived.
- **Two prose rules became executable.** `AGENTS.md`'s
  destructive-capability rule is now a `validate.sh` check
  (`capabilities.destructive` ⇒ granted authorization ⇒ an
  authorization.task file that exists). The client/wiring-doc pairing is
  likewise enforced rather than remembered.
- **Verification was designed to be falsifiable.** Every new check was
  observed failing for its own expected reason *and* passing on a valid
  case. TASK-0007's clean-start requirement caught the difference between
  "the server works" and "the snippet works" — a distinction a
  same-environment test would have hidden.

### Defects found by this sprint's own process
Three bugs were caught by acceptance criteria rather than by luck, all in
code written earlier in the same sprint:

1. **Template leak** (`sync-registry.sh`) — the `_template` exact-match
   skip meant `_template-external` would publish as a real component, and
   the committed registry was *already* listing `template-mcp-server`.
   Fixed in the MCP loop (TASK-0005) and the skills loop (TASK-0006).
2. **`ln -sfn` into a real directory** (`install.sh`, TASK-0006) — printed
   its replacement notice, reported success, and left the stale skill
   live with a nested symlink underneath. Caught only because the criteria
   required checking the deployed *version*, not the script's output.
3. **Client name mismatch** (`install.sh` vs `configs/`, TASK-0006) —
   caught by the pairing check on its first run, pre-commit.

The pattern: **a script reporting success is not evidence the effect
happened.** All three were invisible to any check that trusted exit codes.

### Process observations
- The sprint's own risk entry ("porting reveals structural mismatches —
  split tasks if needed") fired twice on one TODO line. "Port first MCP
  server" became TASK-0004 (permit the shape), TASK-0005 (build the
  mechanism), TASK-0007 (port). Splitting on discovery worked; the
  original single-line estimate was wrong by roughly 3x.
- Writing PLAN-0001 before executing paid off specifically by *resolving
  two ambiguities in advance* (manifest location, destructive
  authorization), so neither was re-litigated mid-execution.
- `.ai/` numbering drifted once: the human referred to "TASK-0004"
  meaning the port, after renumbering had reassigned that ID. Cheap to
  resolve by asking, but renumbering an in-flight task has a real cost.

## Validation results
- `bash tests/validate.sh` → OK.
- `bash scripts/sync-registry.sh` → registry regenerated; no templates in
  any table.
- `bash scripts/install.sh link` → both clients served, idempotent across
  repeated runs.
- `~/.config/opencode/skills/project-workflow` → resolves to repo `3.0.0`
  (was a hand-placed `2.1.0`); `agent-tiers` untouched.
- ansible MCP: `✔ Connected` in a clean Claude Code install; MCP
  `initialize` handshake confirmed with LM Studio's exact command and env.
- `git status` clean.

## Verdict
**approve**, with the loops gap and the Phase 2 criterion problem recorded
below rather than absorbed silently.

## Follow-up tasks
1. **Re-scope the Phase 2 exit criterion.** "One skill and one MCP server
   working in all clients" is unmeetable as written: LM Studio has no
   Agent Skills target at all. Either exclude LM Studio from the skill
   half or restate the criterion per-client.
2. **Loop component** — named in the S1 objective, never scoped. Either
   port one or drop loops from the Foundation objective honestly.
3. **LM Studio UI verification** — its ansible wiring is proven at the
   config and handshake level, unproven in the app's own tool list
   (needs the GUI launched interactively).
4. **Backlog B-003 (MCP smoke-test harness) is now unblocked** — its
   "ready when" condition was "first server ported", which is satisfied.
   `validate.sh` checks manifests statically; nothing yet checks that a
   server actually starts and speaks MCP. The `initialize` handshake used
   manually in TASK-0006 is the obvious seed for it.
5. **Backlog B-002 (skill linter)** — its condition ("TASK-0001 done") has
   been satisfied since early in the sprint; still an idea.
