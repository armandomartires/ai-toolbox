# ai-toolbox

<!--
The Compass pane's board (mods/task-compass). Each "## " heading is a sprint; each
top-level item is a task or decision from `.ai/tasks/TODO.md`, with the brief that
owns its details. [ ] to do, [>] in progress, [?] review, [!] blocked, [x] done,
plain item = backlog. Keep it in step with TODO.md (AGENTS.md, Definition of done).
-->

## S1 — Foundation
- [x] TASK-0001 — Port and harmonize the project-migration skill
  .ai/tasks/TASK-0001-port-project-migration-skill.md
- [x] TASK-0002 — Extend the skill frontmatter schema (license, metadata)
  .ai/tasks/TASK-0002-skill-frontmatter-schema.md
- [x] TASK-0003 — Harmonize the project-workflow skill
  .ai/tasks/TASK-0003-harmonize-project-workflow-skill.md
- [x] TASK-0004 — Allow external (Node/npm) MCP servers alongside authored Python ones
  .ai/tasks/TASK-0004-allow-external-mcp-servers.md
- [x] TASK-0005 — External MCP server shape: manifest, scripts, validation
  .ai/tasks/TASK-0005-external-mcp-server-shape.md
- [x] TASK-0007 — Port the ansible MCP server (first external server)
  .ai/tasks/TASK-0007-port-ansible-mcp-server.md
- [x] TASK-0006 — Client config snapshots and multi-client skill deployment
  .ai/tasks/TASK-0006-client-config-snapshots.md

## S2 — Multi-client hardening
- [x] TASK-0008 — Author the first loop component (`release-check`)
  .ai/tasks/TASK-0008-author-first-loop-component.md
- [x] TASK-0009 — MCP server smoke-test harness
  .ai/tasks/TASK-0009-mcp-smoke-test-harness.md

## S3 — Automation
- [x] TASK-0011 — De-duplicate the registry generator; assert no template rows
  .ai/tasks/TASK-0011-deduplicate-registry-generator.md
- [x] TASK-0010 — Pre-commit hook running validate.sh; optional CI workflow
  .ai/tasks/TASK-0010-precommit-hook.md

## S4 — Closing the open loops
- [x] TASK-0012 — Skill linter (frontmatter rules only)
  .ai/tasks/TASK-0012-skill-linter.md
- [x] TASK-0013 — Add a repo LICENSE backing the skills' `license: MIT` claims
  .ai/tasks/TASK-0013-repo-license.md
- [x] TASK-0014 — `install.sh` warns on the `core.filemode=false` hook trap
  .ai/tasks/TASK-0014-install-filemode-warning.md
- [x] TASK-0015 — Document required environment variables; wire the git remote
  .ai/tasks/TASK-0015-env-requirements-and-remote.md
- [x] TASK-0016 — Close the human-action gaps: procedures, not candidate bullets
  .ai/tasks/TASK-0016-human-action-gaps.md

## Post-S4
- [x] TASK-0017 — Record the LM Studio UI verification; fix the WORKSPACE_ROOT placeholder trap
  .ai/tasks/TASK-0017-lm-studio-ui-verified.md
- [x] TASK-0018 — Close B-001; fix the registry content defects found while scoping it
  .ai/tasks/TASK-0018-close-b001-registry-integrity.md
- [x] TASK-0019 — Retract the false default-branch mismatch claim
  .ai/tasks/TASK-0019-retract-default-branch-claim.md

## S5 — Session handover contract
- [x] TASK-0020 — Skill: add the session-handover reference; restore the conventions budget
  .ai/tasks/TASK-0020-skill-session-handover-reference.md
- [x] TASK-0021 — Skill: task-template handover contract; version 3.1.0
  .ai/tasks/TASK-0021-skill-task-template-handover-contract.md
- [x] TASK-0022 — Adopt the handover contract in this repo's task template
  .ai/tasks/TASK-0022-adopt-handover-contract-in-repo-template.md
- [x] TASK-0023 — validate.sh: detect missing or empty handover sections
  .ai/tasks/TASK-0023-validate-handover-sections.md

## Post-S5
- [x] TASK-0024 — Unify `.ai/decisions/` filenames on the `NNNN-*` scheme
  .ai/tasks/TASK-0024-unify-decision-filenames.md
- [x] TASK-0025 — Close B-009: the two skills scaffold different frameworks, by design
  .ai/tasks/TASK-0025-two-governance-frameworks.md

