# ai-toolbox

<!--
The Compass pane's board (mods/task-compass). Each "## " heading is a sprint of
.ai/30.ROADMAP.md; each top-level item is a task (S###.T###) or decision, with the
brief that owns its details. [ ] to do, [>] in progress, [?] review, [!] blocked,
[x] done, plain item = backlog. Keep it in step with the briefs (AGENTS.md,
Definition of done). Old TASK-NNNN ids resolve through .ai/id-map.tsv.
-->

## S001 — Foundation
- [x] S001.T001 — Port and harmonize the project-migration skill
  .ai/tasks/S001.T001_PortProjectMigrationSkill.md
- [x] S001.T002 — Extend the skill frontmatter schema (license, metadata)
  .ai/tasks/S001.T002_SkillFrontmatterSchema.md
- [x] S001.T003 — Harmonize the project-workflow skill
  .ai/tasks/S001.T003_HarmonizeProjectWorkflowSkill.md
- [x] S001.T004 — Allow external (Node/npm) MCP servers alongside authored Python ones
  .ai/tasks/S001.T004_AllowExternalMcpServers.md
- [x] S001.T005 — External MCP server shape: manifest, scripts, validation
  .ai/tasks/S001.T005_ExternalMcpServerShape.md
- [x] S001.T007 — Port the ansible MCP server (first external server)
  .ai/tasks/S001.T007_PortAnsibleMcpServer.md
- [x] S001.T006 — Client config snapshots and multi-client skill deployment
  .ai/tasks/S001.T006_ClientConfigSnapshots.md

## S002 — Multi-client hardening
- [x] S002.T001 — Author the first loop component (`release-check`)
  .ai/tasks/S002.T001_AuthorFirstLoopComponent.md
- [x] S002.T002 — MCP server smoke-test harness
  .ai/tasks/S002.T002_McpSmokeTestHarness.md

## S003 — Automation
- [x] S003.T002 — De-duplicate the registry generator; assert no template rows
  .ai/tasks/S003.T002_DeduplicateRegistryGenerator.md
- [x] S003.T001 — Pre-commit hook running validate.sh; optional CI workflow
  .ai/tasks/S003.T001_PrecommitHook.md

## S004 — Closing the open loops
- [x] S004.T001 — Skill linter (frontmatter rules only)
  .ai/tasks/S004.T001_SkillLinter.md
- [x] S004.T002 — Add a repo LICENSE backing the skills' `license: MIT` claims
  .ai/tasks/S004.T002_RepoLicense.md
- [x] S004.T003 — `install.sh` warns on the `core.filemode=false` hook trap
  .ai/tasks/S004.T003_InstallFilemodeWarning.md
- [x] S004.T004 — Document required environment variables; wire the git remote
  .ai/tasks/S004.T004_EnvRequirementsAndRemote.md
- [x] S004.T005 — Close the human-action gaps: procedures, not candidate bullets
  .ai/tasks/S004.T005_HumanActionGaps.md

## S005 — Session handover contract
- [x] S005.T001 — Skill: add the session-handover reference; restore the conventions budget
  .ai/tasks/S005.T001_SkillSessionHandoverReference.md
- [x] S005.T002 — Skill: task-template handover contract; version 3.1.0
  .ai/tasks/S005.T002_SkillTaskTemplateHandoverContract.md
- [x] S005.T003 — Adopt the handover contract in this repo's task template
  .ai/tasks/S005.T003_AdoptHandoverContractInRepoTemplate.md
- [x] S005.T004 — validate.sh: detect missing or empty handover sections
  .ai/tasks/S005.T004_ValidateHandoverSections.md

## S006 — Ansible agent guardrails
- [x] S006.T001 — Correct the ansible MCP blast-radius claim and disable `ansible_navigator`
  .ai/tasks/S006.T001_NarrowAnsibleMcpBlastRadius.md
- [x] S006.T002 — Spike: lint two real playbooks and choose the guard's home
  .ai/tasks/S006.T002_SpikeLintRealPlaybooks.md
- [x] S006.T003 — Spike: can a client hook intercept an MCP tool call?
  .ai/tasks/S006.T003_SpikeHookInterception.md
- [x] ADR-0014 — Accept the pinned ansible MCP surface; narrow it rather than extend it
  .ai/decisions/ADR-0014-accept-pinned-ansible-mcp-surface.md
- [x] ADR-0015 — Ansible knowledge is derived per change, not declared; and the graduated workflow is check-plus-snapshot
  .ai/decisions/ADR-0015-ansible-knowledge-portable-core-plus-templates.md
- [x] ADR-0016 — Hooks as a component category: declined, because the clients disagree on the tool's name
  .ai/decisions/ADR-0016-hooks-as-a-component-category.md
- [x] S006.T004 — Author the `ansible-ops` skill
  .ai/tasks/S006.T004_AuthorAnsibleOpsSkill.md
- [x] S006.T005 — Author the `ansible-change` loop
  .ai/tasks/S006.T005_AuthorAnsibleChangeLoop.md
- [x] S006.T006 — The `gather_subset` / `ansible_mounts` guard
  .ai/tasks/S006.T006_GatherSubsetGuard.md
- [x] S006.T007 — Record the target-repo findings and what was deliberately left alone
  .ai/tasks/S006.T007_RecordTargetRepoFindings.md
- [x] S006.T008 — Un-park sprint S6, re-queue S8, and correct four defects in S6's own plan
  .ai/tasks/S006.T008_UnparkS6RequeueS8.md
- [x] S006.T009 — Correct the Bionic client snapshot's drifted observations
  .ai/tasks/S006.T009_BionicSnapshotDrift.md
- [x] S006.T010 — Ratify ADR-0014/0015/0016, close S6, promote S8
  .ai/tasks/S006.T010_RatifyS6AdrsCloseSprint.md

## S007 — Design and production agent loops
- [x] S007.T001 — Park sprint S6, open sprint S7, and repair two roadmap omissions
  .ai/tasks/S007.T001_ParkS6OpenS7.md
- [x] S007.T002 — Spike: inventory the agent-tiers drift and decide what survives
  .ai/tasks/S007.T002_SpikeAgentTiersDrift.md
- [x] ADR-0017 — agent-tiers stays with opencode-customization (claim withdrawn)
  .ai/decisions/ADR-0017-ai-toolbox-owns-agent-tiers.md
- [x] S007.T003 — Import agent-tiers into this repo as its canonical home
  .ai/tasks/S007.T003_ImportAgentTiers.md
- [x] S007.T004 — Spike: verify the per-client agent schema mapping against live docs
  .ai/tasks/S007.T004_SpikeAgentSchemaMapping.md
- [x] ADR-0018 — Agent portability is scoped per capability; one source, per-client emission
  .ai/decisions/ADR-0018-agent-portability-one-source-per-client-emission.md
- [x] S007.T005 — agents/_template/ and the normative agent schema
  .ai/tasks/S007.T005_AgentsTemplateAndSchema.md
- [x] S007.T006 — validate.sh: enforce the agent schema, proven by failing fixtures
  .ai/tasks/S007.T006_ValidateAgentFrontmatter.md
- [x] S007.T007 — sync-registry.sh: emit an Agents section
  .ai/tasks/S007.T007_RegistryAgentsSection.md
- [x] S007.T008 — install.sh: emit per-client agent files
  .ai/tasks/S007.T008_InstallAgentEmission.md
- [x] ADR-0019 — Design convergence is human acceptance; autonomy stops at the merge gate
  .ai/decisions/ADR-0019-design-convergence-and-the-autonomy-boundary.md
- [x] S007.T009 — Author the design-brief loop
  .ai/tasks/S007.T009_AuthorDesignBriefLoop.md
- [x] S007.T010 — Author the design-flow skill
  .ai/tasks/S007.T010_AuthorDesignFlowSkill.md
- [x] S007.T011 — Author the four design-stage roles
  .ai/tasks/S007.T011_AuthorDesignRoles.md
- [x] S007.T012 — Author the project-build loop
  .ai/tasks/S007.T012_AuthorProjectBuildLoop.md
- [x] S007.T013 — Author the three production roles in agents/
  .ai/tasks/S007.T013_ReconcileProductionRoles.md
- [x] S007.T014 — Pilot: run both loops end to end to produce ansible-ops and ansible-change
  .ai/tasks/S007.T014_PilotRunBothLoops.md
- [x] S007.T015 — The LM Studio client is Bionic; correct the skills and agents findings
  .ai/tasks/S007.T015_LmStudioIsBionic.md

## S008 — Third-party agent extensions
- [x] S008.T001 — Spike: verify ponytail's and graphify's real integration surfaces
  .ai/tasks/S008.T001_SpikeThirdPartyExtensionSurfaces.md
- [x] S008.T002 — graphify as a pinned external MCP server
  .ai/tasks/S008.T002_GraphifyExternalMcpServer.md
- [x] S008.T003 — ponytail as per-client wiring documentation
  .ai/tasks/S008.T003_PonytailClientWiring.md
- [x] S008.T004 — The placement rule in the authoring guide, and omniroute as a documented non-component
  .ai/tasks/S008.T004_PlacementRuleAndThirdPartyTools.md
- [x] REVIEW-0009 — Sprint S8, Third-party agent extensions
  .ai/reviews/S008-checkpoint.md
- [x] S008.T005 — Ratify ADR-0021 and close sprint S8
  .ai/tasks/S008.T005_RatifyAdr0021CloseS8.md

## S009 — Unattended runs
- [x] S009.T001 — Spike: can OpenCode host an unattended driver, and can its permissions hold it?
  .ai/tasks/S009.T001_SpikeOpencodeDriverSurface.md
- [x] S009.T002 — Spike: what can Claude Code enforce per agent, and is a dead delegate silent?
  .ai/tasks/S009.T002_SpikeClaudeCodeBoundarySurface.md
- [x] S009.T003 — Author ADR-0022 from the spike evidence, and leave it proposed
  .ai/tasks/S009.T003_AuthorAdr0022.md
- [x] GATE — human ratification of `ADR-0022`, cleared 2026-09-23
- [x] S009.T011 — Ratify ADR-0022
  .ai/tasks/S009.T011_RatifyAdr0022.md
- [x] S009.T012 — Promote sprint S9, and add Phase 9 in the same change
  .ai/tasks/S009.T012_PromoteS9.md
- [x] S009.T004 — Settle `worktree-only` for Claude Code, add the delegation rule, and verify the authored-MCP section
  .ai/tasks/S009.T004_AuthoringGuideVocabularyAndAuthoredMcp.md
- [x] S009.T006 — Show a role's client coverage in the registry
  .ai/tasks/S009.T006_RegistryClientCoverage.md
- [x] S009.T007 — Author `loops/unattended-run/loop.md`
  .ai/tasks/S009.T007_LoopUnattendedRun.md
- [x] S009.T005 — Enforce the delegation rule, and close the authored-MCP validation gap
  .ai/tasks/S009.T005_ValidateDelegationAndAuthoredMcpGates.md
- [x] S009.T008 — Author `skills/unattended-ops/`
  .ai/tasks/S009.T008_SkillUnattendedOps.md
- [x] S009.T009 — Author the four thinking roles
  .ai/tasks/S009.T009_ThinkingRoles.md
- [x] S009.T010 — Author the five acting roles, and fix `git-ops`' staging gap
  .ai/tasks/S009.T010_ActingRoles.md
- [x] S009.T013 — `no-bash`, so `read-only` means what it says
  .ai/tasks/S009.T013_NoBashCapabilityTerm.md
- [x] S009.T014 — Narrow `git-ops` to the commands it actually needs
  .ai/tasks/S009.T014_NarrowGitOpsAllowlist.md
- [x] REVIEW-0011 — Sprint S9, unattended runs: the decision and the portable core
  .ai/reviews/S009-checkpoint.md
- [x] S009.T015 — State the OpenCode-first asymmetry in all three wiring snapshots
  .ai/tasks/S009.T015_StateTheAsymmetryInTheSnapshots.md
- [x] S009.T016 — Close sprint S9 on REVIEW-0011
  .ai/tasks/S009.T016_CloseSprintS9.md

## S010 — Bindings, the gate server, the pilot
- [x] S010.T001 — Spike: does a trailing flag escape an OpenCode allow-glob?
  .ai/tasks/S010.T001_SpikeTrailingFlagResolution.md
- [x] S010.T002 — Close the trailing-flag holes, split by what they actually are
  .ai/tasks/S010.T002_CloseTheTrailingFlagHoles.md
- [x] S010.T003 — Ratify ADR-0023
  .ai/tasks/S010.T003_RatifyAdr0023.md
- [x] S010.T004 — Promote sprint S10, and add Phase 10 in the same change
  .ai/tasks/S010.T004_PromoteS10.md
- [x] S010.T005 — S10.1: the OpenCode driver and its binding
  .ai/tasks/S010.T005_OpencodeDriverBinding.md
- [x] S010.T006 — S10.2: the Claude Code Workflow binding
  .ai/tasks/S010.T006_ClaudeCodeWorkflowBinding.md
- [x] S010.T007 — S10.3: `mcp-servers/gates/`, the first authored MCP server
  .ai/tasks/S010.T007_GatesMcpServer.md
- [x] S010.T008 — One rule for who starts a gate, and who writes the evidence
  .ai/tasks/S010.T008_GateInvokerRule.md
- [x] S10.4 — the Bionic binding: established that Bionic cannot orchestrate
- [x] S010.T009 — S10.5: install for both clients, verify the gates server in each, record it
  .ai/tasks/S010.T009_S105InstallAndWire.md
- [x] S010.T010 — Prune an emitted agent file when its role stops declaring that client
  .ai/tasks/S010.T010_PruneStaleEmittedAgents.md
- [x] S010.T011 — S10.7: the pilot — one unattended run of two tasks, dry run first
  .ai/tasks/S010.T011_S107Pilot.md
- [x] S010.T012 — release-check step 8: record the hash in a follow-up commit, never amend
  .ai/tasks/S010.T012_ReleaseCheckStep8FollowUpCommit.md
- [x] S010.T013 — Refresh the stale opening paragraph of CURRENT_STATE.md
  .ai/tasks/S010.T013_RefreshCurrentStateHeader.md
- [x] S010.T014 — Roles read the paths the driver resolved; they never glob for them
  .ai/tasks/S010.T014_ReadResolvedPathsNotGlob.md
- [x] S010.T015 — The driver hands preflight the evidence of its own step-1 checks
  .ai/tasks/S010.T015_DriverHandsPreflightItsEvidence.md
- [x] S010.T016 — The driver checks a closed commit's files against the declared paths
  .ai/tasks/S010.T016_DriverChecksCommitPaths.md
- [x] S010.T017 — Keep every gate command outside the tree the roles can read
  .ai/tasks/S010.T017_GateCommandsOutOfRoleReach.md
- [x] S010.T018 — The closer writes fixed commit and push lines, and the driver checks them
  .ai/tasks/S010.T018_CheckTheClosersLogLines.md
- [x] S010.T019 — Per-role timeouts, and a run that can be stopped cleanly
  .ai/tasks/S010.T019_RoleTimeoutsAndACleanStop.md
- [x] S010.T020 — Run roles stop being told to read the skill at run time
  .ai/tasks/S010.T020_RolesStopReadingTheSkill.md
- [x] S010.T021 — Emit each role's allowed shell commands into its body, and draft the upstream report
  .ai/tasks/S010.T021_EmitTheAllowedCommandsNote.md
- [x] S010.T022 — The Claude Code binding checks a closed commit's files against the declared paths
  .ai/tasks/S010.T022_ClaudeCodeCommitPathsCheck.md
- [x] S10.6 — registry and state (done — confirmed by REVIEW-0012)
- [x] REVIEW-0012 — Sprint S10, unattended runs: the bindings, the gate server, and the pilot
  .ai/reviews/S010-checkpoint.md
- [x] S010.T023 — S10.4: establish that Bionic cannot orchestrate, or drop the claim
  .ai/tasks/S010.T023_EstablishBionicCannotOrchestrate.md
- [x] S010.T024 — Close sprint S10 on REVIEW-0012 (S10.4 now discharged)
  .ai/tasks/S010.T024_CloseSprintS10.md

## S011 — Claude-centric alignment
Goal: Claude Code becomes the reference harness, with generated ports; see .ai/archive/sprints/SPRINT-S11-claude-alignment.md
- [x] S011.T028 — Open sprint S11 and add Phase 11 to the roadmap
  .ai/tasks/S011.T028_OpenSprintS11.md
- [x] S011.T008 — Marketplace manifest over the monorepo (P0.1)
  .ai/tasks/S011.T008_MarketplaceManifest.md
- [x] S011.T009 — Anthropic provider in the eval suite (P0.2)
  .ai/tasks/S011.T009_ClaudeProviderEvals.md
- [x] S011.T010 — Resolve model tiers to Claude aliases (P0.3)
  .ai/tasks/S011.T010_ModelTierTable.md
- [x] S011.T011 — MCP hygiene: gates annotations and lock drift (P0.4)
  .ai/tasks/S011.T011_McpAnnotationsAndLockDrift.md
- [x] S011.T012 — Fix stale loop text (P0.5)
  .ai/tasks/S011.T012_StaleLoopText.md
- [?] S011.T031 — Fix the first live CI runs of the eval and tool-lock jobs
  .ai/tasks/S011.T031_FirstLiveCiFixes.md
- [x] S011.T013 — Role guard: the seven refused terms in Claude Code (P1.1, HIGH RISK)
  .ai/tasks/S011.T013_RoleGuard.md
- [x] S011.T014 — Claude Code plugins per component kind (P1.2)
  .ai/tasks/S011.T014_ClaudeCodePlugins.md
- [?] S011.T015 — Loops as invocable skills (P1.3)
  .ai/tasks/S011.T015_LoopsAsSkills.md
- [x] S011.T016 — Claude skill controls in the schema (P1.4)
  .ai/tasks/S011.T016_ClaudeSkillControls.md
- [x] S011.T017 — CLAUDE.md layer over AGENTS.md (P1.5)
  .ai/tasks/S011.T017_ClaudeMdLayer.md
- [?] S011.T018 — Ship permissions and sandbox settings (P1.6)
  .ai/tasks/S011.T018_PermissionsAndSandbox.md
- [x] S011.T019 — Stop hook runs a fast check (P1.7)
  .ai/tasks/S011.T019_StopHookFastCheck.md
- [?] S011.T020 — Grow evals to 20-50 tasks with trials (P1.8)
  .ai/tasks/S011.T020_EvalsTrialsAndGrowth.md
- [?] S011.T021 — Claude Code OpenTelemetry (P1.9)
  .ai/tasks/S011.T021_ClaudeCodeOtel.md
- [x] S011.T022 — Invert portability: Claude Code is the reference (P2.1, HIGH RISK)
  .ai/tasks/S011.T022_ClaudeReferenceProfile.md
- [?] S011.T023 — Codex port completion (P2.2)
  .ai/tasks/S011.T023_CodexPortCompletion.md
- [?] S011.T024 — Long-running harness alignment (P2.3)
  .ai/tasks/S011.T024_LongRunHarness.md
- [?] S011.T025 — Signed, versioned releases (P2.4)
  .ai/tasks/S011.T025_SignedVersionedReleases.md
- [?] S011.T026 — Agent SDK runner for unattended runs, compared on the golden run (P2.5)
  .ai/tasks/S011.T026_AgentSdkRunner.md
- [?] S011.T027 — Gates over HTTP behind OAuth 2.1, sandboxed (P2.6, HIGH RISK)
  .ai/tasks/S011.T027_GatesHttpTransport.md
- [?] S011.T001 — switchboard 0.8.0: each repo mod's loaded version beside its manifest (B-071)
  .ai/tasks/S011.T001_SwitchboardLoadedVersions.md
- [?] S011.T002 — task-compass 0.12.3: an OpenCode port on a shared core/ (B-069)
  .ai/tasks/S011.T002_TaskCompassOpencodePort.md
- [?] S011.T003 — task-compass for Codex: a plugin bundle on core/ (B-070)
  .ai/tasks/S011.T003_TaskCompassCodexPort.md
- [?] S011.T004 — Toggles draw SIGMAorbital's square switch on a desktop
  .ai/tasks/S011.T004_DesktopToggleSwitch.md
- [?] S011.T005 — switchboard 0.9.0: the pane follows the design of Compass and Agents
  .ai/tasks/S011.T005_SwitchboardDesignParity.md
- [?] S011.T006 — task-orchestrator 0.6.0: a worker stopped at its turn cap is reported, resumable, and given more turns
  .ai/tasks/S011.T006_OrchestratorTurnCap.md
- [?] S011.T007 — task-orchestrator 0.7.0: the REVIEW-0013 fixes (path fence, one admission gate, stall advice, model families, observability)
  .ai/tasks/S011.T007_OrchestratorReviewFixes.md
- [?] S011.T029 — agent-watch 0.13.5: the band and the Sessions pane agree on steps
  .ai/tasks/S011.T029_AgentWatchStepsAgree.md
  branch: agent/steps-mismatch-20eb29
- [?] S011.T030 — task-orchestrator 0.7.1: a worker that stopped itself is reopened when resumed
  .ai/tasks/S011.T030_OrchestratorResumeSelfStopped.md
- [?] S011.T032 — task-orchestrator 0.7.2: writers run through the hand-off, so the write fence sees them
  .ai/tasks/S011.T032_OrchestratorFenceLive.md
- [ ] S011.T033 — task-orchestrator: a writer is spawned, not handed off, so the fence never sees it
  .ai/tasks/S011.T033_OrchestratorWriterSpawned.md
- [?] S011.T034 — Planning skills on a forge: a state file stays, and a tag marks the removed history
  .ai/tasks/S011.T034_ForgeStateAndHistoryMarker.md

## S012 — Post-S4, no sprint open
- [x] S012.T001 — Record the LM Studio UI verification; fix the WORKSPACE_ROOT placeholder trap
  .ai/tasks/S012.T001_LmStudioUiVerified.md
- [x] S012.T002 — Close B-001; fix the registry content defects found while scoping it
  .ai/tasks/S012.T002_CloseB001RegistryIntegrity.md
- [x] S012.T003 — Retract the false default-branch mismatch claim
  .ai/tasks/S012.T003_RetractDefaultBranchClaim.md

## S013 — Post-S5, no sprint open
- [x] S013.T001 — Unify `.ai/decisions/` filenames on the `NNNN-*` scheme
  .ai/tasks/S013.T001_UnifyDecisionFilenames.md
- [x] S013.T002 — Close B-009: the two skills scaffold different frameworks, by design
  .ai/tasks/S013.T002_TwoGovernanceFrameworks.md

## S014 — Post-S8, no sprint open
- [x] S014.T001 — Sweep stale second-hand claims: the gate's cost and the drifted Ansible toolchain
  .ai/tasks/S014.T001_StaleSecondHandClaimsSweep.md
- [x] S014.T002 — One worktree per agent session, and the exec bits that make a worktree work
  .ai/tasks/S014.T002_WorktreePerSessionIsolation.md
- [x] S014.T003 — A `test-allowlist` capability term, so `qa-test` can run what it claims to run
  .ai/tasks/S014.T003_TestAllowlistVocabularyTerm.md
- [x] S014.T004 — Deploy skills to Bionic's project target, and leave its global target alone
  .ai/tasks/S014.T004_BionicProjectSkillsTarget.md
- [x] S014.T005 — When an MCP server owes a per-client wiring section, and when it does not
  .ai/tasks/S014.T005_WiringSectionRule.md

## S015 — Post-S9, no sprint open
- [x] S015.T001 — One guard pair for both command allowlists, and a correction to TASK-0071
  .ai/tasks/S015.T001_CommandAllowlistEntryGuards.md
- [x] S015.T002 — A delegate must exist for every client its caller is emitted for
  .ai/tasks/S015.T002_DelegatesToCrossClientGate.md

## S016 — Post-S10, no sprint open
- [x] S016.T001 — B-035: embed the adjudicator's decision standard in its prompt
  .ai/tasks/S016.T001_EmbedTheDecisionStandard.md
- [x] S016.T002 — Settle `worktree-only`'s Claude Code emission (ADR-0018 clause 7)
  .ai/tasks/S016.T002_WorktreeOnlyClaudeCodeEmission.md
- [x] S016.T003 — Re-count the `ansible-core` version claims, then act on the count
  .ai/tasks/S016.T003_AnsibleCoreVersionRecount.md
- [x] S016.T004 — Give artifact shape one owner, and generate the skeleton instead of copying a template
  .ai/tasks/S016.T004_ArtifactSchemaOneOwner.md
- [x] S016.T005 — Migrate the repository onto the artifact schemas
  .ai/tasks/S016.T005_MigrateRepoOntoSchemas.md
- [x] S016.T007 — The Claude Code binding's own consistency check fails, and no gate noticed
  .ai/tasks/S016.T007_ClaudeCodeBindingSuiteIsRed.md
- [x] S016.T013 — Repair four stale claims in the planning ledger
  .ai/tasks/S016.T013_RepairThePlanningLedger.md
- [x] S016.T006 — Can a worktree-isolated Claude Code subagent reach the main checkout by absolute path?
  .ai/tasks/S016.T006_WorktreeAbsolutePathReach.md
- [x] S016.T008 — Run the Claude Code unattended binding against a real run, once
  .ai/tasks/S016.T008_ClaudeCodeBindingFirstRealRun.md
- [x] S016.T009 — Test ADR-0022's two untested falsifiers, F7 and F9
  .ai/tasks/S016.T009_Adr0022F7AndF9.md
- [x] S016.T010 — Re-run ADR-0014's "53 rules / 0 violations" under ansible-core 2.21.4
  .ai/tasks/S016.T010_RecountAdr0014LintFigure.md
- [x] S016.T011 — Exercise skills/ansible-ops against the live estate, once
  .ai/tasks/S016.T011_ExerciseAnsibleOpsLive.md
- [x] S016.T012 — Make the artifact generator reachable from project-migration alone
  .ai/tasks/S016.T012_ArtifactGeneratorReachableFromMigration.md
- [x] S016.T014 — Generate the scaffold's planning templates from the schemas that own them
  .ai/tasks/S016.T014_ScaffoldTemplatesFromSchemas.md
- [x] S016.T015 — Settle whether a migrated repository can regenerate its templates
  .ai/tasks/S016.T015_MigratedRepoCannotRegenerate.md
- [x] S016.T016 — The evidence line carries no figure, so the closer cannot copy one
  .ai/tasks/S016.T016_EvidenceLineCarriesNoFigure.md
- [x] S016.T017 — An agile dashboard for the .ai governance layer
  .ai/tasks/S016.T017_ProjectWorkflowDashboard.md
- [x] S016.T018 — Publish the dashboard from CI to GitHub Pages
  .ai/tasks/S016.T018_PublishTheDashboardFromCi.md
- [x] S016.T019 — Tell someone when CI fails
  .ai/tasks/S016.T019_TellSomeoneWhenCiFails.md
- [x] S016.T020 — Retire this repo's dashboard generator for the vendored canonical one
  .ai/tasks/S016.T020_OneDashboardVendoredFromSource.md
- [x] S016.T021 — Make the intranet GitLab the primary remote
  .ai/tasks/S016.T021_MakeGitlabThePrimaryRemote.md
- [x] S016.T022 — Ship GitHub Pages and GitLab Pages as optional dashboard destinations
  .ai/tasks/S016.T022_DashboardPublishingDestinations.md
- [x] S016.T023 — Record why only CI builds the published dashboard
  .ai/tasks/S016.T023_CiBuildsThePublishedDashboard.md
- [x] S016.T024 — Rebuild the published dashboard daily from a separate dispatcher
  .ai/tasks/S016.T024_DailyDashboardDispatcher.md
- [x] S016.T025 — Close the CI alert only when no watched workflow is red
  .ai/tasks/S016.T025_CiAlertClosesOnlyWhenNothingIsRed.md
- [x] S016.T026 — Source secrets from the intranet Vault; keep the environment as the interface
  .ai/tasks/S016.T026_SecretsFromVault.md
- [x] S016.T027 — Give ai-toolbox an AppRole identity; read several secret maps
  .ai/tasks/S016.T027_ApproleIdentity.md
- [x] S016.T028 — Ignore every .env variant, not only .env (B-053)
  .ai/tasks/S016.T028_IgnoreEveryEnvFile.md
- [x] S016.T029 — The estate's ansible-vault password comes from Vault (B-052)
  .ai/tasks/S016.T029_VaultPasswordFromVault.md
- [x] S016.T030 — worktree.sh remove deletes a landed branch and reports honestly (B-049)
  .ai/tasks/S016.T030_WorktreeRemoveReportsHonestly.md
- [x] S016.T031 — State that the resume guard must never search --all (B-045)
  .ai/tasks/S016.T031_ResumeGuardNeverAll.md
- [x] S016.T032 — Name what loops/ansible-change needs from a Claude Code session (B-046)
  .ai/tasks/S016.T032_AnsibleChangeClaudeCodePrerequisite.md
- [x] S016.T033 — Give role 5 a derived verdict for task-loading actions (B-050)
  .ai/tasks/S016.T033_ControlFlowFidelityCarveOut.md
- [x] S016.T034 — Make the generated banners true in every repository they reach (B-051)
  .ai/tasks/S016.T034_BannersTrueOutsideAiToolbox.md
- [x] S016.T035 — Let the Claude Code binding be pointed at a repository (B-044)
  .ai/tasks/S016.T035_ClaudeCodeBindingRepoRoot.md
- [x] S016.T036 — Run both unattended-run binding suites in CI (B-037)
  .ai/tasks/S016.T036_CiRunsTheBindingSuites.md
- [x] S016.T037 — Gate that a closed backlog row names a closer that agrees (B-038)
  .ai/tasks/S016.T037_ClosedBacklogRowsNameTheirCloser.md
- [x] S016.T038 — Close B-025 as deferred until a second role wants the term
  .ai/tasks/S016.T038_DeferB025.md
- [x] S016.T039 — Report the estate's stale ansible.cfg claims to the estate (B-039)
  .ai/tasks/S016.T039_ReportAnsibleCfgClaimsToTheEstate.md
- [x] S016.T040 — Gate BACKLOG.md's open-item count against the rows (B-047)
  .ai/tasks/S016.T040_GateTheOpenItemCount.md
- [x] S016.T041 — Give the plan kind a schema, transcribed from the six plans (B-042, part 1)
  .ai/tasks/S016.T041_PlanSchemaFromTheSixPlans.md
- [x] S016.T042 — Give the backlog entry a schema that owns its columns (B-042, part 2)
  .ai/tasks/S016.T042_BacklogEntrySchema.md
- [x] S016.T043 — Document intranet TLS on a Windows host in the runbook
  .ai/tasks/S016.T043_IntranetTlsOnWindows.md
- [x] S016.T044 — `vault_secrets.py exec` waits for its command on Windows
  .ai/tasks/S016.T044_VaultExecOnWindows.md
- [x] S016.T045 — Git is the record: ADR-0033 and one commit per task
  .ai/tasks/S016.T045_GitIsTheRecord.md
- [x] S016.T046 — Artifact line budgets and frozen v1 schemas
  .ai/tasks/S016.T046_ArtifactBudgetsAndLegacySchemas.md
- [x] S016.T047 — project-migration v2: concise task and ADR schemas
  .ai/tasks/S016.T047_ProjectMigrationV2Schemas.md
- [x] S016.T048 — Compact the live files to state only
  .ai/tasks/S016.T048_CompactLiveFiles.md
- [x] S016.T049 — project-workflow 6.0.0: concise schemas, docs and fixtures
  .ai/tasks/S016.T049_ProjectWorkflowConcise.md
- [x] S016.T050 — Declare a project's secrets backend: secrets.conf, init, the local backend
  .ai/tasks/S016.T050_SecretsBackendDeclaration.md
- [x] S016.T051 — Provision a Vault project's own KV mount, policies and AppRole
  .ai/tasks/S016.T051_VaultProjectProvision.md
- [x] S016.T052 — Set and check GitLab CI variables and GitHub Actions secrets
  .ai/tasks/S016.T052_CiBackendPutCheck.md
- [x] S016.T053 — Let project-migration migrate secrets, and import an old env file
  .ai/tasks/S016.T053_MigrateSecrets.md
- [x] S016.T054 — Rebuild the dashboard at plan approval and on push; ask about Pages
  .ai/tasks/S016.T054_DashboardRebuildAndPublishingQuestion.md
- [x] S016.T055 — `install.sh link` really links on Windows; `--status` reports
  .ai/tasks/S016.T055_InstallLinksReallyLinkOnWindows.md
- [x] S016.T056 — `vendor-skill.sh`: per-project skill copies with a manifest
  .ai/tasks/S016.T056_VendorSkillWithAManifest.md
- [x] S016.T057 — Keep internal host names out of tracked files
  .ai/tasks/S016.T057_PrivateNamesOutOfTrackedFiles.md
- [x] S016.T058 — Push to `origin` over `https://` with a per-command rewrite
  .ai/tasks/S016.T058_PushOriginOverHttps.md
- [x] S016.T059 — Selective install: choose which components `install.sh` deploys
  .ai/tasks/S016.T059_SelectiveInstall.md
- [x] S016.T060 — Keep the gate's throwaway `git init` out of the real repository
  .ai/tasks/S016.T060_GateInitCannotReachTheRealRepo.md
- [x] S016.T061 — Re-point `origin` to `https://`; amend ADR-0028
  .ai/tasks/S016.T061_RepointOriginToHttps.md
- [x] S016.T062 — `repo-inventory` skill: every git repository under a root, and what is not pushed
  .ai/tasks/S016.T062_RepoInventorySkill.md
- [x] S016.T063 — Publish the dashboard to GitLab Pages as well, rebuilt daily by a schedule
  .ai/tasks/S016.T063_GitlabPagesDashboard.md
- [x] S016.T064 — Stop reading three retired secrets, so SIGMA-infrastructure can retire them
  .ai/tasks/S016.T064_StopReadingRetiredSecrets.md
- [x] S016.T065 — Let GitLab push the public mirror, so agents push `origin` only
  .ai/tasks/S016.T065_GitlabPushMirrorToGithub.md
- [x] S016.T066 — Each project declares its work tracker: files, GitLab or GitHub
  .ai/tasks/S016.T066_WorkTrackerDeclaration.md
- [x] S016.T067 — Run the unattended loop on a forge tracker
  .ai/tasks/S016.T067_UnattendedRunOnAForgeTracker.md
- [x] S016.T068 — Gate the Agent Skills spec's length and name limits
  .ai/tasks/S016.T068_SkillSpecLimits.md
- [x] S016.T069 — Make the session-start reading chain short and consistent
  .ai/tasks/S016.T069_LeanSessionStartContext.md
- [x] S016.T070 — Track unexercised capability as backlog rows, and cap it
  .ai/tasks/S016.T070_CapUnexercisedCapability.md
- [x] S016.T071 — Exercise the GitLab tracker and a forge unattended run for real
  .ai/tasks/S016.T071_ExerciseTheGitlabTracker.md
- [x] S016.T072 — Merge claude-mods, and develop mods here from now on
  .ai/tasks/S016.T072_MergeClaudeMods.md
- [x] S016.T073 — Design how task-compass reads a project's .ai/ planning
  .ai/tasks/S016.T073_CompassReadsAiPlanningDesign.md
- [x] S016.T074 — Compass reads a project's .ai/ planning
  .ai/tasks/S016.T074_CompassReadsAiPlanning.md
- [x] S016.T075 — Compass keeps GOALS.md under .ai/
  .ai/tasks/S016.T075_CompassGoalsUnderAi.md
- [x] S016.T076 — agent-watch: a subagents pane and a task-progress band
  .ai/tasks/S016.T076_AgentWatchMod.md
- [x] S016.T077 — agent-watch 0.2.0: live activity, failure alerts, band interactions
  .ai/tasks/S016.T077_AgentWatchLive.md
- [x] S016.T079 — Harmonize every task into .ai/GOALS.md, and make keeping it current a rule
  .ai/tasks/S016.T079_GoalsMdHarmonized.md
- [x] S016.T078 — task-orchestrator: a mod that routes delegated work by model and effort
  .ai/tasks/S016.T078_TaskOrchestratorMod.md
- [x] S016.T080 — switchboard: one mod that turns mods, skills and connectors on and off
  .ai/tasks/S016.T080_SwitchboardMod.md
- [x] S016.T081 — switchboard 0.2.0: every mod in the pane, with On/Off toggle buttons
  .ai/tasks/S016.T081_SwitchboardToggles.md
- [x] S016.T082 — switchboard 0.3.0: a switch-style toggle, skills listed, app servers protected
  .ai/tasks/S016.T082_SwitchboardSwitch.md
- [x] S016.T083 — SIGMAorbital for mods: one shared design module, its gate, ADR-0043
  .ai/tasks/S016.T083_SigmaorbitalModDesign.md
- [x] S016.T084 — agent-watch 0.3.0 on SIGMAorbital
  .ai/tasks/S016.T084_AgentWatchSigmaorbital.md
- [x] S016.T085 — task-compass 0.4.0 on SIGMAorbital
  .ai/tasks/S016.T085_TaskCompassSigmaorbital.md
- [x] S016.T086 — task-orchestrator 0.2.0 on SIGMAorbital
  .ai/tasks/S016.T086_TaskOrchestratorSigmaorbital.md
- [x] S016.T087 — switchboard 0.4.0 on SIGMAorbital
  .ai/tasks/S016.T087_SwitchboardSigmaorbital.md
- [x] S016.T088 — agent-watch 0.4.0: sessions, sub-sessions and their subagents
  .ai/tasks/S016.T088_AgentWatchSessions.md
- [x] S016.T089 — task-orchestrator 0.3.0: a spawn auto mode refuses can be retried or handed off
  .ai/tasks/S016.T089_OrchestratorAutoModeSpawn.md
- [x] S016.T090 — agent-watch 0.4.1: a subagent ends on its own turn (B-066)
  .ai/tasks/S016.T090_AgentWatchTurnEnd.md
- [x] S016.T091 — task-compass 0.5.0: the Subagents panel follows the orchestrator
  .ai/tasks/S016.T091_CompassOrchestrator.md
- [x] S016.T092 — task-compass 0.6.0: the Sessions tree, from agent-watch
  .ai/tasks/S016.T092_CompassSessionsTree.md
- [x] S016.T093 — task-compass 0.7.0: a sunburst of the Sessions tree
  .ai/tasks/S016.T093_CompassSunburst.md
- [x] S016.T094 — task-compass 0.8.0: the Sessions panel as a status sunburst
  .ai/tasks/S016.T094_CompassStatusSunburst.md
- [x] S016.T095 — task-orchestrator 0.4.0: honour a model and effort the person names
  .ai/tasks/S016.T095_OrchestratorNamedSettings.md
- [x] S016.T096 — task-orchestrator 0.5.0: session workers (ADR-0050 proposed)
  .ai/tasks/S016.T096_OrchestratorSessionWorkers.md
- [x] S016.T097 — task-orchestrator 0.4.1: adopt a hand-off by its assignment
  .ai/tasks/S016.T097_OrchestratorAdoptByAssignment.md
- [x] S016.T098 — task-orchestrator 0.4.2: hand off on the role's profile, the effort on the call
  .ai/tasks/S016.T098_OrchestratorHandoffOnRoleProfile.md
- [x] S016.T099 — agent-watch 0.4.3, task-compass 0.8.1: an open session is idle, never done
  .ai/tasks/S016.T099_MainSessionIdleNotDone.md
- [x] S016.T100 — agent-watch 0.5.0: it draws the Sessions panel itself
  .ai/tasks/S016.T100_AgentWatchSessionsPanel.md
- [x] S016.T101 — task-compass 0.9.0, agent-watch 0.6.0: Compass's pane carries agent-watch's panel and meter
  .ai/tasks/S016.T101_CompassSlotsAgentWatch.md
- [x] S016.T102 — agent-watch 0.7.0: the Sessions panel shows background tasks
  .ai/tasks/S016.T102_AgentWatchBackgroundTasks.md
- [x] S016.T103 — An allowlisted role runs one shell command per call
  .ai/tasks/S016.T103_OneCommandPerCall.md
- [x] S016.T104 — The OpenCode driver records what changed, and parks by namespace
  .ai/tasks/S016.T104_DriverRecordsTheChange.md
- [x] S016.T105 — task-compass 0.9.1: shorter carousel labels
  .ai/tasks/S016.T105_CompassShortNavLabels.md
- [x] S016.T106 — task-orchestrator's collect answers within its hook's budget
  .ai/tasks/S016.T106_CollectWithinBudget.md
- [x] S016.T107 — task-orchestrator cancels a handed-off task (B-068)
  .ai/tasks/S016.T107_CancelAHandoff.md
- [x] S016.T108 — agent-watch 0.8.0: the band follows the run
  .ai/tasks/S016.T108_AgentWatchBandFollowsTheRun.md
- [x] S016.T109 — agent-watch 0.8.1: a gap under the board, the KPI row kept on the desktop
  .ai/tasks/S016.T109_AgentWatchGapAndKpis.md
- [x] S016.T110 — Preview mod panes in a browser; copy mods into a session
  .ai/tasks/S016.T110_PreviewModPanes.md
- [x] S016.T112 — Mod preview 2: real surfaces, presses and sizes, snapshots, shared fixtures
  .ai/tasks/S016.T112_ModPreviewRefined.md
- [x] S016.T111 — One workflow for developing mods, with a chart and a skill
  .ai/tasks/S016.T111_ModDevelopmentWorkflow.md
- [x] S016.T113 — switchboard 0.5.0: mods and skills grouped by topic, in SIGMAorbital
  .ai/tasks/S016.T113_SwitchboardTopicGroups.md
- [x] S016.T115 — install.sh writes the mod list Claude Code loads, and --status reports it
  .ai/tasks/S016.T115_InstallModPluginDirs.md
- [x] S016.T114 — task-compass 0.10.0, agent-watch 0.9.0: drag handles size the Sprints and Sessions panels
  .ai/tasks/S016.T114_PaneDragHandles.md
- [x] S016.T116 — Every pane panel is resizable, from one shared panel; mods are built from shared parts
  .ai/tasks/S016.T116_SharedResizablePanel.md
- [x] S016.T119 — task-orchestrator 0.5.2: fewer coordinator tokens
  .ai/tasks/S016.T119_OrchestratorTokenEconomy.md
- [x] S016.T117 — task-orchestrator 0.5.3: model routing fixes
  .ai/tasks/S016.T117_OrchestratorModelRouting.md
- [x] S016.T118 — task-orchestrator 0.5.4: a misclassification hint, and the session gate's effort from settings
  .ai/tasks/S016.T118_OrchestratorOpenItems.md
- [x] S016.T120 — vault-secrets 2.3.1: judge an AppRole file on Windows by its access list
  .ai/tasks/S016.T120_VaultApproleOnWindows.md
- [x] S016.T121 — The OpenCode driver tells a permission denial from another tool error (B-067)
  .ai/tasks/S016.T121_DriverTellsDenialsFromErrors.md
- [x] S016.T122 — task-compass's README shows the pane on the desktop and in a terminal (B-064)
  .ai/tasks/S016.T122_CompassReadmeScreenshots.md
- [x] S016.T123 — agent-watch: the band above the prompt shows the orchestrator's state, idle included
- [x] S016.T124 — task-compass: the Sessions panel shows under the board in either load order
- [x] S016.T125 — agent-watch 0.11.1: the STATE cell's glyph and word on one line
  .ai/tasks/S016.T125_StateCellOneLine.md
- [x] S016.T126 — Per-harness mod layout: mods/<name>/claude/ today, core/ and other harnesses later (ADR-0054)
  .ai/tasks/S016.T126_PerHarnessModLayout.md
- [x] S016.T127 — task-orchestrator 0.5.5: collect always answers, and about the right tasks
  .ai/tasks/S016.T127_OrchestratorCollectAlwaysAnswers.md
- [x] S016.T128 — The repository gate passes on a Windows host
  .ai/tasks/S016.T128_GatePassesOnWindows.md
- [x] S016.T129 — task-orchestrator 0.5.6: collect waits for sessions only
  .ai/tasks/S016.T129_OrchestratorCollectNoWait.md
- [x] S016.T130 — The merged gate checks from origin pass on a Windows host
  .ai/tasks/S016.T130_RemoteGateChecksOnWindows.md
- [x] S016.T131 — agent-watch 0.11.2, task-orchestrator 0.5.7: the rows survive a forced plugin reload
  .ai/tasks/S016.T131_RowsSurviveForcedReload.md
- [x] S016.T132 — task-orchestrator 0.5.8: ledger writes race-free, worker text framed, state scoped, the hand-off a first-class state
  .ai/tasks/S016.T132_OrchestratorLedgerRacesAndTrust.md
- [x] S016.T135 — agent-watch 0.11.3, 0.12.0: PowerShell background shells, and step progress of a background run
  .ai/tasks/S016.T135_BackgroundPowershellAndStepProgress.md
- [x] S016.T136 — agent-watch 0.12.1: each session keeps its rows under its own store key
  .ai/tasks/S016.T136_AgentWatchRowsPerSession.md
- [x] S016.T133 — Every mod takes a theme argument: dark, light or auto
  .ai/tasks/S016.T133_ModsThemeArgument.md
- [x] S016.T134 — agent-watch and task-compass read cleanly in Daylight, as SIGMAorbital specifies
  .ai/tasks/S016.T134_DaylightReadability.md
- [x] S016.T137 — Pressable overlays no longer paint the desktop's `…` over their words
  .ai/tasks/S016.T137_PressableOverlayEllipsis.md
- [x] S016.T139 — Session-issued Vault project tokens and native keychain daily session
  .ai/tasks/S016.T139_VaultSessionProjectTokens.md
- [x] S016.T138 — The mod preview's sidebar hides and shows from a button
  .ai/tasks/S016.T138_PreviewSidebarToggle.md
- [x] S016.T140 — Session branches are named by task, and Claude Code's worktrees follow the sibling rule (B-061)
  .ai/tasks/S016.T140_TaskBranchesAndClaudeWorktrees.md
  branch: agent/TASK-0261
- [x] S016.T141 — Scripts are checked out with LF, so a Linux bash on a Windows clone runs them
  .ai/tasks/S016.T141_ScriptsCheckedOutLf.md
  branch: agent/TASK-0262
- [x] S016.T142 — Landing docs push origin only, and briefs use the schema's review status
  .ai/tasks/S016.T142_LandingAndStatusDrift.md

## S017 — One planning convention
Goal: Both planning skills use one convention, project-workflow's numbered layout; see .ai/decisions/ADR-0066-one-planning-convention.md
- [?] S017.T001 — Record one planning convention in ADR-0066, superseding ADR-0013
  .ai/tasks/S017.T001_OnePlanningConventionAdr.md
- [?] S017.T002 — The dashboard is owned here and reads ADR-NNNN file names and the id map
  .ai/tasks/S017.T002_DashboardAdrPrefixUpstream.md
- [!] S017.T003 — project-workflow 8.0.0: ADR-NNNN file names, the hybrid brief, and current-state and session schemas
  .ai/tasks/S017.T003_WorkflowAdrPrefixAndSchemas.md
- [?] S017.T004 — A migrate-layout tool that moves a project-migration repo onto the one convention, dry run by default
  .ai/tasks/S017.T004_MigrateLayoutTool.md
- [?] S017.T005 — The gate and scripts accept both layouts during the switch
  .ai/tasks/S017.T005_GateAcceptsBothLayouts.md
- [?] S017.T006 — Move ai-toolbox onto the one convention in one commit
  .ai/tasks/S017.T006_RenameAiToolbox.md
- [ ] S017.T007 — Drop the old layout's support from the gate, and update AGENTS.md and the docs
  .ai/tasks/S017.T007_DropOldLayoutSupport.md
- [ ] S017.T008 — project-migration 6.0.0 retrofits repositories into the one convention
  .ai/tasks/S017.T008_MigrationRetarget.md
- [ ] S017.T009 — Check the dashboard and Compass against the id map after the switch
  .ai/tasks/S017.T009_VerifyDashboardAndCompass.md

## Backlog — open items
Goal: Waiting on the human or on a real run; see .ai/35.AD_HOC_TASKS.md
- B-057 Unexercised: secrets `provision`, and `put` to GitLab and GitHub (`S016.T051`, `S016.T052`)
  .ai/35.AD_HOC_TASKS.md
- B-058 Unexercised: an `ansible-ops` guest-level change behind a real PVE snapshot (`S016.T011`)
  .ai/35.AD_HOC_TASKS.md
- B-062 asset-management's vendored `project-workflow` predates `vendor-skill.sh` and is behind 7.1.2
  .ai/35.AD_HOC_TASKS.md
- B-063 Estate repository work waiting on the human: LDAP config drift, estate `#96` (both pushes landed)
  .ai/35.AD_HOC_TASKS.md
- B-072 Mods cannot follow the desktop app's light/dark switch: no signal reaches a hook
  .ai/35.AD_HOC_TASKS.md
- B-074 Unexercised: project-token handoff to the isolated agent launcher
  .ai/35.AD_HOC_TASKS.md
