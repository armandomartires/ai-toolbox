// The ledger mirrored into `$.store`, so a `/reload-plugins --force`, which
// drops the plugin's `$.state` values with its instance, does not lose the
// run. A plain reload keeps `$.state` (the engine's types: "plain data that
// survives a hot reload of the plugin's code"); the forced one, seen live on
// 2026-11-06, left `status` saying `No task in the ledger` mid-run. Write-
// through on each change, and only when the rows changed; restored at
// `session.start` when the ledger is empty and the stored rows belong to this
// session id, never from another session.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Assignment } from './contract'
import type { Ledger, Task } from './ledger'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
const unavailable = atom({ plugin: 'task-orchestrator', key: 'unavailable' } as const, [])

/** The store key prefix a run is kept under: `<prefix>:<session id>`, one entry per session, so two sessions of one person never write over each other (TASK-0239). */
export const STORE_RUN = 'task-orchestrator:run'

/** The store key of a session's run. */
export const runKey = (sessionId: string): string => `${STORE_RUN}:${sessionId}`

/** What the store holds: the session the run belongs to, its rows, the refused models and each task's assignment. */
export type KeptRun = {
  sessionId: string
  ledger: Ledger
  unavailable: string[]
  assignments: Record<string, Assignment>
}

/** The most characters of one report field the kept copy holds; the live ledger keeps the whole report. */
export const KEPT_FIELD_CAP = 2_000
const TRUNCATED = '…[truncated]'

/** `text` cut to KEPT_FIELD_CAP with the cut marked; a text already that short, a capped one included, is returned as it is. */
const capped = (text: string): string => (text.length > KEPT_FIELD_CAP ? `${text.slice(0, KEPT_FIELD_CAP - TRUNCATED.length)}${TRUNCATED}` : text)

/** A row as the store keeps it: its report's long fields capped (the prompt stays whole: a queued task starts from it). */
const keptRow = (task: Task): Task =>
  task.report ? { ...task, report: { ...task.report, findings: capped(task.report.findings), files: capped(task.report.files), checks: capped(task.report.checks), evidence: capped(task.report.evidence), risks: capped(task.report.risks) } } : task

/** This session's id, read once at `session.start`; unset, nothing is kept. */
let sessionId: string | undefined
/** The JSON last written, so an unchanged run costs no store write. */
let lastKept: string | undefined

const isKept = (value: unknown): value is KeptRun =>
  typeof value === 'object' && value !== null && typeof (value as KeptRun).sessionId === 'string' &&
  Array.isArray((value as KeptRun).ledger) && Array.isArray((value as KeptRun).unavailable) &&
  typeof (value as KeptRun).assignments === 'object' && (value as KeptRun).assignments !== null

/** Mirrors the run into the store when it changed since the last write. */
export async function keep($: EngineInterface, assignments: ReadonlyMap<string, Assignment>): Promise<void> {
  if (sessionId === undefined) return
  const [rows, refused] = await Promise.all([read($, ledger), read($, unavailable)])
  const kept: KeptRun = { sessionId, ledger: rows.map(keptRow), unavailable: refused, assignments: Object.fromEntries(assignments) }
  const text = JSON.stringify(kept)
  if (text === lastKept) return
  lastKept = text
  await $.store.set(runKey(sessionId), kept).catch(() => undefined)
}

/**
 * At `session.start`: reads this session's id, and fills the ledger, the
 * refused models and `assignments` from the store when the ledger is empty
 * and the stored run carries this session's id. Returns whether it did.
 */
export async function restore($: EngineInterface, assignments: Map<string, Assignment>): Promise<boolean> {
  sessionId = await $.session.id().catch(() => undefined)
  lastKept = undefined
  if (sessionId === undefined) return false
  const held = await $.store.get(runKey(sessionId)).catch(() => undefined)
  if (!isKept(held) || held.sessionId !== sessionId) return false
  if ((await read($, ledger)).length !== 0) return false
  await update($, ledger, () => held.ledger)
  await update($, unavailable, () => held.unavailable)
  for (const [id, assignment] of Object.entries(held.assignments)) assignments.set(id, assignment)
  lastKept = JSON.stringify({ sessionId: held.sessionId, ledger: held.ledger.map(keptRow), unavailable: held.unavailable, assignments: Object.fromEntries(assignments) })
  return true
}

/** Removes this session's run from the store (`/orchestrate reset`); the next ledger write keeps it again. */
export async function forget($: EngineInterface): Promise<void> {
  lastKept = undefined
  if (sessionId === undefined) return
  await $.store.delete(runKey(sessionId)).catch(() => undefined)
}
