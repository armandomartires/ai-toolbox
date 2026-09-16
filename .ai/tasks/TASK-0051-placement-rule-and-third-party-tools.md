# TASK-0051 — The placement rule in the authoring guide, and omniroute as a documented non-component

## Objective

Two things, both about making this sprint's reasoning findable by the next
author rather than only recorded in an ADR:

1. Put `ADR-0021`'s placement rule into
   `docs/development/authoring-guide.md`, so someone adding a fourth
   third-party extension routes it correctly without rediscovering the
   argument.
2. Create `docs/development/third-party-tools.md` — the home for tools that
   improve the workflow but are deliberately **not** components. Its first
   entry is **omniroute**.

## Minimal context

### Why the rule must leave the ADR

An ADR records *why a decision was made*; the authoring guide is the
normative *what is*. `AGENTS.md`'s one-owner-per-fact table is explicit
about that split, and the global convention states it as
**`.ai/` holds why; `AGENTS.md` + `docs/` hold what is**.

`ADR-0021` clause 2 is a routing rule an author will need at the moment
they add something — which is when they are reading the authoring guide,
not the decisions directory. Leaving it only in `.ai/` is how the
`plugins/` question gets re-raised. ADR-0016's own Decision text asks for
exactly this: record the reasoning *"so the next reader does not re-raise
it."*

This is a **link, not a copy**. The guide states the rule and points at
`ADR-0021` for the evidence; it must not restate the evidence, or the two
files become rival owners of it. `loops/release-check/loop.md` is the
worked example of that discipline in this repo.

### Why omniroute needs a document rather than nothing

Human decision, 2026-09-16: omniroute stays out of the component layer and
is documented only as an optional third-party tool a user may want to
install.

Writing it down beats dropping it, for two reasons:

- **It was asked for.** A request that is scoped out and left unwritten
  looks like an oversight to the next reader, and gets re-raised. B-005 and
  B-014 are this repo's evidence that an item's *stated reason* matters as
  much as its status.
- **It carries a real caveat worth capturing once.** Its OpenCode plugin's
  `mcpAutoEmit` option **writes an `mcp.*` entry into the client config** —
  a mutation this repo forbids itself, since agent emission writes role
  files only and never touches `opencode.jsonc`. A user who enables it
  should know it edits their config.

### The guide has a house style this must match

`docs/development/authoring-guide.md` uses **Gated** columns marking which
rows `tests/validate.sh` actually enforces. That convention exists because
two of its section preambles previously claimed the gate enforced
everything below, and both claims were false — the same defect class
TASK-0046 found twelve times in `skills/ansible-ops/`: *a claim an artifact
makes about its own structure that the artifact falsifies*.

So the new section must be honest about enforcement, and the honest answer
is blunt: **nothing in `validate.sh` checks the placement rule.** Routing a
third-party extension is a judgment call, exactly like the guide's
"convention only" rows. Say so, or add the thirteenth instance of this
repo's most-repeated defect to the very guide that documents it.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `ADR-0021` | this sprint | ratified (strongly preferred — the guide is normative, so it should not document a `Proposed` rule as settled). If still `Proposed`, label it so in the guide |
| `TASK-0049` execution log | TASK-0049 | **done**; records where graphify landed and whether it also needed a `configs/` section |
| `TASK-0050` execution log | TASK-0050 | **done**; records ponytail's three client sections and any surprise |
| `docs/development/authoring-guide.md` | TASK-0005, 0037 et al. | 369 lines; four component sections; **Gated** column convention in use |
| `mcp-servers/graphify/server.json` | TASK-0049 | present; the worked example the rule's first row points at |
| `configs/*/README.md` | TASK-0050 | all three carry ponytail sections; the second row's worked example |
| `AGENTS.md` | pre-existing | its one-owner-per-fact rule and its `docs/` pointers — check whether a new `docs/development/` file needs referencing there |
| upstream omniroute metadata | third party | re-checked at execution time; `3.8.50` and `@omniroute/opencode-plugin` `0.2.1` at plan time, 2026-09-16 |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- A new authoring-guide section stating the placement rule as a table
  (published package + MCP transport → `mcp-servers/`; client-native only →
  `configs/`; environment-changing service → `third-party-tools.md`), with
  a **Gated** marking that is truthful — i.e. *no*, nothing checks it.
- A pointer from that section to `ADR-0021` for the reasoning, and to the
  two worked examples this sprint produced.
- An explicit statement that the rows are **not mutually exclusive** if
  `TASK-0049` found graphify needed both a manifest and a `configs/`
  section — `ADR-0021`'s Consequences predicted this specific outcome.
- `docs/development/third-party-tools.md`, new, with: what the file is for,
  the criterion for being listed here rather than becoming a component, and
  the omniroute entry.
- The omniroute entry covering: what it is (a local gateway service, an
  OpenAI-compatible endpoint on `:20128`), how each client would use it
  (OpenCode plugin; Claude Code base-URL redirection, **not** a plugin),
  its prerequisites (a running daemon, an API key), the `mcpAutoEmit`
  config-mutation caveat, and that this repo neither installs nor tests it.
- Checking whether `AGENTS.md`'s structure line should mention the new
  `docs/development/` file, and updating it if so.

### Not included

