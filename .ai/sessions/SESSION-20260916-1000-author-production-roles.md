# SESSION-20260916-1000 — Author the production roles; fix two emitter defects

- Date: 2026-09-15
- Agent: opencode (claude-opus-5)
- Objective: TASK-0045 — author `qa-test`, `review` and `git-ops` in
  `agents/` under ADR-0018, using the `agent-tiers` copies as read-only
  reference.
- Entry state: clean tree at `659b52a`. Phases 1–3 complete; both loops
  authored; three design roles emitted; neither loop executable.

## What was authored

`agents/qa-test/`, `agents/review/`, `agents/git-ops/` — **all three
OpenCode-only**, because each needs a command allowlist or a path-scoped
edit and neither has a per-agent Claude Code expression. `install.sh`
**skips** them there with exit 0 (a clean skip, since their `clients` list
says so) rather than refusing. Nine emitted files now exist across two
clients; the registry carries six roles.

## The defect that mattered, and it was mine

Merging `git-ops`' three bash-related terms (`bash-allowlist`,
`no-force-push`, `push-requires-confirmation`) into one `bash` map and
sorting the globs **alphabetically** produced:

```
"*": deny → "git *": allow → "git filter-branch*": deny →
"git push --force*": deny → "git push -f*": deny → "git push*": ask → …
```

OpenCode resolves **last match wins**. So `git push --force origin main`
matched `git *` (allow), then `git push --force*` (deny), then **`git push*`
(ask)** — resolving to **ask, not deny**, in the one role whose entire reason
to exist is that it cannot force-push.

Fixed by sorting **shorter patterns first** — a longer pattern is the more
specific rule and must come later to win. Verified by resolving seven
commands against the emitted order: force-push and `-f` → deny, plain push →
ask, `rm -rf /` → deny.

A second defect from the same review: **`no-force-push` omitted
`git clean -f*`**, which matched `git *` → allow, so the emitted role could
delete untracked files irrecoverably. Added, with
`git push --force-with-lease*`.

**Both are TASK-0040's defects and are recorded there as amendment 2**, not
patched silently from here — which is what TASK-0045's brief requires of a
Phase 2 finding. Its original log's `"*"`-first claim remains true; what was
never proved was ordering *among* the specific patterns.

## The method worth reusing

Both defects were found by **extracting every `key=action` fact from the
emitted file and from the reference, then set-differencing them**. Reading
the emitted file and judging it plausible would have passed both — which is
precisely the failure ADR-0018 warns about ("a plausible agent file with
wrong permissions").

The diff also surfaced two *intended* differences, confirming the method
distinguishes weakening from tightening: `qa-test`'s bash default is
**stricter** than the reference (`deny` vs `ask`), and `websearch: deny` is
an addition the reference predates.

## A third gap, found before authoring

**`bash-allowlist` could not name the commands it permits** — it emitted
`bash: {"*": "ask"}` where all three roles **deny** everything unnamed. For
`git-ops` that means a human could approve `rm -rf` at a prompt the role was
designed never to reach, and the guide's own definition ("May run only named
commands") promised more than the emitter delivered.

Same shape as TASK-0043's `delegation-allowlist` gap, so the human's ruling
there was **followed rather than re-escalated**: parameterise the term
(`bash_allow`) as amendments to TASK-0037 → 0038 → 0040, in ADR-0008's
order. The vocabulary now has two parameterised terms and **both deny by
default**, recorded in the guide as the rule for any future one.

## Two scope questions

- **Ownership: none of the brief's three options applied.** All three
  ("removed, reduced to pointers, or retained") assume the skill is in this
  repo; ADR-0017's rejection means it is not. So `agents/<role>/agent.md` is
  the sole definition here, and `install-tiers.ps1` cannot break because
  nothing here touches it. The two-owners question **moved outward** and is
  documented rather than fixed: `git-ops` will exist twice on this machine,
  project-local via `/bmad` and global via `install.sh`, and OpenCode
  resolves **project over global**. Written into both client snapshots,
  because a reader who finds two files needs it there.
- **`shell-runner` not authored.** No step in `loops/project-build/`
  references it, and `bmad-workflow.md` says `build` never invokes it
  directly. Same reasoning that declined `design-doc-writer`. **Role count
  six.**

## Also recorded

**`write` is not an OpenCode permission key.** Found while proving `review`
read-only: the resolver applied `edit: deny` but not `write`. The live table
documents **15** keys, and `edit` gates `write`/`edit`/`apply_patch`. Kept
anyway — inert, accepted, kept by the resolver, defence in depth against a
key rename — with **`edit: deny` noted in the emitter as the operative
rule**, so nobody removes the wrong line.

## Validation

- `bash tests/validate.sh` → PASS on six real roles, after every edit
- `bash scripts/sync-registry.sh` → six roles indexed
- `bash scripts/install.sh` → exit 0; 9 emitted, 3 skipped, 0 refused
- Emitted-vs-reference fact diff → **nothing missing** for any role
- Resolver proof: `qa-test`'s seven edit globs and `review`'s five denies
- Three new gate rules **each observed failing**
- `opencode.jsonc` untouched (mtime 2026-08-24, no `agent` key);
  `opencode-customization` clean at `f9f5e37`

## Exit state

**Phases 1–4 complete. Only TASK-0046's pilot remains.** Two loops, six
roles, a component category defined/enforced/indexed/deployable — and
**nothing has been run**. Both loops are executable for the first time.

That is exactly the state REVIEW-0008's pre-committed question was written
for: *did anything get exercised?* Everything is in place; none of it is
evidence yet.

- Result: TASK-0045 done, with amendments to TASK-0037/0038/0040. Commit
  `4fc1f12`, pushed to `origin/master` and confirmed by re-fetch.
