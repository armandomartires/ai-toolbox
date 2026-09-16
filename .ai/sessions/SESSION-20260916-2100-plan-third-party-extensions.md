# SESSION-20260916-2100 — Plan sprint S8: three requested third-party "plugins"

- Date: 2026-09-16
- Agent/model: opencode (claude-opus-5)
- Objective: A human asked for three "plugins" — ponytail, omniroute,
  graphify — to be added to the toolbox and made cross-agent compatible if
  possible. Determine what they actually are, decide where each belongs,
  and write the full planning and documentation layer **without
  implementing anything** (explicit instruction).

- Context consulted:
  - `AGENTS.md` (scope, security, definition of done, ambiguity policy),
    `.ai/context/CURRENT_STATE.md`, `.ai/planning/ROADMAP.md`,
    `SPRINT-CURRENT.md` (S7), `BACKLOG.md`, `.ai/tasks/TODO.md`.
  - `ADR-0016` (hooks category, **declined**) — the governing precedent;
    its three plumbing claims **re-verified**, not cited. `ADR-0005`
    (two MCP shapes), `ADR-0004`, `ADR-0002`, `ADR-0009`, `ADR-0020`,
    `ADR-0008`.
  - `tests/validate.sh` (manifest checks, `.env.example` completeness,
    per-client wiring check, the `## Inputs`/`## Outputs / handover`
    contract), `tests/smoke-mcp.sh`, `scripts/sync-registry.sh`,
    `scripts/install.sh`, `docs/development/authoring-guide.md`.
  - Upstream, fetched not recalled: npm metadata for all five relevant
    packages; `DietrichGebert/ponytail` (README, tree,
    `ponytail-mcp/package.json`); `rhanka/graphify` (README **and**
    `src/cli.ts`, `src/serve.ts`); `opencode.ai/docs/plugins/`.
  - Live machine: `opencode 1.18.31`, `claude 2.1.246`,
    `~/.config/opencode/opencode.jsonc`, `~/.claude/plugins/`,
    `~/.claude/settings.json`.

- Tasks worked on: `ADR-0021` (new, proposed), `PLAN-0005` (new),
  `TASK-0048`…`TASK-0051` (new, all `planned`),
  `SPRINT-S8-third-party-agent-extensions.md` (new), `B-019`/`B-020`
  (raised), plus `TODO.md`, `ROADMAP.md` Phase 8, `CURRENT_STATE.md`.

- Decisions:
  - **No new component category** (`ADR-0021` clause 1). ADR-0016 declined
    a `hooks/` category; its reasoning extends to third-party extensions
    this repo *consumes*, and its plumbing findings still hold.
  - **Placement by what a thing is, not what its vendor calls it**
    (clause 2): published package + MCP transport → `mcp-servers/`;
    client-native only → `configs/`; environment-changing service →
    `docs/development/third-party-tools.md`.
  - **Nothing vendored, nothing auto-installed** (clauses 3, 4).
  - **omniroute out of the component layer** — human decision mid-session.
    Recorded with the technical reason, not just the instruction.
  - **The spike runs first.** Everything known is vendor documentation, and
    two such documents already contradict their own source.

- Commands and validations:
  - `bash tests/validate.sh` → `validate.sh: OK`, exit 0. Run after the
    artifacts were written; `.ai/` files are covered by the handover
    contract check (`:820-893`), which is what could have failed here.
  - `scripts/sync-registry.sh` **deliberately not run** — no component
    changed. Running it would have produced a no-op diff implying otherwise.
  - Verification of ADR-0016's plumbing claims: `sync-registry.sh:120-132`
    (four `emit_section` calls), `validate.sh:21,122,205,412` (four
    hardcoded roots), `install.sh:50` (four-column `CLIENTS`).
  - `curl` against `registry.npmjs.org` for `@dietrichgebert/ponytail`
    (4.10.0), `@sentropic/graphify` (0.18.0), `omniroute` (3.8.50),
    `@omniroute/opencode-plugin` (0.2.1), `ponytail-mcp` (**404**).

