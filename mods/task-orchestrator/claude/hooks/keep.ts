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
import type { Ledger } from './ledger'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
const unavailable = atom({ plugin: 'task-orchestrator', key: 'unavailable' } as const, [])

/** The store key the run is kept under. */
export const STORE_RUN = 'task-orchestrator:run'

/** What the store holds: the session the run belongs to, its rows, the refused models and each task's assignment. */
export type KeptRun = {
  sessionId: string
  ledger: Ledger
  unavailable: string[]
  assignments: Record<string, Assignment>
}

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
  const kept: KeptRun = { sessionId, ledger: rows, unavailable: refused, assignments: Object.fromEntries(assignments) }
  const text = JSON.stringify(kept)
  if (text === lastKept) return
  lastKept = text
  await $.store.set(STORE_RUN, kept).catch(() => undefined)
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
  const held = await $.store.get(STORE_RUN).catch(() => undefined)
  if (!isKept(held) || held.sessionId !== sessionId) return false
  if ((await read($, ledger)).length !== 0) return false
  await update($, ledger, () => held.ledger)
  await update($, unavailable, () => held.unavailable)
  for (const [id, assignment] of Object.entries(held.assignments)) assignments.set(id, assignment)
  lastKept = JSON.stringify({ sessionId: held.sessionId, ledger: held.ledger, unavailable: held.unavailable, assignments: Object.fromEntries(assignments) })
  return true
}
