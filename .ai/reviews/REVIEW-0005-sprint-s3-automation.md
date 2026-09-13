# REVIEW-0005 — Sprint S3 (Automation) end-of-sprint checkpoint

- Task(s) reviewed: TASK-0011, TASK-0010; ADR-0007
- Reviewer: agent (opencode), 2026-09-13
- Diff summary: `72f8401..HEAD` — 2 tasks, 1 ADR. The registry generator
  went from three duplicated loops to one; `tests/validate.sh` gained two
  independent checks and now runs automatically before every commit via a
  tracked hook. Phase 3 closes.

## Sprint objective vs. outcome

Objective: "make `tests/validate.sh` run automatically before every commit,
and remove the structural cause of the template-leak defect that had to be
fixed three times."

| Success criterion | Result |
|---|---|
| One iteration path per component kind in `sync-registry.sh` | pass |
| `validate.sh` fails if any registry row points at a `_template*` path | pass |
| Tracked `.githooks/pre-commit` blocks a failing commit; `install.sh` activates it | pass |
| Bypass documented, not hidden | pass — printed in the failure message itself |
| `validate.sh` stays hermetic, sub-second; smoke test never in the hook | pass — 266–283 ms, offline |
| Every new check observed failing for its own reason | pass, and this is where the sprint's value was |

All six met. Phase 3's exit criterion — as restated by ADR-0007 — is met.

## Findings

### The sprint's real output was three caught defects, not two features
Every one was found by the fails-when-broken discipline, none by the happy
path. Two were in code written *this sprint*, minutes earlier:

1. **`chmod +x` never reached git's index.** `core.filemode=false` on this
   `/mnt/c` checkout, so the hook staged as mode `100644`. Git silently
   ignores a non-executable hook — the gate would have been **dead on
   arrival** for anyone cloning onto a filesystem that honours the bit,
   while appearing to work here.
2. **The first hook check was unfalsifiable.** Guarded with
   `[ -d .githooks ]` for leniency; the effect was that deleting the hook
   made the check *pass*. A check that cannot detect its own failure case
   is worse than no check, because it manufactures false confidence.
3. **The first hook check tested the wrong property.** `[ -x ]` can never
   fail on a 9p mount where every file is `rwxrwxrwx` and `chmod -x` is
   ignored. It now inspects the mode git *records*, which is both testable
   and the thing that actually disables a hook.

The pattern connecting all three: **the environment lied about the property
being checked.** The filesystem reports permissions it does not enforce;
git records permissions the filesystem does not reflect. Checking the
convenient property (`[ -x ]`, "directory exists") rather than the
authoritative one (git's index) produced checks that passed for the wrong
reasons.

### The proof harness was itself wrong, and that is worth recording
The first hook proof began with `git stash -u`, which stashed the
then-untracked hook and silently disarmed every case. A commit that should
have been refused went through — which read as a hook failure but was a
test failure. Rewritten to require a clean tree and run post-commit.

Recorded deliberately, because "the test was broken, the code is fine" is
the most tempting thing to fix quietly. It is also the second time this
project has been saved by distrusting a green result: REVIEW-0004 named
"a script reporting success is not evidence the effect happened", and here
a *failing* result was equally untrustworthy in the other direction.

### Sequencing was chosen, not inherited
TASK-0011 ran before TASK-0010 despite the numbering, so the new commit
gate's first duty was guarding an already-corrected generator. Reversed,
the hook would have been switched on over a known-open defect class.

### The de-duplication was proven, not assumed
Two independent gates: the regenerated registry was **byte-identical**
(md5 `cad2d150…`), proving output-neutrality; and disabling the *single*
remaining template-skip line leaked **four** rows across **all three**
sections at once, proving the duplication was genuinely gone. The checksum
alone would have shown only that nothing changed — not that the structure
improved.

### On ADR-0007's honesty about CI
The CI workflow ships labelled **unverified**, because no remote exists to
run it. That is the same treatment given to LM Studio's wiring snippet in
TASK-0006. Worth noting the alternative was available and rejected: writing
no CI file at all (ADR-0005's "don't build for a shape with no instance").
The distinction drawn — declarative config is dormant when unexercised,
whereas untested *code* is wrong by default — is defensible but is a
judgement call, not a deduction. If the workflow turns out broken when a
remote appears, that judgement was wrong and should be recorded as such.

## Validation results
- `bash tests/validate.sh` → OK, 266–283 ms, offline.
- Hook: `core.hooksPath=.githooks`, mode `100755`, blocks a failing commit
  with HEAD unmoved, `--no-verify` bypasses, valid commit passes through.
- Registry: byte-identical after refactor; single-skip disablement leaks
  all three sections; template-row check catches an injected row without
  false-positiving on "template" in a description.
- `bash tests/smoke-mcp.sh --server ansible` → still PASS.
- `bash scripts/install.sh link` twice → idempotent.
- `git status` clean; no scratch branch or junk commit survived.

## Verdict
**approve.** Phase 3 closes. Three phases complete; no phase currently in
progress.

## Follow-up tasks
1. **Decide B-002's fate.** The skill linter has been "ready" for three
   sprints without being scoped. Either write a brief or drop it from the
   backlog — leaving it perpetually ready is a slow lie about intent.
2. **The authored (Python) MCP server shape has still never run.** Only
   `mcp-servers/_template/` uses it and `smoke-mcp.sh` handles external
   manifests only. Not a defect (ADR-0005 deliberately avoided building
   for absent shapes) but half the MCP convention remains unexercised.
3. **If a remote is ever added**, verify `.github/workflows/validate.yml`
   actually runs and remove its unverified label — or fix it and record
   that the ADR-0007 judgement was wrong.
4. **LM Studio UI verification** — unchanged; needs a human at the GUI.
5. **Consider whether `install.sh` should warn when `core.filemode=false`**
   and a tracked hook's git mode is not `100755`. `validate.sh` catches it
   now, but the person most likely to hit it is someone cloning fresh onto
   Windows, and `install.sh` is what they run first.
