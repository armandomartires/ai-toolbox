# TASK-0009 — MCP server smoke-test harness

## Objective
Replace the by-hand MCP `initialize` handshake used in TASK-0006 with a
repeatable command that verifies a registered MCP server actually starts
and speaks the protocol — closing backlog B-003, whose "ready when"
condition ("first server ported") was satisfied by TASK-0007.

## Minimal context
`tests/validate.sh` checks MCP manifests **statically**: required keys
present, JSON parses, `name` matches directory, destructive capabilities
carry a granted authorization. Nothing checks that the launch command in
`launch.command` actually works.

That gap was papered over manually. TASK-0006 verified LM Studio's wiring
by piping a hand-written JSON-RPC `initialize` request into
`npx -y @ansible/ansible-mcp-server@26.6.0 --stdio` and asserting on the
`serverInfo` in the reply. It worked and returned
`{"name":"ansible-mcp-server"}` — but it was a one-off shell incantation
in a session transcript, not something a future session can re-run. That
incantation is this task's seed.

Backlog B-003 note, recorded at S1 close: *"`validate.sh` checks manifests
statically; nothing yet checks that a server actually starts and speaks
MCP."*

## Scope

### Included
- A smoke-test script (e.g. `tests/smoke-mcp.sh`) that, for each external
  server manifest, launches `launch.command` with the manifest's declared
  environment, performs an MCP `initialize` handshake, and asserts a
  well-formed result.
- Clean, explicit handling of the offline/unavailable case — a network
  failure must not be reported as a server defect.
- Documentation in `docs/operations/runbook.md` and a Commands entry in
  `AGENTS.md`.
- `tests/validate.sh` left **fast and hermetic** — see the decision below.

### Not included
- **Wiring into CI or a pre-commit hook.** That is Phase 3's objective
  ("CI checks ... registry automation"), explicitly out of S2's scope.
- **Authored (Python) servers.** None exist yet; only
  `mcp-servers/_template/` does. Write the harness so adding one later is
  a small extension, but do not build for a shape with no instance —
  TASK-0005's schema succeeded precisely because it was checked against
  real candidates rather than imagined ones.
- **Calling tools.** `initialize` proves the process starts and speaks
  MCP. Invoking `tools/list` is a reasonable extension; invoking an actual
  tool is not — ansible's surface includes destructive tools and a smoke
  test must never execute them.
- **Verifying servers in client UIs.** Out of scope; LM Studio's UI gap
  stays a recorded known gap.

## Preconditions
- Branch `master`, clean. TASK-0007 done (a real external server exists).
- Network access for `npx` to fetch the pinned package.

## Design decision to make in this task
**Whether the smoke test runs inside `tests/validate.sh` or beside it.**
State the reasoning in the execution log either way. The tension:

- `validate.sh` is currently fast, offline, and hermetic. It is the
  mandatory gate in `AGENTS.md`'s Definition of done, run at the end of
  every task.
- A smoke test needs the network (`npx -y` fetches upstream), takes tens
  of seconds, and can fail for reasons that have nothing to do with the
  repo's correctness — a flaky registry, a proxy, an offline laptop.

Folding a network-dependent check into the mandatory gate would make every
task's validation flaky and slow. The recommended shape is therefore a
**separate script**, with `validate.sh` untouched; if the smoke test is
ever invoked from `validate.sh`, it must skip cleanly (exit 0 with a
stated SKIP) when the network is unavailable rather than failing. Do not
let a skip masquerade as a pass in the output.

## Likely files
- `tests/smoke-mcp.sh` (new)
- `docs/operations/runbook.md`
- `AGENTS.md` (Commands)
- `.ai/planning/BACKLOG.md` (close B-003)
- `.ai/context/CURRENT_STATE.md`, `.ai/planning/SPRINT-CURRENT.md`,
  `.ai/tasks/TODO.md`

## Execution plan
1. Generalize TASK-0006's handshake: read each
   `mcp-servers/*/server.json`, build the launch command from
   `launch.command`, export required `environment` variables, and send a
   JSON-RPC `initialize` request over stdio.
2. Assert on the reply: valid JSON, matching `id`, a `result` containing
   `protocolVersion` and `serverInfo.name`. Report the returned
   `serverInfo` so the output is evidence, not just a green tick.
3. Enforce a timeout per server so a hanging process fails the check
   instead of hanging the run.
4. Distinguish three outcomes explicitly — PASS, FAIL (server started but
   did not speak MCP correctly), and SKIP (could not attempt: no network,
   missing runtime). Never collapse SKIP into PASS.
5. Support `--server <name>` to test one server.
6. Document in the runbook and `AGENTS.md` Commands.
7. Prove the harness detects a broken server, not only a working one (see
   Mandatory validations). Close B-003.

## Acceptance criteria
- [ ] `bash tests/smoke-mcp.sh` verifies every external server via a real
      MCP `initialize` handshake and prints the returned `serverInfo`.
- [ ] `--server ansible` tests one server; unknown name exits non-zero.
- [ ] A hanging or non-speaking server fails within a bounded timeout
      rather than hanging.
- [ ] PASS / FAIL / SKIP are distinct in both output and exit code; a SKIP
      is never reported as a PASS.
- [ ] `tests/validate.sh` remains offline-safe and fast — confirm its
      runtime and network behaviour are unchanged.
- [ ] No destructive tool is invoked; only `initialize` (and optionally
      `tools/list`).
- [ ] Runbook and `AGENTS.md` Commands document the harness.
- [ ] Backlog B-003 closed.

## Mandatory validations
- [ ] `bash tests/smoke-mcp.sh` → PASS for ansible, printing its real
      `serverInfo.name`.
- [ ] **Fails-when-broken proof**, each observed and then reverted:
      1. a fixture manifest whose `launch.command` is a command that
         exits immediately → FAIL, not PASS;
      2. a fixture whose `launch.command` is a process that produces no
         output (e.g. `sleep`) → FAIL by timeout, bounded;
      3. a fixture whose command emits non-JSON on stdout → FAIL with a
         parse error, not a crash;
      4. the real ansible manifest → PASS.
      Record each observed message.
- [ ] `bash tests/validate.sh` → still OK, still offline-safe.
- [ ] `git status` clean at end; every fixture removed.

## Risks and rollback
- **Risk: a flaky network turns into a false repo defect.** The reason for
  the PASS/FAIL/SKIP split and for keeping this out of the mandatory gate.
- **Risk: the harness executes something destructive.** Ansible's server
  exposes playbook execution and package installation. Mitigated by
  restricting the harness to `initialize`; a smoke test must never be the
  thing that runs a playbook.
- **Risk: over-fitting to one server.** Only ansible exists. Mitigated by
  driving everything from the manifest rather than hard-coding, and by
  fixtures that exercise failure paths the real server never takes.
- **Risk: scope creep into Phase 3.** CI wiring is explicitly excluded.
- **Rollback**: `git revert` this task's commit. The harness disappears;
  `validate.sh` is untouched by design, so nothing else regresses.

## Dependencies
Depends on TASK-0007 (a real external server to test). Independent of
TASK-0008. Closes backlog B-003.

## Expected result
"The server works" becomes a claim any future session can re-verify with
one command, instead of a shell incantation buried in a session log — and
the manifest's `launch.command` gains a check that it is actually
launchable.

## Status
- Status: planned   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: agent
- Created: 2026-09-13
- Updated: 2026-09-13
## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
