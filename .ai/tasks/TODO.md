# TODO

Sprint membership, one line per item. Details live in each brief and in
`.ai/planning/sprints/`; earlier prose is in git history (ADR-0033).

- [x] TASK-0001 — Port and harmonize the project-migration skill
- [x] TASK-0002 — Extend the skill frontmatter schema (license, metadata)
- [x] TASK-0003 — Harmonize the project-workflow skill
- [x] TASK-0004 — Allow external (Node/npm) MCP servers alongside authored Python ones
- [x] TASK-0005 — External MCP server shape: manifest, scripts, validation
- [x] TASK-0007 — Port the ansible MCP server (first external server)
- [x] TASK-0006 — Client config snapshots and multi-client skill deployment

## Sprint S2 — Multi-client hardening

- [x] TASK-0008 — Author the first loop component (`release-check`)
- [x] TASK-0009 — MCP server smoke-test harness

## Sprint S3 — Automation

- [x] TASK-0011 — De-duplicate the registry generator; assert no template rows
- [x] TASK-0010 — Pre-commit hook running validate.sh; optional CI workflow

## Sprint S4 — Closing the open loops

- [x] TASK-0012 — Skill linter (frontmatter rules only)
- [x] TASK-0013 — Add a repo LICENSE backing the skills' `license: MIT` claims
- [x] TASK-0014 — `install.sh` warns on the `core.filemode=false` hook trap
- [x] TASK-0015 — Document required environment variables; wire the git remote
- [x] TASK-0016 — Close the human-action gaps: procedures, not candidate bullets

## Post-S4 (no sprint open)

- [x] TASK-0017 — Record the LM Studio UI verification; fix the WORKSPACE_ROOT placeholder trap
- [x] TASK-0018 — Close B-001; fix the registry content defects found while scoping it
- [x] TASK-0019 — Retract the false default-branch mismatch claim

## Sprint S5 — Session handover contract (open)

- [x] TASK-0020 — Skill: add the session-handover reference; restore the conventions budget
- [x] TASK-0021 — Skill: task-template handover contract; version 3.1.0
- [x] TASK-0022 — Adopt the handover contract in this repo's task template
- [x] TASK-0023 — validate.sh: detect missing or empty handover sections

## Post-S5 (no sprint open)

- [x] TASK-0024 — Unify `.ai/decisions/` filenames on the `NNNN-*` scheme
- [x] TASK-0025 — Close B-009: the two skills scaffold different frameworks, by design

## Sprint S6 — Ansible agent guardrails (CLOSED 2026-09-22 by REVIEW-0010)

- [x] TASK-0026 — Correct the ansible MCP blast-radius claim and disable `ansible_navigator`
- [x] TASK-0027 — Spike: lint two real playbooks and choose the guard's home
- [x] TASK-0028 — Spike: can a client hook intercept an MCP tool call?
- [x] ADR-0014 — Accept the pinned ansible MCP surface; narrow it rather than extend it
- [x] ADR-0015 — Ansible knowledge is derived per change, not declared; and the graduated workflow is check-plus-snapshot
- [x] ADR-0016 — Hooks as a component category: declined, because the clients disagree on the tool's name
- [x] TASK-0029 — Author the `ansible-ops` skill
- [x] TASK-0030 — Author the `ansible-change` loop
- [x] TASK-0031 — The `gather_subset` / `ansible_mounts` guard
- [x] TASK-0032 — Record the target-repo findings and what was deliberately left alone
- [x] TASK-0052 — Un-park sprint S6, re-queue S8, and correct four defects in S6's own plan
- [x] TASK-0053 — Correct the Bionic client snapshot's drifted observations
- [x] TASK-0054 — Ratify ADR-0014/0015/0016, close S6, promote S8

## Sprint S7 — Design and production agent loops (open)

- [x] TASK-0033 — Park sprint S6, open sprint S7, and repair two roadmap omissions
- [x] TASK-0034 — Spike: inventory the agent-tiers drift and decide what survives
- [x] ADR-0017 — agent-tiers stays with opencode-customization (claim withdrawn)
- [x] TASK-0035 — Import agent-tiers into this repo as its canonical home
- [x] TASK-0036 — Spike: verify the per-client agent schema mapping against live docs
- [x] ADR-0018 — Agent portability is scoped per capability; one source, per-client emission
- [x] TASK-0037 — agents/_template/ and the normative agent schema
- [x] TASK-0038 — validate.sh: enforce the agent schema, proven by failing fixtures
- [x] TASK-0039 — sync-registry.sh: emit an Agents section
- [x] TASK-0040 — install.sh: emit per-client agent files
- [x] ADR-0019 — Design convergence is human acceptance; autonomy stops at the merge gate
- [x] TASK-0041 — Author the design-brief loop
- [x] TASK-0042 — Author the design-flow skill
- [x] TASK-0043 — Author the four design-stage roles
- [x] TASK-0044 — Author the project-build loop
- [x] TASK-0045 — Author the three production roles in agents/
- [x] TASK-0046 — Pilot: run both loops end to end to produce ansible-ops and ansible-change
- [x] TASK-0047 — The LM Studio client is Bionic; correct the skills and agents findings