## S6 — Ansible agent guardrails
- [x] TASK-0026 — Correct the ansible MCP blast-radius claim and disable `ansible_navigator`
  .ai/tasks/TASK-0026-narrow-ansible-mcp-blast-radius.md
- [x] TASK-0027 — Spike: lint two real playbooks and choose the guard's home
  .ai/tasks/TASK-0027-spike-lint-real-playbooks.md
- [x] TASK-0028 — Spike: can a client hook intercept an MCP tool call?
  .ai/tasks/TASK-0028-spike-hook-interception.md
- [x] ADR-0014 — Accept the pinned ansible MCP surface; narrow it rather than extend it
  .ai/decisions/0014-accept-pinned-ansible-mcp-surface.md
- [x] ADR-0015 — Ansible knowledge is derived per change, not declared; and the graduated workflow is check-plus-snapshot
  .ai/decisions/0015-ansible-knowledge-portable-core-plus-templates.md
- [x] ADR-0016 — Hooks as a component category: declined, because the clients disagree on the tool's name
  .ai/decisions/0016-hooks-as-a-component-category.md
- [x] TASK-0029 — Author the `ansible-ops` skill
  .ai/tasks/TASK-0029-author-ansible-ops-skill.md
- [x] TASK-0030 — Author the `ansible-change` loop
  .ai/tasks/TASK-0030-author-ansible-change-loop.md
- [x] TASK-0031 — The `gather_subset` / `ansible_mounts` guard
  .ai/tasks/TASK-0031-gather-subset-guard.md
- [x] TASK-0032 — Record the target-repo findings and what was deliberately left alone
  .ai/tasks/TASK-0032-record-target-repo-findings.md
- [x] TASK-0052 — Un-park sprint S6, re-queue S8, and correct four defects in S6's own plan
  .ai/tasks/TASK-0052-unpark-s6-requeue-s8.md
- [x] TASK-0053 — Correct the Bionic client snapshot's drifted observations
  .ai/tasks/TASK-0053-bionic-snapshot-drift.md
- [x] TASK-0054 — Ratify ADR-0014/0015/0016, close S6, promote S8
  .ai/tasks/TASK-0054-ratify-s6-adrs-close-sprint.md

## S7 — Design and production agent loops
- [x] TASK-0033 — Park sprint S6, open sprint S7, and repair two roadmap omissions
  .ai/tasks/TASK-0033-park-s6-open-s7.md
- [x] TASK-0034 — Spike: inventory the agent-tiers drift and decide what survives
  .ai/tasks/TASK-0034-spike-agent-tiers-drift.md
- [x] ADR-0017 — agent-tiers stays with opencode-customization (claim withdrawn)
  .ai/decisions/0017-ai-toolbox-owns-agent-tiers.md
- [x] TASK-0035 — Import agent-tiers into this repo as its canonical home
  .ai/tasks/TASK-0035-import-agent-tiers.md
- [x] TASK-0036 — Spike: verify the per-client agent schema mapping against live docs
  .ai/tasks/TASK-0036-spike-agent-schema-mapping.md
- [x] ADR-0018 — Agent portability is scoped per capability; one source, per-client emission
  .ai/decisions/0018-agent-portability-one-source-per-client-emission.md
- [x] TASK-0037 — agents/_template/ and the normative agent schema
  .ai/tasks/TASK-0037-agents-template-and-schema.md
- [x] TASK-0038 — validate.sh: enforce the agent schema, proven by failing fixtures
  .ai/tasks/TASK-0038-validate-agent-frontmatter.md
- [x] TASK-0039 — sync-registry.sh: emit an Agents section
  .ai/tasks/TASK-0039-registry-agents-section.md
- [x] TASK-0040 — install.sh: emit per-client agent files
  .ai/tasks/TASK-0040-install-agent-emission.md
- [x] ADR-0019 — Design convergence is human acceptance; autonomy stops at the merge gate
  .ai/decisions/0019-design-convergence-and-the-autonomy-boundary.md
- [x] TASK-0041 — Author the design-brief loop
  .ai/tasks/TASK-0041-author-design-brief-loop.md
- [x] TASK-0042 — Author the design-flow skill
  .ai/tasks/TASK-0042-author-design-flow-skill.md
- [x] TASK-0043 — Author the four design-stage roles
  .ai/tasks/TASK-0043-author-design-roles.md