- Problems:
  - **The request's central word was the wrong abstraction.** "Plugin"
    named three unrelated mechanisms. Building a `plugins/` category would
    have grouped three items sharing only a name, each still needing a
    different per-client mechanism.
  - **graphify's README contradicts graphify's source about OpenCode.** The
    README lists OpenCode among platforms with no hook point that fall back
    to `AGENTS.md`; `src/cli.ts` defines
    `OPENCODE_PLUGIN_ENTRY = ".opencode/plugins/graphify.js"` with a
    bash-hooking plugin template. Recorded as unresolved and assigned to
    `TASK-0048` rather than settled by picking the more convincing document.
  - **`graphify serve` cannot start without a graph, which breaks this
    repo's own smoke test.** `src/serve.ts:188-195` →
    `validateGraphFilePath`, then `console.error` + `process.exit(1)`;
    `:896-897` defaults the path. `smoke-mcp.sh` would report **FAIL**
    where the truth is *precondition unmet* → **SKIP** — the mirror of the
    defect its own header guards against. Raised as **B-020**, because it
    is latent for any future server with a state precondition, not just
    graphify.
  - **ponytail's portable option exists but is unpublished.** Upstream's
    `ponytail-mcp/` would have fit ADR-0005's external shape exactly, but
    it is `"private": true` and returns 404 on npm — so there is no
    `launch.command` and the shape's premise fails. This is why ponytail is
    documentation rather than a component, and the reason is re-checkable
    in one command.
  - **S7 is not closed.** All six of its tasks are `done`, but
    `REVIEW-0008` does not exist. Rather than promote S8 to
    `SPRINT-CURRENT.md` — which would silently close a sprint without its
    checkpoint — S8's sprint file was placed in `planning/sprints/` with
    the deviation recorded in its own header, and the closure question
    escalated to the human (`PLAN-0005`, item 3).
  - **Two of three deliverables will be prose**, the fourth instance of a
    class this repo has already diagnosed three times. Stated up front in the
    plan, the sprint file and the roadmap, with a pre-committed review question
    rather than a hope.
  - **I corrupted `CURRENT_STATE.md` while prepending to it, and the gate
    could not see it.** The edit anchored on the file's opening lines, and
    its replacement swallowed the trailing fragment *"Before that,
    TASK-0046 ran S7's"* into a **duplicated** `## The third client is
    Bionic…` heading — producing one heading with a sentence fragment
    appended and an orphaned paragraph beneath it. `validate.sh` passed
    both before and after, because nothing checks `.ai/context/` prose
    structure. Found by reading the diff at commit time, which is the only
    reason it was found at all. Repaired by giving the orphaned paragraph
    its own accurate heading (`## S7's pilot ran, and both loops were
    exercised`) and re-dating its opening sentence, then verifying by
    listing every `## ` heading in the file to confirm no duplicate
    remained. **Two transferable points:** a prepend to a long narrative
    file is a splice with two ends, and only one of them is visible in the
    edit; and the pre-commit diff review is load-bearing here rather than
    ceremonial — it is the *only* control over this file's integrity.
  - **`BACKLOG.md` briefly stated its own total twice, with two different
    numbers.** The first draft appended a "**Ten** items are open" line
    while leaving the existing "**Eight** items are open" paragraph standing
    directly beneath it — hedging the contradiction with *"the count below
    predates S8 and is superseded by this line"*. That is the stale-count
    drift class `CURRENT_STATE.md` already records five instances of,
    committed **in the act of adding items to the file that tracks it**.
    Also found by reading the diff, not by any check. Fixed by merging the
    two into one correct paragraph, updating "out of fourteen" → "out of
    twenty", and correcting a second stale denominator at `:57` ("three of
    eighteen" → "three of twenty", plus B-019 as a fourth false-premise item
    of a new kind: its premise was a *word*, not a claim about a file).
    **The rule extracted, and written into the file itself: correct a count
    in place; never stack a correction on top of a stale claim.**
    Annotating a superseded number leaves two owners of one fact, which is
    what AGENTS.md's one-owner rule exists to prevent.

- Commit/push: **`75f8984`** — "Plan sprint S8: third-party extensions are
  wired, not vendored". 13 files, all under `.ai/`, +2124/-10. Pre-commit
  hook ran `validate.sh` → OK. **Pushed to `origin/master` and confirmed by
  re-fetch**: `origin/master` and `HEAD` both at
  `75f898466848770e7451a4880affa56c0227e73b`; working tree clean;
  `git remote -v` verified token-free (the token was supplied through a
  one-shot credential helper, never written to a tracked file or the remote
  URL).

  Note: the push carried **two** commits, because `fd23f6a` ("Close the
  decidable subset of the false-structural-claim class") was already
  committed-but-unpushed when this session began. It is prior work, not
  this session's — recorded here so the remote's two-commit advance is
  explicable rather than looking like this commit was split.

- Next action: Human to (a) ratify or reject `ADR-0021` after `TASK-0048`
  reports, (b) decide whether S7 closes with `REVIEW-0008` before S8
  begins, and (c) authorize any `tests/smoke-mcp.sh` change if `TASK-0049`
  needs one. Then run `TASK-0048` — the spike — first; it is the task that
  decides whether the rest of the sprint describes reality.
