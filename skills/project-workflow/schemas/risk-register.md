---
kind: risk-register
framework: project-workflow
id_placeholder: risk-register
filename_pattern: 40.RISK_REGISTER.md
title_pattern: Risk register
allow_extra: true
---

# 40.RISK_REGISTER.md (ADR-0066): a table of risks plus a dated review. The
# shape mirrors ai-toolbox's own register (.ai/40.RISK_REGISTER.md).
# The `## Last reviewed` section is the gate: a register that was never
# reviewed fails the check, so the date cannot be omitted.

!preamble
!terse
open risks, rated, with their controls and owners
!standard
One row per risk, rated on a 1-3 scale (L, M, H) for likelihood and impact.
Walk the open rows at every sprint review checkpoint and update the date
under "Last reviewed".
!literal
Add one table row per risk. At each sprint review, check every open row,
update its ratings and status, then write today's date under "Last reviewed".
!body

## Last reviewed
!phase after
!required true
!terse
the date the open rows were last walked
!standard
A date (YYYY-MM-DD), then in brackets why: the review or event that set it.
!literal
Write the date as YYYY-MM-DD and, in brackets, the review that set it.
!body
YYYY-MM-DD (initial register)

## Register
!phase before
!required true
!terse
the risk table
!standard
Columns: ID, Component, Risk, Likelihood, Impact, Controls today, Treatment
and owner, Status. Status is Open, Monitored, Mitigated or Accepted.
!literal
One row per risk, using the columns of the table below. Likelihood and
Impact are each L, M or H.
!body
| ID | Component | Risk | L | I | Controls today | Treatment / owner | Status |
|---|---|---|---|---|---|---|---|
| R-01 | | | | | | | Open |

## Out of scope
!phase before
!required false
!standard
Risks deliberately not tracked, with the reason, so their absence is not
mistaken for an oversight.
!literal
List each untracked risk class and one sentence on why it is excluded.
!body
- none