## Sprint S8 — Third-party agent extensions (RE-QUEUED 2026-09-16, not started)

- [x] TASK-0048 — Spike: verify ponytail's and graphify's real integration surfaces
- [x] TASK-0049 — graphify as a pinned external MCP server
- [x] TASK-0050 — ponytail as per-client wiring documentation
- [x] TASK-0051 — The placement rule in the authoring guide, and omniroute as a documented non-component
- [x] REVIEW-0009 — Sprint S8, Third-party agent extensions
- [x] TASK-0068 — Ratify ADR-0021 and close sprint S8

## Post-S8 (no sprint open)

- [x] TASK-0069 — Sweep stale second-hand claims: the gate's cost and the drifted Ansible toolchain
- [x] TASK-0070 — One worktree per agent session, and the exec bits that make a worktree work
- [x] TASK-0071 — A `test-allowlist` capability term, so `qa-test` can run what it claims to run
- [x] TASK-0072 — Deploy skills to Bionic's project target, and leave its global target alone
- [x] TASK-0073 — When an MCP server owes a per-client wiring section, and when it does not

## Sprint S9 — Unattended runs (OPEN — promoted 2026-09-23)

- [x] TASK-0055 — Spike: can OpenCode host an unattended driver, and can its permissions hold it?
- [x] TASK-0056 — Spike: what can Claude Code enforce per agent, and is a dead delegate silent?
- [x] TASK-0057 — Author ADR-0022 from the spike evidence, and leave it proposed
- [x] GATE — human ratification of `ADR-0022`, cleared 2026-09-23
- [x] TASK-0077 — Promote sprint S9, and add Phase 9 in the same change
- [x] TASK-0058 — Settle `worktree-only` for Claude Code, add the delegation rule, and verify the authored-MCP section
- [x] TASK-0060 — Show a role's client coverage in the registry
- [x] TASK-0061 — Author `loops/unattended-run/loop.md`
- [x] TASK-0059 — Enforce the delegation rule, and close the authored-MCP validation gap
- [x] TASK-0062 — Author `skills/unattended-ops/`
- [x] TASK-0063 — Author the four thinking roles
- [x] TASK-0064 — Author the five acting roles, and fix `git-ops`' staging gap
- [x] TASK-0078 — `no-bash`, so `read-only` means what it says
- [x] TASK-0079 — Narrow `git-ops` to the commands it actually needs
- [x] REVIEW-0011 — Sprint S9, unattended runs: the decision and the portable core
- [x] TASK-0080 — State the OpenCode-first asymmetry in all three wiring snapshots
- [x] TASK-0081 — Close sprint S9 on REVIEW-0011

## Sprint S10 — Bindings, the gate server, the pilot (CLOSED 2026-09-26 by REVIEW-0012)

- [x] TASK-0082 — Spike: does a trailing flag escape an OpenCode allow-glob?
- [x] TASK-0083 — Close the trailing-flag holes, split by what they actually are
- [x] TASK-0084 — Ratify ADR-0023
- [x] TASK-0085 — Promote sprint S10, and add Phase 10 in the same change
- [x] TASK-0086 — S10.1: the OpenCode driver and its binding
- [x] TASK-0087 — S10.2: the Claude Code Workflow binding
- [x] TASK-0088 — S10.3: `mcp-servers/gates/`, the first authored MCP server
- [x] TASK-0089 — One rule for who starts a gate, and who writes the evidence
- [x] S10.4 — the Bionic binding: established that Bionic cannot orchestrate
- [x] TASK-0090 — S10.5: install for both clients, verify the gates server in each, record it
- [x] TASK-0091 — Prune an emitted agent file when its role stops declaring that client
- [x] TASK-0092 — S10.7: the pilot — one unattended run of two tasks, dry run first
- [x] TASK-0093 — release-check step 8: record the hash in a follow-up commit, never amend
- [x] TASK-0094 — Refresh the stale opening paragraph of CURRENT_STATE.md
- [x] TASK-0095 — Roles read the paths the driver resolved; they never glob for them
- [x] TASK-0096 — The driver hands preflight the evidence of its own step-1 checks
- [x] TASK-0097 — The driver checks a closed commit's files against the declared paths
- [x] TASK-0098 — Keep every gate command outside the tree the roles can read
- [x] TASK-0099 — The closer writes fixed commit and push lines, and the driver checks them
- [x] TASK-0100 — Per-role timeouts, and a run that can be stopped cleanly
- [x] TASK-0101 — Run roles stop being told to read the skill at run time
- [x] TASK-0102 — Emit each role's allowed shell commands into its body, and draft the upstream report
- [x] TASK-0103 — The Claude Code binding checks a closed commit's files against the declared paths
- [x] S10.6 — registry and state (done — confirmed by REVIEW-0012)
- [x] REVIEW-0012 — Sprint S10, unattended runs: the bindings, the gate server, and the pilot
- [x] TASK-0104 — S10.4: establish that Bionic cannot orchestrate, or drop the claim
- [x] TASK-0105 — Close sprint S10 on REVIEW-0012 (S10.4 now discharged)