- Installing, running or testing omniroute. It is out of scope by human
  decision; the document is written from vendor documentation and labelled
  as such.
- `mcp-servers/omniroute/` or any `configs/*` omniroute wiring section. The
  point of the decision is that it gets neither.
- Any change to `validate.sh` to enforce the placement rule. It is a
  judgment call; a check that cannot really decide it would be a check that
  cannot fail.
- Re-litigating `ADR-0021`. If the rule looks wrong while documenting it,
  **escalate** rather than editing the guide to disagree with the decision.
  TASK-0037's precedent is the reverse case, where a brief contradicted an
  ADR and the ADR won on evidence.

## Likely files

Forecast, written before the work:

- `docs/development/authoring-guide.md` (new section)
- `docs/development/third-party-tools.md` (new)
- `AGENTS.md` (only if the structure/docs pointer needs it)
- `.ai/tasks/TASK-0051-*.md`, `.ai/sessions/*`, `.ai/context/CURRENT_STATE.md`

No component, script or registry change is expected.

## Execution plan

1. Read `TASK-0049`'s and `TASK-0050`'s logs. The guide documents what
   *happened*, so any deviation from `ADR-0021`'s table must be reflected
   in the rule rather than hidden by it.
2. Re-check omniroute's published version and its OpenCode plugin's
   version and options. Anything unverifiable is labelled vendor-doc.
3. Write the authoring-guide section, matching house style: a table, a
   truthful **Gated** column, a link to `ADR-0021`, and the two worked
   examples. Keep the reasoning *out* — link to it.
4. Write `docs/development/third-party-tools.md`: purpose, inclusion
   criterion, then omniroute.
5. Grep the new text for any claim about what `validate.sh` enforces, and
   verify each one against the script. This is the class that has produced
   twelve-plus instances in this repo; the guide is where it keeps
   recurring.
6. Grep for any statement implying this repo installs or supports
   omniroute, and remove it.
7. Run `tests/validate.sh`.

## Acceptance criteria

- [ ] The authoring guide carries the placement rule, as a table, in the
      established house style.
- [ ] Its **Gated** marking is truthful: nothing in `validate.sh` checks
      placement, and the section says so.
- [ ] The section **links** to `ADR-0021` rather than restating its
      evidence — no second owner of the reasoning.
- [ ] Both worked examples (graphify's manifest, ponytail's `configs/`
      sections) are named, so the rule is concrete.
- [ ] If graphify occupies two rows, the non-exclusivity is stated.
- [ ] `docs/development/third-party-tools.md` exists, states its purpose
      and inclusion criterion, and documents omniroute.
- [ ] The omniroute entry states: per-client mechanism (including that
      Claude Code's is *not* a plugin), prerequisites, the `mcpAutoEmit`
      config-mutation caveat, and that this repo neither installs nor tests
      it.
- [ ] Every claim about omniroute is labelled vendor-doc with a date, since
      none is observed.
- [ ] Every claim the new text makes about `validate.sh` was checked
      against the script.
- [ ] No `mcp-servers/omniroute/`, no omniroute `configs/` section, no
      registry row.
- [ ] `tests/validate.sh` passes.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh — **expected not required**; documentation
      only, no component change.

## Risks and rollback

- **Adding a false enforcement claim to the guide that documents that
  defect class.** The single most likely error here, and the most
  embarrassing. Mitigation: step 5's grep-and-verify, against the script
  rather than from memory.
- **Copying the ADR's reasoning into the guide**, creating two owners that
  drift. Mitigation: link only; the guide states the rule, `ADR-0021`
  states why.
- **Documenting a `Proposed` decision as settled.** If ratification has
  not happened, the guide must label the rule's status rather than imply
  consensus. ADR-0019's precedent: a decision whose basis changes must
  show it.
- **`third-party-tools.md` becoming a dumping ground.** Without an
  inclusion criterion it accumulates links. Mitigation: state the criterion
  in the file's own preamble, so the next addition has a test to pass.
- **omniroute's documentation decaying fastest of anything in this
  sprint**, because nothing here is observed and it is a fast-moving
  project (`3.8.50`). Mitigation: date every claim and label it vendor-doc.
- Rollback: revert both files (and `AGENTS.md` if touched). No component or
  machine state is involved.

## Outputs / handover

*Intended* end state — this task has not run.

| Artifact | End state |
|----------|-----------|
| `docs/development/authoring-guide.md` | New placement-rule section: table, truthful **Gated** marking (nothing enforces it), link to `ADR-0021`, both worked examples named |
| `docs/development/third-party-tools.md` | New; purpose, inclusion criterion, omniroute entry with per-client mechanisms, prerequisites and the `mcpAutoEmit` caveat, all labelled vendor-doc with dates |
| `AGENTS.md` | Structure/docs pointer updated **only if** needed; otherwise deliberately unchanged |
| `mcp-servers/`, `configs/`, `docs/registry.md` | **Deliberately unchanged** — omniroute gets no manifest, no wiring snippet, no registry row, which is the decision itself |

**Next task starts here**: `REVIEW-0009` picks up from a complete sprint —
one manifest, three wiring sections, one placement rule, one documented
non-component — and answers its pre-committed question: *did the spike
change anything, or did it rubber-stamp the vendor READMEs?* Record any
deviation from this plan here.

## Status

- Status: planned
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-16

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