- [x] TASK-0044 — Author the project-build loop
  .ai/tasks/TASK-0044-author-project-build-loop.md
- [x] TASK-0045 — Author the three production roles in agents/
  .ai/tasks/TASK-0045-reconcile-production-roles.md
- [x] TASK-0046 — Pilot: run both loops end to end to produce ansible-ops and ansible-change
  .ai/tasks/TASK-0046-pilot-run-both-loops.md
- [x] TASK-0047 — The LM Studio client is Bionic; correct the skills and agents findings
  .ai/tasks/TASK-0047-lm-studio-is-bionic.md

## S8 — Third-party agent extensions
- [x] TASK-0048 — Spike: verify ponytail's and graphify's real integration surfaces
  .ai/tasks/TASK-0048-spike-third-party-extension-surfaces.md
- [x] TASK-0049 — graphify as a pinned external MCP server
  .ai/tasks/TASK-0049-graphify-external-mcp-server.md
- [x] TASK-0050 — ponytail as per-client wiring documentation
  .ai/tasks/TASK-0050-ponytail-client-wiring.md
- [x] TASK-0051 — The placement rule in the authoring guide, and omniroute as a documented non-component
  .ai/tasks/TASK-0051-placement-rule-and-third-party-tools.md
- [x] REVIEW-0009 — Sprint S8, Third-party agent extensions
  .ai/reviews/REVIEW-0009-sprint-s8-third-party-extensions.md
- [x] TASK-0068 — Ratify ADR-0021 and close sprint S8
  .ai/tasks/TASK-0068-ratify-adr-0021-close-s8.md

## Post-S8
- [x] TASK-0069 — Sweep stale second-hand claims: the gate's cost and the drifted Ansible toolchain
  .ai/tasks/TASK-0069-stale-second-hand-claims-sweep.md
- [x] TASK-0070 — One worktree per agent session, and the exec bits that make a worktree work
  .ai/tasks/TASK-0070-worktree-per-session-isolation.md
- [x] TASK-0071 — A `test-allowlist` capability term, so `qa-test` can run what it claims to run
  .ai/tasks/TASK-0071-test-allowlist-vocabulary-term.md
- [x] TASK-0072 — Deploy skills to Bionic's project target, and leave its global target alone
  .ai/tasks/TASK-0072-bionic-project-skills-target.md
- [x] TASK-0073 — When an MCP server owes a per-client wiring section, and when it does not
  .ai/tasks/TASK-0073-wiring-section-rule.md

## Post-S9
- [x] TASK-0074 — One guard pair for both command allowlists, and a correction to TASK-0071
  .ai/tasks/TASK-0074-command-allowlist-entry-guards.md
- [x] TASK-0075 — A delegate must exist for every client its caller is emitted for
  .ai/tasks/TASK-0075-delegates-to-cross-client-gate.md

## S9 — Unattended runs
- [x] TASK-0055 — Spike: can OpenCode host an unattended driver, and can its permissions hold it?
  .ai/tasks/TASK-0055-spike-opencode-driver-surface.md
- [x] TASK-0056 — Spike: what can Claude Code enforce per agent, and is a dead delegate silent?
  .ai/tasks/TASK-0056-spike-claude-code-boundary-surface.md
- [x] TASK-0057 — Author ADR-0022 from the spike evidence, and leave it proposed
  .ai/tasks/TASK-0057-author-adr-0022.md
- [x] GATE — human ratification of `ADR-0022`, cleared 2026-09-23
- [x] TASK-0077 — Promote sprint S9, and add Phase 9 in the same change
  .ai/tasks/TASK-0077-promote-s9.md
- [x] TASK-0058 — Settle `worktree-only` for Claude Code, add the delegation rule, and verify the authored-MCP section
  .ai/tasks/TASK-0058-authoring-guide-vocabulary-and-authored-mcp.md
- [x] TASK-0060 — Show a role's client coverage in the registry
  .ai/tasks/TASK-0060-registry-client-coverage.md
- [x] TASK-0061 — Author `loops/unattended-run/loop.md`
  .ai/tasks/TASK-0061-loop-unattended-run.md
- [x] TASK-0059 — Enforce the delegation rule, and close the authored-MCP validation gap
  .ai/tasks/TASK-0059-validate-delegation-and-authored-mcp-gates.md