## Post-S10 (no sprint open)

- [x] TASK-0106 — B-035: embed the adjudicator's decision standard in its prompt
- [x] TASK-0107 — Settle `worktree-only`'s Claude Code emission (ADR-0018 clause 7)
- [x] TASK-0108 — Re-count the `ansible-core` version claims, then act on the count
- [x] TASK-0109 — Give artifact shape one owner, and generate the skeleton instead of copying a template
- [x] TASK-0110 — Migrate the repository onto the artifact schemas
- [x] TASK-0112 — The Claude Code binding's own consistency check fails, and no gate noticed
- [x] TASK-0118 — Repair four stale claims in the planning ledger
- [x] TASK-0111 — Can a worktree-isolated Claude Code subagent reach the main checkout by absolute path?
- [x] TASK-0113 — Run the Claude Code unattended binding against a real run, once
- [x] TASK-0114 — Test ADR-0022's two untested falsifiers, F7 and F9
- [x] TASK-0115 — Re-run ADR-0014's "53 rules / 0 violations" under ansible-core 2.21.4
- [x] TASK-0116 — Exercise skills/ansible-ops against the live estate, once
- [x] TASK-0117 — Make the artifact generator reachable from project-migration alone
- [x] TASK-0119 — Generate the scaffold's planning templates from the schemas that own them
- [x] TASK-0120 — Settle whether a migrated repository can regenerate its templates
- [x] TASK-0121 — The evidence line carries no figure, so the closer cannot copy one
- [x] TASK-0122 — An agile dashboard for the .ai governance layer
- [x] TASK-0123 — Publish the dashboard from CI to GitHub Pages
- [x] TASK-0124 — Tell someone when CI fails
- [x] TASK-0125 — Retire this repo's dashboard generator for the vendored canonical one
- [x] TASK-0126 — Make the intranet GitLab the primary remote
- [x] TASK-0127 — Ship GitHub Pages and GitLab Pages as optional dashboard destinations
- [x] TASK-0128 — Record why only CI builds the published dashboard
- [x] TASK-0129 — Rebuild the published dashboard daily from a separate dispatcher
- [x] TASK-0130 — Close the CI alert only when no watched workflow is red
- [x] TASK-0131 — Source secrets from the intranet Vault; keep the environment as the interface
- [x] TASK-0132 — Give ai-toolbox an AppRole identity; read several secret maps
- [x] TASK-0133 — Ignore every .env variant, not only .env (B-053)
- [x] TASK-0134 — The estate's ansible-vault password comes from Vault (B-052)
- [x] TASK-0135 — worktree.sh remove deletes a landed branch and reports honestly (B-049)
- [x] TASK-0136 — State that the resume guard must never search --all (B-045)
- [x] TASK-0137 — Name what loops/ansible-change needs from a Claude Code session (B-046)
- [x] TASK-0138 — Give role 5 a derived verdict for task-loading actions (B-050)
- [x] TASK-0139 — Make the generated banners true in every repository they reach (B-051)
- [x] TASK-0140 — Let the Claude Code binding be pointed at a repository (B-044)
- [x] TASK-0141 — Run both unattended-run binding suites in CI (B-037)
- [x] TASK-0142 — Gate that a closed backlog row names a closer that agrees (B-038)
- [x] TASK-0143 — Close B-025 as deferred until a second role wants the term
- [x] TASK-0144 — Report the estate's stale ansible.cfg claims to the estate (B-039)
- [x] TASK-0145 — Gate BACKLOG.md's open-item count against the rows (B-047)
- [x] TASK-0146 — Give the plan kind a schema, transcribed from the six plans (B-042, part 1)
- [x] TASK-0147 — Give the backlog entry a schema that owns its columns (B-042, part 2)
- [x] TASK-0148 — Document intranet TLS on a Windows host in the runbook
- [x] TASK-0149 — `vault_secrets.py exec` waits for its command on Windows
- [x] TASK-0150 — Git is the record: ADR-0033 and one commit per task
- [x] TASK-0151 — Artifact line budgets and frozen v1 schemas
- [x] TASK-0152 — project-migration v2: concise task and ADR schemas
- [x] TASK-0153 — Compact the live files to state only

## Post-S9 (superseded by the promotion above)

- [x] TASK-0074 — One guard pair for both command allowlists, and a correction to TASK-0071
- [x] TASK-0075 — A delegate must exist for every client its caller is emitted for
