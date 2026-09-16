# SESSION-20260917-0200 — Run S6's two spikes; write all three ADR bodies

- Date: 2026-09-16
- Agent/model: opencode (claude-opus-5)
- Objective: Continue S6 after un-parking it. Run the two spikes that block
  every remaining decision, then write the three ADR bodies from what they
  observed — leaving all three `Proposed`, per the human's decision.
- Context consulted: `.ai/planning/SPRINT-CURRENT.md` (S6),
  `TASK-0027`, `TASK-0028`, `TASK-0031`, `TASK-0052`, ADR-0014/0015/0016
  (skeletons), `ADR-0017` (retitle precedent), `.ai/templates/ADR.md`,
  `skills/ansible-ops/SKILL.md` + `templates/change-record.md` +
  `references/check-mode-fidelity.md`. **Outside this repo, read-only:**
  `SIGMA-infrastructure`'s `ansible.cfg`, `playbooks/`, `inventory/`,
  `.ansible-lint`; the installed `ansible-lint` and `opencode` binaries; two
  vendor documentation pages fetched live.
- Tasks worked on: `TASK-0027` (done), `TASK-0028` (done), ADR-0014,
  ADR-0015, ADR-0016 (bodies written, all `Proposed`). No component changed.

## Decisions

- **Write the ADR bodies but do not self-accept.** The human's instruction.
  Each body cites the spike that grounds it and names where a plan-time claim
  did not survive, rather than filling sections from `PLAN-0003`'s prose —
  which is how they reached skeleton state in the first place.
- **Retitle two ADRs.** `ADR-0015` and `ADR-0016` had titles asserting what
  their bodies now refute. Following `ADR-0017`'s precedent (retitled to
  *"(claim withdrawn)"*), both were renamed **in the H1 only**; filenames
  stay, since every citation uses the `ADR-NNNN` identifier and renaming
  would erase the trace that the plan proposed the rejected shape.
  `ADR-0015`'s Status now warns that its filename names the rejected shape.
- **Make the guard's recommendation conditional rather than clean.** A custom
  `ansible-lint` rule is better than `pre-commit` *only if* it ships a proof
  that it fires; without one it is strictly worse, because it fails silently
  where `pre-commit` fails loudly.
- **Probe with a read-only MCP tool only** (`zen_of_ansible`), never
  `ansible_navigator` — which `TASK-0028` incidentally confirmed is **still
  enabled**, so the exposure `TASK-0026` exists to remove is live.
- **Leave Claude Code documented-only.** Once OpenCode's live observation had
  settled the category question, probing a second client would have meant
  editing a second live config for no additional decision value. Labelled
  rather than quietly treated as equivalent evidence.

## Findings

**1. The target repo's lint gate passes on real content — first time on
record.** 0 failures, 0 warnings, exit 0, across **53 built-in rules** under
`profile: production`. That gate had been live and unproven since S004.T007,
whose own config comments still claim no playbooks exist.

**2. The first lint run failed (exit 2) and both failures were
copy-artifacts** — `ansible.cfg` names `vault_password_file =
tools/vault_pass.sh`, deliberately not copied. **Zero real violations.** The
"4 of 6 files" line is `ansible.cfg` and `ansible.log` being unknown-kind, not
a skipped playbook; checked, because a silently skipped playbook would have
invalidated the whole run.

**3. The fidelity limit has a second reason the brief did not have.** The
clean pass required **editing `ansible.cfg`**, so it describes a *different*
configuration from the one the repo commits. A clean `/tmp` result is not
evidence the target's own gate passes — for two independent reasons now.

**4. `ansible-lint` writes `ansible.log` with no flag at all.** The brief
guarded against `--generate-ignore`; the real write needs nothing. Proven by
mtime: scratch log `2026-09-17 00:26`, SIGMA's own still `2026-09-12 16:15`.
**The copy-not-in-place decision, vindicated by evidence rather than
caution.**

**5. The custom-rule probe needed four runs to answer honestly, and the first
answer would have been wrong.** Run 1 was **silent at exit 0** — which alone
reads as "custom rules do not work" and would have forced the guard to
`pre-commit` for no reason. `-L` showed the rule **loaded** (53→54 rules) and
`-c /dev/null` showed it **firing**, isolating the real cause: **`profile:
production` filters rules not named in `enable_list`.** With the repo's own
config plus an opt-in it fires on both playbooks. `enable_list:` in
`.ansible-lint` works with **no CLI flag**, so the guard can be wired
declaratively.

**The probe was deliberately written to fire on every play** so that silence
could not be mistaken for success. A true no-op probe would have been
unfalsifiable — lesson 8 inside a probe. **Two failure modes can look
identical in a single run.**

**6. Hook interception works in BOTH clients — the opposite of the expected
answer — and the category is still declined.** Claude Code: **documented**
(`code.claude.com/docs/en/hooks`, fetched 2026-09-16) — MCP tools appear as
regular tools in `PreToolUse`, which *"Can block it"*. OpenCode: **observed
live**, because its docs show the hook blocking only the built-in `read` tool
and are silent on MCP tools, so the installed bundle was read and then
confirmed by probe.