- [x] TASK-0062 — Author `skills/unattended-ops/`
  .ai/tasks/TASK-0062-skill-unattended-ops.md
- [x] TASK-0063 — Author the four thinking roles
  .ai/tasks/TASK-0063-thinking-roles.md
- [x] TASK-0064 — Author the five acting roles, and fix `git-ops`' staging gap
  .ai/tasks/TASK-0064-acting-roles.md
- [x] TASK-0078 — `no-bash`, so `read-only` means what it says
  .ai/tasks/TASK-0078-no-bash-capability-term.md
- [x] TASK-0079 — Narrow `git-ops` to the commands it actually needs
  .ai/tasks/TASK-0079-narrow-git-ops-allowlist.md
- [x] REVIEW-0011 — Sprint S9, unattended runs: the decision and the portable core
  .ai/reviews/REVIEW-0011-sprint-s9-unattended-runs.md
- [x] TASK-0080 — State the OpenCode-first asymmetry in all three wiring snapshots
  .ai/tasks/TASK-0080-state-the-asymmetry-in-the-snapshots.md
- [x] TASK-0081 — Close sprint S9 on REVIEW-0011
  .ai/tasks/TASK-0081-close-sprint-s9.md

## S10 — Bindings, the gate server, the pilot
- [x] TASK-0082 — Spike: does a trailing flag escape an OpenCode allow-glob?
  .ai/tasks/TASK-0082-spike-trailing-flag-resolution.md
- [x] TASK-0083 — Close the trailing-flag holes, split by what they actually are
  .ai/tasks/TASK-0083-close-the-trailing-flag-holes.md
- [x] TASK-0084 — Ratify ADR-0023
  .ai/tasks/TASK-0084-ratify-adr-0023.md
- [x] TASK-0085 — Promote sprint S10, and add Phase 10 in the same change
  .ai/tasks/TASK-0085-promote-s10.md
- [x] TASK-0086 — S10.1: the OpenCode driver and its binding
  .ai/tasks/TASK-0086-opencode-driver-binding.md
- [x] TASK-0087 — S10.2: the Claude Code Workflow binding
  .ai/tasks/TASK-0087-claude-code-workflow-binding.md
- [x] TASK-0088 — S10.3: `mcp-servers/gates/`, the first authored MCP server
  .ai/tasks/TASK-0088-gates-mcp-server.md
- [x] TASK-0089 — One rule for who starts a gate, and who writes the evidence
  .ai/tasks/TASK-0089-gate-invoker-rule.md
- [x] S10.4 — the Bionic binding: established that Bionic cannot orchestrate
- [x] TASK-0090 — S10.5: install for both clients, verify the gates server in each, record it
  .ai/tasks/TASK-0090-s10-5-install-and-wire.md
- [x] TASK-0091 — Prune an emitted agent file when its role stops declaring that client
  .ai/tasks/TASK-0091-prune-stale-emitted-agents.md
- [x] TASK-0092 — S10.7: the pilot — one unattended run of two tasks, dry run first
  .ai/tasks/TASK-0092-s10-7-pilot.md
- [x] TASK-0093 — release-check step 8: record the hash in a follow-up commit, never amend
  .ai/tasks/TASK-0093-release-check-step-8-follow-up-commit.md
- [x] TASK-0094 — Refresh the stale opening paragraph of CURRENT_STATE.md
  .ai/tasks/TASK-0094-refresh-current-state-header.md
- [x] TASK-0095 — Roles read the paths the driver resolved; they never glob for them
  .ai/tasks/TASK-0095-read-resolved-paths-not-glob.md
- [x] TASK-0096 — The driver hands preflight the evidence of its own step-1 checks
  .ai/tasks/TASK-0096-driver-hands-preflight-its-evidence.md
- [x] TASK-0097 — The driver checks a closed commit's files against the declared paths
  .ai/tasks/TASK-0097-driver-checks-commit-paths.md
- [x] TASK-0098 — Keep every gate command outside the tree the roles can read
  .ai/tasks/TASK-0098-gate-commands-out-of-role-reach.md
- [x] TASK-0099 — The closer writes fixed commit and push lines, and the driver checks them
  .ai/tasks/TASK-0099-check-the-closers-log-lines.md
- [x] TASK-0100 — Per-role timeouts, and a run that can be stopped cleanly
  .ai/tasks/TASK-0100-role-timeouts-and-a-clean-stop.md
