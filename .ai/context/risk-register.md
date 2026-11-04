# AI risk register

Issue #13 (N4 in `docs/reports/2026-11-04-standards-remediation.md`).
Maps ai-toolbox's components to the NIST AI RMF functions (GOVERN, MAP,
MEASURE, MANAGE), NIST AI 600-1 generative-AI risks, and ISO/IEC 42001
clause 6.1 (actions to address risks). Ratings are this register's own
1-3 scale (L, M, H) for likelihood and impact on the person's machine,
repositories and credentials.

**Review:** at every sprint review checkpoint (`.ai/reviews/`), walk the
open rows, update ratings and status, and set *Last reviewed*. A new
component kind, MCP server or unattended capability adds a row before it
merges.

Last reviewed: 2026-11-04 (initial register, from the standards report)

## Register

| ID | Component | Risk | AI 600-1 risk | RMF | L | I | Controls today | Treatment / owner issue | Status |
|---|---|---|---|---|---|---|---|---|---|
| R-01 | `agents/`, `loops/`, `skills/*/SKILL.md` | Prompt injection via tool output, issue text or web content steers a role | Information Security | MAP 5.1, MANAGE 2.4 | M | H | Untrusted-content policy (#8, draft MR); adversarial refuter/adjudicator | Finish #8 (gate-output schemas), score with #10 | Open |
| R-02 | Instruction files | Hidden/bidi Unicode or unreviewed edits to instruction files | Information Security; Information Integrity | GOVERN 1.4 | L | H | Hidden-Unicode check in validate.sh; CODEOWNERS (#4, merged) | Require code-owner approval on `master` (project setting, Armando) | Mitigated, setting pending |
| R-03 | `mcp-servers/gates` | `start_gate` runs any command a consuming repo's gate map declares | Information Security | MANAGE 2.4 | M | H | Gates take a name only, not a command | #6: allowlist, hash-pinned map, sandbox | Open |
| R-04 | `mcp-servers/ansible`, `mcp-servers/graphify` | External servers via `npx -y`: unpinned code, tool-definition drift, open egress | Value Chain and Component Integration; Information Security | MAP 4.1, MANAGE 3.1 | M | H | npm versions pinned in `server.json` | #7: integrity-pinned installs, tool hashing, containers | Open |
| R-05 | `loops/unattended-run`, `skills/unattended-ops` | Unattended run on the dev host with user credentials and open egress | Information Security; Human-AI Configuration | MANAGE 2.4 | M | H | One-writer preflight, worktrees, stop before push, Vault exec | #11: disposable sandbox, short-lived AppRole | Open |
| R-06 | `skills/vault-secrets`, CI | Secret disclosure in commits, logs or agent context | Data Privacy; Information Security | MANAGE 2.2 | L | H | Vault exec without reading values; gitleaks in hook and both CIs (#3, merged) | Install gitleaks in `scripts/install.sh` so the hook always runs | Mitigated |
| R-07 | GitHub Actions, mods, `uv.lock` | Supply chain: mutable dependencies, no SBOM or signed releases | Value Chain and Component Integration | GOVERN 6.1, MAP 4.1 | M | M | Actions SHA-pinned + Dependabot (#2, merged); `uv.lock` | #12: SBOM, provenance, signing, Renovate | Partly mitigated |
| R-08 | `mods/*` | Features ship to users before they are seen live | Confabulation (claims of verification); Human-AI Configuration | MEASURE 2.3 | M | M | READMEs list "not yet seen live" items | #5 + #9: experimental status and a live-verification gate | Open (needs decision) |
| R-09 | Role and loop quality across models | Regressions in verdicts, refuter recall or injection resistance go unmeasured | Confabulation; Information Integrity | MEASURE 1.1, MEASURE 2.5 | M | M | Unit and contract tests only | #10: eval suite with thresholds | Open |
| R-10 | `agents/run-scribe`, `mods/task-orchestrator` | Run history can be edited after the fact; no structured telemetry | Information Integrity | MEASURE 3.1, MANAGE 4.1 | L | M | Run journal, agent-watch panes | #14: OTel spans, hash-chained journal | Open |
| R-11 | Human approval steps | Approvals live in prose and relayed chat, not enforced by tooling | Human-AI Configuration | GOVERN 3.2 | M | M | Loops stop before push; ops-log records each action with its approval | Required approvals and "Pipelines must succeed" on `master` (settings, Armando) | Open |
| R-12 | Model behaviour in roles | Over-reliance: a green report is trusted without evidence | Human-AI Configuration; Confabulation | MEASURE 2.8 | M | M | Evidence rules (`skills/unattended-ops/references/evidence.md`), refuter defaults to refuted | Covered by #10 measurements | Monitored |

## Out of scope for this register

Model-provider risks (training data, CBRN, harmful bias in base models):
ai-toolbox consumes hosted models and controls none of their training.
They are accepted at the provider-selection level, not tracked per row.
