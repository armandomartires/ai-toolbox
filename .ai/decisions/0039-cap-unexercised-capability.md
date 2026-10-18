# ADR-0039 — Unexercised capability is a backlog row, and at most three are open

**Status**: accepted
**Date**: 2026-10-18
**Task**: `TASK-0175`

## Context

Lesson 5 in `CURRENT_STATE.md` says an unexercised artifact is the most reliable failure mode. Even so, on 2026-10-18 five capabilities had been proven against stubs only or never run: the forge trackers (`TASK-0171`, `TASK-0172`, built on a host with neither `glab` nor `gh`), the live secrets backends (`TASK-0156`, `TASK-0157`), two OpenCode binding protections added after the pilot (`TASK-0097`, `TASK-0098`), `ansible-ops` on a real PVE snapshot, and Bionic under `ADR-0022` F8.

They lived as prose under *Open items* in `CURRENT_STATE.md`, which nothing counts, while `BACKLOG.md` read "Zero items are open". After Phase 10 closed, new surface kept landing while these stayed open. The human asked for a mechanism (review of 2026-10-18, correction 3).

## Decision

1. **An unexercised capability is an open backlog row** whose title starts `Unexercised:`. Its *Ready when* names what would exercise it, and who must act.
2. **A task whose capability it cannot exercise itself adds that row** in its own commit.
3. **At most 3 such rows are open.** `scripts/check-backlog-closures.py` fails the gate on a 4th. At the cap, a task that adds capability first exercises or retires one.
4. **Exercising closes the row** with the task that ran it for real. **Retiring closes it too**: the claim is withdrawn where it is made and the feature is marked experimental, with no code deleted.
5. **The cap is chosen, not derived.** The human set it at 3. Raising it takes an amendment to this ADR.
6. On the human's decision of 2026-10-18, **two of the five were retired**: Bionic F8 (Bionic leaves the authored-MCP claim) and the OpenCode binding's two post-pilot protections, the bulk-staging halt (`TASK-0097`) and the gate map kept out of the roles' reach (`TASK-0098`). Those two are now described as stub-proven, not enforced in a real run. The binding itself stays: it ran for real in the S10 pilot and remains the primary one. The other three rows stay open, so the cap is reached the day this lands.

## Alternatives considered

- **A status column or tag.** Changing the backlog schema's `columns:` touches every vendored copy of the schema; a title prefix needs no schema change.
- **A freeze with no number.** Lesson 3: a rule nobody measures is not one.
- **Cap 5, ratcheting down.** This keeps today's level; the human chose to force resolution instead.

## Consequences

- The next capability task must first exercise or retire a row: forge trackers, live secrets backends, or the `ansible-ops` PVE snapshot.
- A prefix is a weak type: a row can dodge the cap through its title. The check counts and does not audit; review catches the rest.
- `CURRENT_STATE.md` no longer lists open items. It points to the backlog, which is their one owner.