- [x] TASK-0101 — Run roles stop being told to read the skill at run time
  .ai/tasks/TASK-0101-roles-stop-reading-the-skill.md
- [x] TASK-0102 — Emit each role's allowed shell commands into its body, and draft the upstream report
  .ai/tasks/TASK-0102-emit-the-allowed-commands-note.md
- [x] TASK-0103 — The Claude Code binding checks a closed commit's files against the declared paths
  .ai/tasks/TASK-0103-claude-code-commit-paths-check.md
- [x] S10.6 — registry and state (done — confirmed by REVIEW-0012)
- [x] REVIEW-0012 — Sprint S10, unattended runs: the bindings, the gate server, and the pilot
  .ai/reviews/REVIEW-0012-sprint-s10-unattended-bindings.md
- [x] TASK-0104 — S10.4: establish that Bionic cannot orchestrate, or drop the claim
  .ai/tasks/TASK-0104-establish-bionic-cannot-orchestrate.md
- [x] TASK-0105 — Close sprint S10 on REVIEW-0012 (S10.4 now discharged)
  .ai/tasks/TASK-0105-close-sprint-s10.md

## Post-S10
- [x] TASK-0106 — B-035: embed the adjudicator's decision standard in its prompt
  .ai/tasks/TASK-0106-embed-the-decision-standard.md
- [x] TASK-0107 — Settle `worktree-only`'s Claude Code emission (ADR-0018 clause 7)
  .ai/tasks/TASK-0107-worktree-only-claude-code-emission.md
- [x] TASK-0108 — Re-count the `ansible-core` version claims, then act on the count
  .ai/tasks/TASK-0108-ansible-core-version-recount.md
- [x] TASK-0109 — Give artifact shape one owner, and generate the skeleton instead of copying a template
  .ai/tasks/TASK-0109-artifact-schema-one-owner.md
- [x] TASK-0110 — Migrate the repository onto the artifact schemas
  .ai/tasks/TASK-0110-migrate-repo-onto-schemas.md
- [x] TASK-0112 — The Claude Code binding's own consistency check fails, and no gate noticed
  .ai/tasks/TASK-0112-claude-code-binding-suite-is-red.md
- [x] TASK-0118 — Repair four stale claims in the planning ledger
  .ai/tasks/TASK-0118-repair-the-planning-ledger.md
- [x] TASK-0111 — Can a worktree-isolated Claude Code subagent reach the main checkout by absolute path?
  .ai/tasks/TASK-0111-worktree-absolute-path-reach.md
- [x] TASK-0113 — Run the Claude Code unattended binding against a real run, once
  .ai/tasks/TASK-0113-claude-code-binding-first-real-run.md
- [x] TASK-0114 — Test ADR-0022's two untested falsifiers, F7 and F9
  .ai/tasks/TASK-0114-adr-0022-f7-and-f9.md
- [x] TASK-0115 — Re-run ADR-0014's "53 rules / 0 violations" under ansible-core 2.21.4
  .ai/tasks/TASK-0115-recount-adr-0014-lint-figure.md
- [x] TASK-0116 — Exercise skills/ansible-ops against the live estate, once
  .ai/tasks/TASK-0116-exercise-ansible-ops-live.md
- [x] TASK-0117 — Make the artifact generator reachable from project-migration alone
  .ai/tasks/TASK-0117-artifact-generator-reachable-from-migration.md
- [x] TASK-0119 — Generate the scaffold's planning templates from the schemas that own them
  .ai/tasks/TASK-0119-scaffold-templates-from-schemas.md
- [x] TASK-0120 — Settle whether a migrated repository can regenerate its templates
  .ai/tasks/TASK-0120-migrated-repo-cannot-regenerate.md
- [x] TASK-0121 — The evidence line carries no figure, so the closer cannot copy one
  .ai/tasks/TASK-0121-evidence-line-carries-no-figure.md
- [x] TASK-0122 — An agile dashboard for the .ai governance layer
  .ai/tasks/TASK-0122-project-workflow-dashboard.md
- [x] TASK-0123 — Publish the dashboard from CI to GitHub Pages
  .ai/tasks/TASK-0123-publish-the-dashboard-from-ci.md
- [x] TASK-0124 — Tell someone when CI fails
  .ai/tasks/TASK-0124-tell-someone-when-ci-fails.md
