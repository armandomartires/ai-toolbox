// Pure logic: no `$`, so a test calls it directly.
import type { AgentInfo } from 'claude-code'

import type { AgentRow, Task, TaskStatus } from '../types'

/** A loop that is not over: it may still run a turn. */
export const isActive = (status: string) =>
  status === 'running' || status === 'pending' || status === 'waiting' || status === 'idle'

/** The two groups of the pane, each newest first. */
export const groupAgents = (rows: AgentRow[]) => ({
  running: rows.filter(row => isActive(row.status)).slice().reverse(),
  completed: rows.filter(row => !isActive(row.status)).slice().reverse(),
})

/**
 * One color and one icon pair per hue: theme keys, so they follow the light
 * and dark themes; the pair is the icon's solid and hollow forms.
 */
export const PALETTE: readonly { color: string; icon: readonly [string, string] }[] = [
  { color: 'suggestion', icon: ['●', '○'] },
  { color: 'success', icon: ['◆', '◇'] },
  { color: 'warning', icon: ['▲', '△'] },
  { color: 'merged', icon: ['■', '□'] },
  { color: 'error', icon: ['★', '☆'] },
  { color: 'claude', icon: ['⬢', '⬡'] },
  { color: 'planMode', icon: ['✦', '✧'] },
  { color: 'autoAccept', icon: ['◉', '◎'] },
]

/** How many hues the palette has; a hue is an index into it. */
export const HUES = PALETTE.length

export const colorOf = (hue: number) => PALETTE[hue % HUES]?.color ?? 'text'

/**
 * The icon a row shows: its own, solid while it runs on even frames and
 * hollow on odd ones (the pulse), hollow while it waits to run, solid once
 * it ended.
 */
export const iconOf = (hue: number, status: string, frame: number) => {
  const pair = PALETTE[hue % HUES]?.icon ?? ['●', '○']
  if (status === 'running') return pair[frame % 2]
  return isActive(status) ? pair[1] : pair[0]
}

/** The mark after an ended row's name: what became of it. */
export const outcomeOf = (status: string) =>
  status === 'completed' ? '✓' : status === 'failed' ? '✗' : status === 'killed' ? '⏹' : ''

/** The next hue: the one least used by the rows so far, ties to the lowest. */
export const nextHue = (rows: AgentRow[]) => {
  const used = new Array<number>(HUES).fill(0)
  for (const row of rows) used[row.hue % HUES] = (used[row.hue % HUES] ?? 0) + 1
  let best = 0
  for (let hue = 1; hue < HUES; hue++) if ((used[hue] ?? 0) < (used[best] ?? 0)) best = hue
  return best
}

/** The row an `agent.spawn` answer starts, before the engine lists it. */
export const spawnedRow = (
  rows: AgentRow[],
  spawn: { id: string; parentId?: string; type: string; description: string },
  at: number,
): AgentRow[] => {
  const known = rows.find(row => row.id === spawn.id)
  const row: AgentRow = {
    id: spawn.id,
    parentId: spawn.parentId,
    type: spawn.type || 'agent',
    description: spawn.description,
    status: 'running',
    startedAt: known?.startedAt ?? at,
    hue: known?.hue ?? nextHue(rows),
  }

  return [...rows.filter(one => one.id !== row.id), row]
}

/**
 * The rows brought up to date with what `$.agent.list()` answers: a new
 * agent gets a row and a hue, a known one its current status, and one that
 * just ended its end time. Rows the list no longer names are kept.
 */
export const mergeListed = (rows: AgentRow[], listed: readonly AgentInfo[], at: number): AgentRow[] => {
  const next = rows.slice()
  for (const info of listed) {
    const i = next.findIndex(row => row.id === info.id)
    const row = next[i]
    const wasActive = row ? isActive(row.status) : true
    const merged: AgentRow = {
      id: info.id,
      parentId: info.parentId ?? row?.parentId,
      type: info.type || row?.type || 'agent',
      description: info.description || row?.description || '',
      status: info.status,
      startedAt: row?.startedAt ?? at,
      endedAt: isActive(info.status) ? undefined : wasActive ? at : row?.endedAt ?? at,
      hue: row?.hue ?? nextHue(next),
    }
    if (i === -1) next.push(merged)
    else next[i] = merged
  }

  return next
}

export const elapsed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h${m % 60}m`
}

export const fit = (text: string, columns: number) =>
  text.length <= columns ? text : `${text.slice(0, Math.max(1, columns - 1))}…`

/** Rows nested under their parents, depth-first; `depth` counts the parents. */
export const nested = (rows: AgentRow[]): { row: AgentRow; depth: number }[] => {
  const ids = new Set(rows.map(row => row.id))
  const out: { row: AgentRow; depth: number }[] = []
  const walk = (parentId: string | undefined, depth: number) => {
    for (const row of rows) {
      const parent = row.parentId !== undefined && ids.has(row.parentId) ? row.parentId : undefined
      if (parent === parentId) {
        out.push({ row, depth })
        walk(row.id, depth + 1)
      }
    }
  }
  walk(undefined, 0)

  return out
}

type PlanItem = { content?: unknown; status?: unknown }
export type PlanUpdate = {
  items?: unknown
  advance?: unknown
  done?: unknown
  start?: unknown
}

const asTaskStatus = (status: unknown): TaskStatus =>
  status === 'in_progress' || status === 'completed' ? status : 'pending'

/** The desktop app's update_plan, applied with the app's own semantics. */
export const applyPlan = (tasks: Task[], update: PlanUpdate): Task[] => {
  let next = Array.isArray(update.items)
    ? (update.items as PlanItem[]).map((item, i) => ({
        id: String(i + 1),
        text: String(item.content ?? ''),
        status: asTaskStatus(item.status),
      }))
    : tasks

  if (Array.isArray(update.done)) {
    const done = new Set((update.done as unknown[]).map(Number))
    next = next.map((task, i) => (done.has(i + 1) ? { ...task, status: 'completed' } : task))
  }
  if (typeof update.start === 'number') {
    const start = update.start
    next = next.map((task, i) => (i + 1 === start ? { ...task, status: 'in_progress' } : task))
  }
  if (update.advance === true) {
    next = next.map(task => (task.status === 'in_progress' ? { ...task, status: 'completed' } : task))
    const pending = next.findIndex(task => task.status === 'pending')
    next = next.map((task, i) => (i === pending ? { ...task, status: 'in_progress' } : task))
  }

  return next
}

/** What the band says of a task list: how many are done, and the step in progress. */
export const progressOf = (tasks: Task[]) => ({
  done: tasks.filter(task => task.status === 'completed').length,
  total: tasks.length,
  current: tasks.find(task => task.status === 'in_progress')?.text,
})

/** A bar of `width` cells, `done/total` of it filled. */
export const bar = (done: number, total: number, width: number) => {
  const cells = Math.max(1, width)
  const filled = total > 0 ? Math.round((cells * Math.min(done, total)) / total) : 0
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled)
}