**7. The deciding fact is that the identifier differs.**
`mcp__ansible__zen_of_ansible` (Claude Code) vs **`ansible_zen_of_ansible`**
(OpenCode, observed) — two languages, two blocking conventions, two config
surfaces. A portable guard cannot express that; the incompatibility reaches
**the string the guard must match**, which is deeper than the
two-implementations problem `ADR-0016` anticipated. **The expected answer was
reached by the opposite route**, and had the spike stopped at "can it
intercept?", it would have recommended a category.

**8. Three independent mechanisms in this sprint can each be installed and
inert.** (a) an `ansible-lint` custom rule outside the active profile —
loaded, listed, never evaluated, exit 0; (b) a Claude Code matcher missing its
`.*` — `mcp__ansible` matches **nothing** while looking correct, per the
vendor's own docs; (c) OpenCode under `experimental.codeMode` — MCP tools are
not registered individually, so per-tool hooks never fire. Each is this
repo's most-repeated defect reachable by one line of config. **This is the
sprint's most transferable finding**, and it is why `TASK-0031` now owes a
fires-proof.

**9. `ADR-0015`'s clause 1 is formally reversed, and the ordering that caught
it is worth defending.** The component it governs **already shipped** under an
Option 2 waiver, so this is a decision written after its subject. That is a
deviation — and had the ADR been ratified first, the symlink defect
(`install.sh:105`) would have been enshrined in an accepted decision instead
of caught during construction. The refutation is also **narrower than earlier
notes claimed**: `templates/` survives for **copy-out** artifacts holding no
estate facts; only fill-in-place dies.

**10. A recorded prescription was followed rather than rediscovered — rare in
this repo's record.** `CURRENT_STATE.md` said the open work was *"TASK-0027
first, then the body, then ratification"*. That is exactly the order taken.
Its warning that *"filling the sections in from the plan's prose is how it
reached this state"* also held and shaped how the bodies were written.

**11. Two stale-status sweeps were needed in files I had corrected hours
earlier.** The S6 sprint table still read `planned` for both spikes and
`proposed` (no body) for all three ADRs; `CURRENT_STATE.md` still said
`TASK-0027` "is still unrun" and ADR-0015 "is a skeleton". **The same
four-files-disagree class, in the same session that fixed it once.** Fixed in
place, with the superseded text struck rather than deleted.

## Validation

- `bash tests/validate.sh` → **`validate.sh: OK`**, run after each unit of
  work (7 times), and again via the pre-commit hook on both commits.
- `bash scripts/sync-registry.sh` → **no diff**. Correct for
  governance-and-decisions-only changes; confirmed, not assumed.
- **`SIGMA-infrastructure` untouched**, verified by `git status --short`
  (empty) before and after, `HEAD` `d4e2dd1`, `[ahead 42]` unchanged, and its
  `ansible.log` mtime still `2026-09-12 16:15:01`. `.env` (mode 600) never
  read or copied; `tools/` and both encrypted `vault.yml` files never copied;
  no vault plaintext read, printed or logged.
- **The OpenCode probe was reverted and the revert verified two ways**, per
  `release-check`'s rule that a command reporting success is not evidence of
  effect: the plugins directory is **absent again** (it did not exist before,
  so the directory I created was removed too), and the same tool re-invoked in
  a fresh session **succeeded** (*"Ansible is not Python."*) with the probe log
  **not growing**. `~/.claude/settings.json` was never modified — SHA-256
  `27dafb27…4358f97` before and after.
- Commits: `ce05bf7` (spikes), and the ADR-bodies commit recorded in the
  task files.

## Handover

**Remaining in S6: `TASK-0026`, `TASK-0031`, `TASK-0032`, ratification of the
three ADRs, and a checkpoint.**

**Ratification is the human's and is genuinely owed** — especially on
`ADR-0015`, whose clause 1 *reverses* a mechanism the plan approved, which is
substantive rather than a restatement.

**`TASK-0031`'s shape is now fully determined**, so it can start cold:
- A custom `ansible-lint` rule, wired via `enable_list:` in `.ansible-lint`.
- Written against the **installed** API — `create_matcherror(message=,
  filename=, data=)`, per `rules/complexity.py`. My first probe guessed a
  `lineno=` kwarg and was wrong; the API is stable enough to target but not
  guessable.
- **Seven** fixtures, and it must **ship a proof the rule fires**. Fixture 6
  (PVE host by bare hostname, `gather_facts: true`) is the only case that
  fails if the guard resolves no hostnames.
- A reference probe rule is left at `/tmp/opencode/customrules/noop_probe.py`
  as the working example of a rule that loads *and* fires.

**Two traps for the next session:**
- **The checkpoint is not `REVIEW-0009`** — S8 reserved that number. Take the
  next free one.
- **`ansible_navigator` is still enabled**, confirmed incidentally by
  `TASK-0028`. `TASK-0026` is the task that removes that exposure, and it has
  a re-confirmed human authorization to do so.