- [x] TASK-0125 — Retire this repo's dashboard generator for the vendored canonical one
  .ai/tasks/TASK-0125-one-dashboard-vendored-from-source.md
- [x] TASK-0126 — Make the intranet GitLab the primary remote
  .ai/tasks/TASK-0126-make-gitlab-the-primary-remote.md
- [x] TASK-0127 — Ship GitHub Pages and GitLab Pages as optional dashboard destinations
  .ai/tasks/TASK-0127-dashboard-publishing-destinations.md
- [x] TASK-0128 — Record why only CI builds the published dashboard
  .ai/tasks/TASK-0128-ci-builds-the-published-dashboard.md
- [x] TASK-0129 — Rebuild the published dashboard daily from a separate dispatcher
  .ai/tasks/TASK-0129-daily-dashboard-dispatcher.md
- [x] TASK-0130 — Close the CI alert only when no watched workflow is red
  .ai/tasks/TASK-0130-ci-alert-closes-only-when-nothing-is-red.md
- [x] TASK-0131 — Source secrets from the intranet Vault; keep the environment as the interface
  .ai/tasks/TASK-0131-secrets-from-vault.md
- [x] TASK-0132 — Give ai-toolbox an AppRole identity; read several secret maps
  .ai/tasks/TASK-0132-approle-identity.md
- [x] TASK-0133 — Ignore every .env variant, not only .env (B-053)
  .ai/tasks/TASK-0133-ignore-every-env-file.md
- [x] TASK-0134 — The estate's ansible-vault password comes from Vault (B-052)
  .ai/tasks/TASK-0134-vault-password-from-vault.md
- [x] TASK-0135 — worktree.sh remove deletes a landed branch and reports honestly (B-049)
  .ai/tasks/TASK-0135-worktree-remove-reports-honestly.md
- [x] TASK-0136 — State that the resume guard must never search --all (B-045)
  .ai/tasks/TASK-0136-resume-guard-never-all.md
- [x] TASK-0137 — Name what loops/ansible-change needs from a Claude Code session (B-046)
  .ai/tasks/TASK-0137-ansible-change-claude-code-prerequisite.md
- [x] TASK-0138 — Give role 5 a derived verdict for task-loading actions (B-050)
  .ai/tasks/TASK-0138-control-flow-fidelity-carve-out.md
- [x] TASK-0139 — Make the generated banners true in every repository they reach (B-051)
  .ai/tasks/TASK-0139-banners-true-outside-ai-toolbox.md
- [x] TASK-0140 — Let the Claude Code binding be pointed at a repository (B-044)
  .ai/tasks/TASK-0140-claude-code-binding-repo-root.md
- [x] TASK-0141 — Run both unattended-run binding suites in CI (B-037)
  .ai/tasks/TASK-0141-ci-runs-the-binding-suites.md
- [x] TASK-0142 — Gate that a closed backlog row names a closer that agrees (B-038)
  .ai/tasks/TASK-0142-closed-backlog-rows-name-their-closer.md
- [x] TASK-0143 — Close B-025 as deferred until a second role wants the term
  .ai/tasks/TASK-0143-defer-b025.md
- [x] TASK-0144 — Report the estate's stale ansible.cfg claims to the estate (B-039)
  .ai/tasks/TASK-0144-report-ansible-cfg-claims-to-the-estate.md
- [x] TASK-0145 — Gate BACKLOG.md's open-item count against the rows (B-047)
  .ai/tasks/TASK-0145-gate-the-open-item-count.md
- [x] TASK-0146 — Give the plan kind a schema, transcribed from the six plans (B-042, part 1)
  .ai/tasks/TASK-0146-plan-schema-from-the-six-plans.md
- [x] TASK-0147 — Give the backlog entry a schema that owns its columns (B-042, part 2)
  .ai/tasks/TASK-0147-backlog-entry-schema.md
- [x] TASK-0148 — Document intranet TLS on a Windows host in the runbook
  .ai/tasks/TASK-0148-intranet-tls-on-windows.md
- [x] TASK-0149 — `vault_secrets.py exec` waits for its command on Windows
  .ai/tasks/TASK-0149-vault-exec-on-windows.md
- [x] TASK-0150 — Git is the record: ADR-0033 and one commit per task
  .ai/tasks/TASK-0150-git-is-the-record.md
- [x] TASK-0151 — Artifact line budgets and frozen v1 schemas
  .ai/tasks/TASK-0151-artifact-budgets-and-legacy-schemas.md
