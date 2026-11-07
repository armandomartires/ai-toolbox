// The rows mirrored into `$.store`, so a `/reload-plugins --force`, which
// drops the plugin's `$.state` values with its instance, does not lose them.
// A plain reload keeps `$.state` (the engine's types: "plain data that
// survives a hot reload of the plugin's code"); the forced one, seen live on
// 2026-11-06, restarted every row at B01/S01 while the app still listed the
// background tasks. Write-through on each change, and only when the rows
// changed; restored at `session.start` when the atoms are empty, from this
// session's own key, never from another session's.
//
// The store is the plugin's, shared by every session that loads it, so each
// session keeps its rows under a key of its own (`agent-watch:rows:<session
// id>`, TASK-0250): under one shared key the last session to write won, and a
// forced reload in the other found nothing of its own (seen live 2026-11-07,
// two desktop sessions loading the mod from one checkout). Keys that have not
// been written for a week are deleted at `session.start`.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { AgentRow, BackgroundTask, Task, WorkflowRun } from '../types'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const runs = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const tones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
const background = atom({ plugin: 'agent-watch', key: 'background' } as const, [])

/** The store key 0.11.2 to 0.12.0 kept every session's rows under, one for all; read once more for this session's own rows, then removed. */
export const STORE_ROWS = 'agent-watch:rows'

/** The store key a session keeps its rows under. */
export const rowsKey = (id: string): string => `${STORE_ROWS}:${id}`

/** How long a session's kept rows outlive their last write before `session.start` deletes them. */
export const KEEP_MS = 7 * 24 * 60 * 60 * 1000

/** What the store holds: the session the rows belong to, when they were last written, and the rows. */
export type KeptRows = {
  sessionId: string
  /** The clock when the rows were last written; absent on rows 0.12.0 or earlier wrote. */
  savedAt?: number
  agents: AgentRow[]
  tasks: Task[]
  runs: WorkflowRun[]
  tones: Record<string, number>
  background: BackgroundTask[]
}

/** This session's id, read once at `session.start`; unset, nothing is kept. */
let sessionId: string | undefined
/** The JSON last written, its time left out, so an unchanged set of rows costs no store write. */
let lastKept: string | undefined

const isKept = (value: unknown): value is KeptRows =>
  typeof value === 'object' && value !== null && typeof (value as KeptRows).sessionId === 'string' &&
  Array.isArray((value as KeptRows).agents) && Array.isArray((value as KeptRows).tasks) && Array.isArray((value as KeptRows).runs) &&
  Array.isArray((value as KeptRows).background) && typeof (value as KeptRows).tones === 'object' && (value as KeptRows).tones !== null

async function rowsOf($: EngineInterface) {
  const [a, t, r, o, b] = await Promise.all([read($, agents), read($, tasks), read($, runs), read($, tones), read($, background)])
  return { agents: a, tasks: t, runs: r, tones: o, background: b }
}

type Rows = Awaited<ReturnType<typeof rowsOf>>
const isEmpty = (rows: Rows) => rows.agents.length === 0 && rows.tasks.length === 0 && rows.runs.length === 0 && rows.background.length === 0 && Object.keys(rows.tones).length === 0

/** The rows as compared between writes: their time left out. */
const textOf = (kept: KeptRows) =>
  JSON.stringify({ sessionId: kept.sessionId, agents: kept.agents, tasks: kept.tasks, runs: kept.runs, tones: kept.tones, background: kept.background })

/** When kept rows were last written: `savedAt`, else (rows 0.12.0 or earlier wrote) the latest start or end among them. */
const lastWrittenOf = (kept: KeptRows): number =>
  kept.savedAt ??
  Math.max(0, ...[...kept.agents, ...kept.background].flatMap(row => [row.startedAt, row.endedAt ?? 0]), ...kept.runs.map(run => run.startedAt))

/** Mirrors the rows into this session's key when they changed since the last write. */
export async function keep($: EngineInterface): Promise<void> {
  if (sessionId === undefined) return
  const rows = await rowsOf($)
  // Nothing yet, nothing written: an idle session's start costs no store write.
  if (lastKept === undefined && isEmpty(rows)) return
  const kept: KeptRows = { sessionId, ...rows }
  const text = textOf(kept)
  if (text === lastKept) return
  lastKept = text
  const savedAt = await $.clock.now().catch(() => undefined)
  await $.store.set(rowsKey(sessionId), savedAt === undefined ? kept : { ...kept, savedAt }).catch(() => undefined)
}

/**
 * The kept rows of other sessions not written for `KEEP_MS`, deleted; the
 * shared key 0.12.0 and earlier wrote goes by the same age. A key that is
 * not kept rows is left alone.
 */
async function prune($: EngineInterface, own: string): Promise<void> {
  const at = await $.clock.now()
  const keys = await $.store.keys()
  for (const key of keys) {
    if (key === rowsKey(own) || (key !== STORE_ROWS && !key.startsWith(`${STORE_ROWS}:`))) continue
    const held = await $.store.get(key).catch(() => undefined)
    if (isKept(held) && at - lastWrittenOf(held) > KEEP_MS) await $.store.delete(key).catch(() => undefined)
  }
}

/**
 * At `session.start`: reads this session's id, and fills the atoms from the
 * store when they are all empty: from this session's own key, else from the
 * shared key 0.12.0 and earlier wrote when it holds this session's rows (then
 * removed). Then deletes other sessions' rows not written for a week.
 * Returns whether rows were restored.
 */
export async function restore($: EngineInterface): Promise<boolean> {
  sessionId = await $.session.id().catch(() => undefined)
  lastKept = undefined
  if (sessionId === undefined) return false
  const own = sessionId
  const restored = await restoreFrom($, own)
  await prune($, own).catch(() => undefined)
  return restored
}

async function restoreFrom($: EngineInterface, own: string): Promise<boolean> {
  const mine = await $.store.get(rowsKey(own)).catch(() => undefined)
  const shared = isKept(mine) ? undefined : await $.store.get(STORE_ROWS).catch(() => undefined)
  const held = isKept(mine) && mine.sessionId === own ? mine : isKept(shared) && shared.sessionId === own ? shared : undefined
  if (held === undefined) return false
  if (!isEmpty(await rowsOf($))) return false
  await update($, agents, () => held.agents)
  await update($, tasks, () => held.tasks)
  await update($, runs, () => held.runs)
  await update($, tones, () => held.tones)
  await update($, background, () => held.background)
  lastKept = textOf(held)
  // Rows found under the shared key move to this session's own.
  if (held !== mine) {
    await $.store.set(rowsKey(own), held).catch(() => undefined)
    await $.store.delete(STORE_ROWS).catch(() => undefined)
  }
  return true
}
