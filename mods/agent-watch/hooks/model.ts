// Pure logic: no `$`, so a test calls it directly.
import type { AgentInfo } from 'claude-code'

import type { Activity, AgentRow, Task, TaskStatus } from '../types'
import { IDENTITY, elapsed, fit, hms } from './sigma'
import type { Status } from './sigma'

export { elapsed, fit }

/** A loop that is not over: it may still run a turn. */
export const isActive = (status: string) =>
  status === 'running' || status === 'pending' || status === 'waiting' || status === 'idle'

/** The two groups of the pane, each newest first. */
export const groupAgents = (rows: AgentRow[]) => ({
  running: rows.filter(row => isActive(row.status)).slice().reverse(),
  completed: rows.filter(row => !isActive(row.status)).slice().reverse(),
})

/**
 * How many identities there are; a row's `hue` is an index into SIGMAorbital's
 * `IDENTITY`, its glyph pair. The glyph says which agent it is, its colour
 * what state it is in (`agentState`).
 */
export const HUES = IDENTITY.length

/**
 * The icon a row shows: its own, solid while it runs on even frames and
 * hollow on odd ones (the pulse), hollow while it waits to run, solid once
 * it ended.
 */
export const iconOf = (hue: number, status: string, frame: number) => {
  const pair = IDENTITY[hue % HUES] ?? IDENTITY[0]!
  if (status === 'running') return pair[frame % 2]
  return isActive(status) ? pair[1] : pair[0]
}

/** The badge after an ended row's name when it did not complete: what became of it. */
export const outcomeOf = (status: string): { status: Status; word: string } | undefined =>
  status === 'failed' ? { status: 'critical', word: 'FAILED' } : status === 'killed' ? { status: 'offline', word: 'STOPPED' } : undefined

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
  spawn: { id: string; parentId?: string; type: string; description: string; model?: string },
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
    model: spawn.model ?? known?.model,
    calls: known?.calls ?? 0,
    tokens: known?.tokens ?? 0,
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
      model: row?.model,
      calls: row?.calls ?? 0,
      tokens: row?.tokens ?? 0,
      activity: isActive(info.status) ? row?.activity : undefined,
      isAlerted: row?.isAlerted,
    }
    if (i === -1) next.push(merged)
    else next[i] = merged
  }

  return next
}

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

/** The argument that names what a tool call does, per tool; none for the rest. */
const MAIN_ARG: Record<string, string> = {
  Bash: 'command',
  Read: 'file_path',
  Edit: 'file_path',
  Write: 'file_path',
  Grep: 'pattern',
  Glob: 'pattern',
  Agent: 'description',
  WebFetch: 'url',
  WebSearch: 'query',
}

/** A tool call as the activity line names it: the tool, and its main argument cut to `width`. */
export const summarizeCall = (tool: string, args: Record<string, unknown>, width = 40): Pick<Activity, 'tool' | 'detail'> => {
  const key = MAIN_ARG[tool]
  const raw = key === undefined ? undefined : args[key]
  const detail = typeof raw === 'string' ? fit(raw.replace(/\s+/g, ' ').trim(), width) : ''

  return { tool, detail }
}

const onRow = (rows: AgentRow[], agentId: string, change: (row: AgentRow) => AgentRow) =>
  rows.map(row => (row.id === agentId ? change(row) : row))

export const callStarted = (rows: AgentRow[], agentId: string, activity: Activity) =>
  onRow(rows, agentId, row => ({ ...row, activity }))

export const callEnded = (rows: AgentRow[], agentId: string) =>
  onRow(rows, agentId, row => ({ ...row, activity: undefined, calls: row.calls + 1 }))

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

/** A turn's tokens, the four counts summed; none while the turn had no usage. */
export const tokensOf = (usage?: Usage) =>
  usage === undefined
    ? 0
    : (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)

export const turnCounted = (rows: AgentRow[], agentId: string, tokens: number, model?: string) =>
  onRow(rows, agentId, row => ({ ...row, tokens: row.tokens + tokens, model: model ?? row.model }))

export const tokensText = (n: number) =>
  n < 1_000 ? String(n) : n < 1_000_000 ? `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k` : `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`

/** How long a call in flight is named: past this it shows its elapsed time. */
const SLOW_CALL_MS = 5_000

/** The caption under a running row: the call in flight, its calls so far, its tokens. */
export const activityLine = (row: AgentRow, at: number) => {
  const parts: string[] = []
  if (row.activity) {
    const slow = at - row.activity.since > SLOW_CALL_MS ? ` (${elapsed(at - row.activity.since)})` : ''
    parts.push(`${row.activity.tool}${row.activity.detail ? `: ${row.activity.detail}` : ''}${slow}`)
  }
  parts.push(`${row.calls} CALL${row.calls === 1 ? '' : 'S'}`)
  if (row.tokens > 0) parts.push(`${tokensText(row.tokens)} TOK`)

  return parts.join(' · ')
}

/** Rows that just ended badly: failed or killed now, active before (or new), and not yet alerted. */
export const endedBadly = (before: AgentRow[], after: AgentRow[]) => {
  const was = new Map(before.map(row => [row.id, row]))
  return after.filter(row => {
    if (row.isAlerted || (row.status !== 'failed' && row.status !== 'killed')) return false
    const old = was.get(row.id)
    return old === undefined || isActive(old.status)
  })
}

export const markAlerted = (rows: AgentRow[], ids: Iterable<string>) => {
  const set = new Set(ids)
  return rows.map(row => (set.has(row.id) ? { ...row, isAlerted: true as const } : row))
}

/** The toast: the agent's type, its task, what became of it, and how long it ran. */
export const alertText = (row: AgentRow) =>
  `${row.type.toUpperCase()} · ${row.description} · ${row.status === 'failed' ? 'FAILED' : 'STOPPED'} ${hms((row.endedAt ?? row.startedAt) - row.startedAt)}`

/** The status-line entry; none at zero, which clears it. */
export const runningText = (n: number) => (n === 0 ? undefined : `${n} AGENT${n === 1 ? '' : 'S'} RUNNING`)

/** What `/agent-watch` answers, and the counts its panel draws. */
export type WatchOutput = { isPlaced: boolean; running: number; completed: number; failed: number }

export const watchText = (out: WatchOutput) =>
  `${out.isPlaced ? 'Agents pane opened' : 'Agents pane is open but this surface does not show panes'}: ${out.running} running, ${out.completed} completed, ${out.failed} failed or stopped.`