- [x] TASK-0152 — project-migration v2: concise task and ADR schemas
  .ai/tasks/TASK-0152-project-migration-v2-schemas.md
- [x] TASK-0153 — Compact the live files to state only
  .ai/tasks/TASK-0153-compact-live-files.md
- [x] TASK-0154 — project-workflow 6.0.0: concise schemas, docs and fixtures
  .ai/tasks/TASK-0154-project-workflow-concise.md
- [x] TASK-0155 — Declare a project's secrets backend: secrets.conf, init, the local backend
  .ai/tasks/TASK-0155-secrets-backend-declaration.md
- [x] TASK-0156 — Provision a Vault project's own KV mount, policies and AppRole
  .ai/tasks/TASK-0156-vault-project-provision.md
- [x] TASK-0157 — Set and check GitLab CI variables and GitHub Actions secrets
  .ai/tasks/TASK-0157-ci-backend-put-check.md
- [x] TASK-0158 — Let project-migration migrate secrets, and import an old env file
  .ai/tasks/TASK-0158-migrate-secrets.md
- [x] TASK-0159 — Rebuild the dashboard at plan approval and on push; ask about Pages
  .ai/tasks/TASK-0159-dashboard-rebuild-and-publishing-question.md
- [x] TASK-0160 — `install.sh link` really links on Windows; `--status` reports
  .ai/tasks/TASK-0160-install-links-really-link-on-windows.md
- [x] TASK-0161 — `vendor-skill.sh`: per-project skill copies with a manifest
  .ai/tasks/TASK-0161-vendor-skill-with-a-manifest.md
- [x] TASK-0163 — Push to `origin` over `https://` with a per-command rewrite
  .ai/tasks/TASK-0163-push-origin-over-https.md
- [x] TASK-0165 — Keep the gate's throwaway `git init` out of the real repository
  .ai/tasks/TASK-0165-gate-init-cannot-reach-the-real-repo.md
- [x] TASK-0166 — Re-point `origin` to `https://`; amend ADR-0028
  .ai/tasks/TASK-0166-repoint-origin-to-https.md
- [x] TASK-0168 — Publish the dashboard to GitLab Pages as well, rebuilt daily by a schedule
  .ai/tasks/TASK-0168-gitlab-pages-dashboard.md
- [x] TASK-0169 — Stop reading three retired secrets, so SIGMA-infrastructure can retire them
  .ai/tasks/TASK-0169-stop-reading-retired-secrets.md
- [x] TASK-0170 — Let GitLab push the public mirror, so agents push `origin` only
  .ai/tasks/TASK-0170-gitlab-push-mirror-to-github.md
- [x] TASK-0171 — Each project declares its work tracker: files, GitLab or GitHub
  .ai/tasks/TASK-0171-work-tracker-declaration.md
- [x] TASK-0172 — Run the unattended loop on a forge tracker
  .ai/tasks/TASK-0172-unattended-run-on-a-forge-tracker.md
- [x] TASK-0173 — Gate the Agent Skills spec's length and name limits
  .ai/tasks/TASK-0173-skill-spec-limits.md
- [x] TASK-0174 — Make the session-start reading chain short and consistent
  .ai/tasks/TASK-0174-lean-session-start-context.md
- [x] TASK-0175 — Track unexercised capability as backlog rows, and cap it
  .ai/tasks/TASK-0175-cap-unexercised-capability.md
- [!] TASK-0176 — Exercise the GitLab tracker and a forge unattended run for real
  .ai/tasks/TASK-0176-exercise-the-gitlab-tracker.md
- [x] TASK-0177 — Merge claude-mods, and develop mods here from now on
  .ai/tasks/TASK-0177-merge-claude-mods.md
- [x] TASK-0178 — Design how task-compass reads a project's .ai/ planning
  .ai/tasks/TASK-0178-compass-reads-ai-planning-design.md
- [x] TASK-0179 — Compass reads a project's .ai/ planning
  .ai/tasks/TASK-0179-compass-reads-ai-planning.md
- [x] TASK-0180 — Compass keeps GOALS.md under .ai/
  .ai/tasks/TASK-0180-compass-goals-under-ai.md
- [x] TASK-0181 — agent-watch: a subagents pane and a task-progress band
  .ai/tasks/TASK-0181-agent-watch-mod.md
