// The rows mirrored into `$.store`, so a `/reload-plugins --force`, which
// drops the plugin's `$.state` values with its instance, does not lose them.
// A plain reload keeps `$.state` (the engine's types: "plain data that
// survives a hot reload of the plugin's code"); the forced one, seen live on
// 2026-11-06, restarted every row at B01/S01 while the app still listed the
// background tasks. Write-through on each change, and only when the rows
// changed; restored at `session.start` when the atoms are empty and the
// stored rows belong to this session id, never from another session.
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

/** The store key the rows are kept under. */
export const STORE_ROWS = 'agent-watch:rows'

/** What the store holds: the session the rows belong to, and the rows. */
export type KeptRows = {
  sessionId: string
  agents: AgentRow[]
  tasks: Task[]
  runs: WorkflowRun[]
  tones: Record<string, number>
  background: BackgroundTask[]
}

/** This session's id, read once at `session.start`; unset, nothing is kept. */
let sessionId: string | undefined
/** The JSON last written, so an unchanged set of rows costs no store write. */
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

/** Mirrors the rows into the store when they changed since the last write. */
export async function keep($: EngineInterface): Promise<void> {
  if (sessionId === undefined) return
  const rows = await rowsOf($)
  // Nothing yet, nothing written: an idle session's start costs no store write.
  if (lastKept === undefined && isEmpty(rows)) return
  const kept: KeptRows = { sessionId, ...rows }
  const text = JSON.stringify(kept)
  if (text === lastKept) return
  lastKept = text
  await $.store.set(STORE_ROWS, kept).catch(() => undefined)
}

/**
 * At `session.start`: reads this session's id, and fills the atoms from the
 * store when they are all empty and the stored rows carry this session's id.
 * Returns whether rows were restored.
 */
export async function restore($: EngineInterface): Promise<boolean> {
  sessionId = await $.session.id().catch(() => undefined)
  lastKept = undefined
  if (sessionId === undefined) return false
  const held = await $.store.get(STORE_ROWS).catch(() => undefined)
  if (!isKept(held) || held.sessionId !== sessionId) return false
  if (!isEmpty(await rowsOf($))) return false
  await update($, agents, () => held.agents)
  await update($, tasks, () => held.tasks)
  await update($, runs, () => held.runs)
  await update($, tones, () => held.tones)
  await update($, background, () => held.background)
  lastKept = JSON.stringify({ sessionId: held.sessionId, agents: held.agents, tasks: held.tasks, runs: held.runs, tones: held.tones, background: held.background })
  return true
}
