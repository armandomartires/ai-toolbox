# SESSION-20260915-1800 — Execute TASK-0036 (agent schema mapping spike)

- Date: 2026-09-15
- Agent: opencode (claude-opus-5)
- Objective: Execute TASK-0036 — re-verify the per-client agent field
  mapping against live vendor docs, establish unknown-frontmatter-key
  behaviour by observation, and recommend a mechanism for ADR-0018.
- Entry state: S7 open; TASK-0041 and TASK-0042 done; ADR-0019 accepted;
  ADR-0017 and ADR-0018 proposed and blocked on their spikes. Working tree
  clean at `8eefb15`.

## What was done

A spike, so the output is evidence rather than a component. No component
was added or changed; `scripts/sync-registry.sh` was correctly not run.

All three vendor pages re-fetched (never cited from `PLAN-0004`, per the
brief), and the installed clients recorded: `opencode 1.18.31`,
`claude 2.1.246`. Fixtures written to `/tmp/opencode/agent-schema-spike/`
only — no real client config touched.

## Findings that change downstream work

1. **Emission stands, but the reason in ADR-0018 is wrong.** The ADR
   expected the blocker to be semantic. The real one is a **safety**
   blocker, observed: a fixture declaring read-only in *only* OpenCode's
   `permission:` syntax loaded in Claude Code with **Write, Edit and Bash
   in its tool pool**, against a native-syntax control reporting
   `WRITE=no EDIT=no BASH=no`. A superset file produces ADR-0018's
   predicted emitter bug on every role, with no bug required.
   *Limit:* the subagent then refused to write on prompt grounds, so the
   breach is the tool pool, not a completed write.
2. **Five of eight capability terms are OpenCode-only**, and they carry the
   safety value. `git-ops` and `shell-runner` **cannot be expressed as
   Claude Code subagents at all** without a session-wide rule or a hook —
   both outside a single agent file, so outside the one-source model.
   TASK-0045 inherits a scoping problem.
3. **The lossy direction is OpenCode → Claude Code**, silently. So the
   emitter must **refuse, not degrade**, a term it cannot enforce — the one
   new clause ADR-0018 needs.
4. **Four of ADR-0018's "established" rows were wrong after four days**,
   including two it states as established.

## Corrections made to this session's own output

Five, all caught by re-reading rather than by any check:
- A `validate.sh` output invented from memory; the gate prints
  `validate.sh: OK`.
- Permission keys counted as 16/6; actually **15/5**.
- "11" newer patch versions; actually **6**.
- One changed `~/.claude/` file; actually **three** (all client-managed,
  no agent/permission content).
- **An absence asserted from too small a search**: `subagent_depth`'s
  default recorded *unverified* because it is absent from the agents page,
  then found stated verbatim on the **config** page. The brief named three
  pages; the fact was on a fourth.

## Validation

- `bash tests/validate.sh` → PASS (`validate.sh: OK`), 0.69 s
- `scripts/sync-registry.sh` → not applicable, no component changed
- `~/.config/opencode/agents`, `~/.config/opencode/agent`, `~/.claude/agents`
  all still **absent** after the spike

## Exit state

TASK-0036 done. **ADR-0018 ready to accept** with the revisions named
above — that is the next unit of work, and it is a ratification, so it is
the human's call. TASK-0034 remains the other unblocked Phase 1 spike.
Phase 2 (TASK-0037) unblocks once ADR-0018 is accepted.

- Result: TASK-0036 done. Commit `724f62c` (plus a follow-up recording the
  hash), pushed to `origin/master` and confirmed by re-fetch.