- [x] TASK-0182 — agent-watch 0.2.0: live activity, failure alerts, band interactions
  .ai/tasks/TASK-0182-agent-watch-live.md
- [x] TASK-0184 — Harmonize every task into .ai/GOALS.md, and make keeping it current a rule
  .ai/tasks/TASK-0184-goals-md-harmonized.md
- [x] TASK-0183 — task-orchestrator: a mod that routes delegated work by model and effort
  .ai/tasks/TASK-0183-task-orchestrator-mod.md
- [x] TASK-0185 — switchboard: one mod that turns mods, skills and connectors on and off
  .ai/tasks/TASK-0185-switchboard-mod.md
- [x] TASK-0186 — switchboard 0.2.0: every mod in the pane, with On/Off toggle buttons
  .ai/tasks/TASK-0186-switchboard-toggles.md
- [x] TASK-0187 — switchboard 0.3.0: a switch-style toggle, skills listed, app servers protected
  .ai/tasks/TASK-0187-switchboard-switch.md
- [x] TASK-0188 — SIGMAorbital for mods: one shared design module, its gate, ADR-0043
  .ai/tasks/TASK-0188-sigmaorbital-mod-design.md
- [x] TASK-0189 — agent-watch 0.3.0 on SIGMAorbital
  .ai/tasks/TASK-0189-agent-watch-sigmaorbital.md
- [x] TASK-0190 — task-compass 0.4.0 on SIGMAorbital
  .ai/tasks/TASK-0190-task-compass-sigmaorbital.md
- [x] TASK-0191 — task-orchestrator 0.2.0 on SIGMAorbital
  .ai/tasks/TASK-0191-task-orchestrator-sigmaorbital.md
- [x] TASK-0192 — switchboard 0.4.0 on SIGMAorbital
  .ai/tasks/TASK-0192-switchboard-sigmaorbital.md
- [x] TASK-0193 — agent-watch 0.4.0: sessions, sub-sessions and their subagents
  .ai/tasks/TASK-0193-agent-watch-sessions.md
- [x] TASK-0194 — task-orchestrator 0.3.0: a spawn auto mode refuses can be retried or handed off
  .ai/tasks/TASK-0194-orchestrator-auto-mode-spawn.md
- [x] TASK-0195 — agent-watch 0.4.1: a subagent ends on its own turn (B-066)
  .ai/tasks/TASK-0195-agent-watch-turn-end.md
- [x] TASK-0196 — task-compass 0.5.0: the Subagents panel follows the orchestrator
  .ai/tasks/TASK-0196-compass-orchestrator.md
- [x] TASK-0197 — task-compass 0.6.0: the Sessions tree, from agent-watch
  .ai/tasks/TASK-0197-compass-sessions-tree.md
- [x] TASK-0198 — task-compass 0.7.0: a sunburst of the Sessions tree
  .ai/tasks/TASK-0198-compass-sunburst.md
- [x] TASK-0199 — task-compass 0.8.0: the Sessions panel as a status sunburst
  .ai/tasks/TASK-0199-compass-status-sunburst.md

## Backlog — open items
Goal: Waiting on the human or on a real run; see .ai/planning/BACKLOG.md
- B-056 Unexercised: the `gitlab` and `github` work trackers and the unattended run's issue snapshot (`ADR-0037`, `ADR-0038`)
  .ai/planning/BACKLOG.md
- B-057 Unexercised: secrets `provision`, and `put` to GitLab and GitHub (`TASK-0156`, `TASK-0157`)
  .ai/planning/BACKLOG.md
- B-058 Unexercised: an `ansible-ops` guest-level change behind a real PVE snapshot (`TASK-0116`)
  .ai/planning/BACKLOG.md
- B-061 `worktree-only` is not enforced on Claude Code, and its emission is undecided (`TASK-0111`)
  .ai/planning/BACKLOG.md
- B-062 asset-management's vendored `project-workflow` predates `vendor-skill.sh` and is behind 7.1.2
  .ai/planning/BACKLOG.md
- B-063 Estate repository work waiting on the human: pushes of `b92e2a9` (`B-039`) and `2a09fa0` (`B-052`); LDAP config drift, estate `#96`
  .ai/planning/BACKLOG.md
- B-064 `task-compass`'s README has no screenshots
  .ai/planning/BACKLOG.md
- B-065 task-orchestrator's `collect` fails while its tasks run
  .ai/planning/BACKLOG.md
