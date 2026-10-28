// Pure logic: no `$`, so a test calls it directly.
import type { AgentInfo } from 'claude-code'

import type { Activity, AgentRow, OrchPolicy, OrchTask, Task, TaskStatus, WorkflowRun } from '../types'
import { IDENTITY, elapsed, fit, hms } from './sigma'
import type { Status, Token } from './sigma'

export { elapsed, fit }

/** A loop that is not over: it may still run a turn. */
export const isActive = (status: string) =>
  status === 'running' || status === 'pending' || status === 'waiting' || status === 'idle'

/**
 * The two icons (ADR-0044): every session draws SIGMAorbital's `IDENTITY[1]`
 * pair, every subagent its `IDENTITY[0]`. Which session a row belongs to is
 * its colour, a tone of `SESSION_TONES`; its state is the pulse and a badge.
 */
export type IconKind = 'session' | 'agent'

/**
 * The icon a row shows: solid while it runs on even frames and hollow on odd
 * ones (the pulse), hollow while it waits to run, solid once it ended.
 */
export const iconOf = (kind: IconKind, status: string, frame: number) => {
  const pair = (kind === 'session' ? IDENTITY[1] : IDENTITY[0]) ?? IDENTITY[0]!
  if (status === 'running') return pair[frame % 2]
  return isActive(status) ? pair[1] : pair[0]
}

/**
 * A session's colour, from SIGMAorbital's tokens only: never amber or red,
 * which say caution and critical. This session is always the first.
 */
export const SESSION_TONES: readonly Token[] = ['cyan', 'violet', 'green', 'text-1', 'text-2']

export const MAIN = 'main'
export const ORCH = 'orch'
export const runKey = (id: string) => `run:${id}`
export const agentKey = (id: string) => `agent:${id}`

/** A session's token: this session's is the first tone; one not yet toned takes it too. */
export const toneToken = (tones: Record<string, number>, key: string) =>
  SESSION_TONES[(key === MAIN ? 0 : tones[key] ?? 0) % SESSION_TONES.length] ?? SESSION_TONES[0]!

/** The next tone: the one least used, this session holding the first; ties to the lowest. */
export const nextTone = (tones: Record<string, number>) => {
  const used = new Array<number>(SESSION_TONES.length).fill(0)
  used[0] = 1
  for (const tone of Object.values(tones)) used[tone % used.length] = (used[tone % used.length] ?? 0) + 1
  let best = 0
  for (let tone = 1; tone < used.length; tone++) if ((used[tone] ?? 0) < (used[best] ?? 0)) best = tone
  return best
}

/** The badge after an ended row's name when it did not complete: what became of it. */
export const outcomeOf = (status: string): { status: Status; word: string } | undefined =>
  status === 'failed' ? { status: 'critical', word: 'FAILED' } : status === 'killed' ? { status: 'offline', word: 'STOPPED' } : undefined

/** The row an `agent.spawn` answer starts, before the engine lists it. */
export const spawnedRow = (
  rows: AgentRow[],
  spawn: { id: string; parentId?: string; type: string; description: string; model?: string; runId?: string },
  at: number,
): AgentRow[] => {
  const known = rows.find(row => row.id === spawn.id)
  const row: AgentRow = {
    id: spawn.id,
    parentId: spawn.parentId,
    type: spawn.type || 'agent',
    description: spawn.description,
    name: known?.name,
    spawnedBy: known?.spawnedBy,
    runId: spawn.runId ?? known?.runId,
    isTeammate: known?.isTeammate,
    status: 'running',
    startedAt: known?.startedAt ?? at,
    model: spawn.model ?? known?.model,
    calls: known?.calls ?? 0,
    tokens: known?.tokens ?? 0,
    tasks: known?.tasks,
  }

  return [...rows.filter(one => one.id !== row.id), row]
}

/**
 * The rows brought up to date with what `$.agent.list()` answers: a new
 * agent gets a row, a known one its current status, and one that
 * just ended its end time. Rows the list no longer names are kept. A row
 * its own turn ended stays ended while the list still says it is active:
 * the list lags, and keeps naming a finished subagent for a while.
 */
export const mergeListed = (rows: AgentRow[], listed: readonly AgentInfo[], at: number): AgentRow[] => {
  const next = rows.slice()
  for (const info of listed) {
    const i = next.findIndex(row => row.id === info.id)
    const row = next[i]
    const wasActive = row ? isActive(row.status) : true
    if (row?.isTurnEnded && isActive(info.status)) {
      next[i] = { ...row, name: info.name ?? row.name, spawnedBy: info.spawnedBy ?? row.spawnedBy }
      continue
    }
    const merged: AgentRow = {
      id: info.id,
      parentId: info.parentId ?? row?.parentId,
      type: info.type || row?.type || 'agent',
      description: info.description || row?.description || '',
      name: info.name ?? row?.name,
      spawnedBy: info.spawnedBy ?? row?.spawnedBy,
      runId: row?.runId,
      isTurnEnded: row?.isTurnEnded,
      isTeammate: info.teammateId !== undefined || row?.isTeammate ? true : undefined,
      status: info.status,
      startedAt: row?.startedAt ?? at,
      endedAt: isActive(info.status) ? undefined : wasActive ? at : row?.endedAt ?? at,
      model: row?.model,
      calls: row?.calls ?? 0,
      tokens: row?.tokens ?? 0,
      activity: isActive(info.status) ? row?.activity : undefined,
      tasks: row?.tasks,
      isAlerted: row?.isAlerted,
    }
    if (i === -1) next.push(merged)
    else next[i] = merged
  }

  return next
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

/** The desktop app's plan tools, by name under any MCP prefix. */
const PLAN_TOOL = /(^|__)update_plan$/
const WRAP_TOOL = /(^|__)wrap_up$/

type TodoItem = { content?: unknown; activeForm?: unknown; status?: unknown }

/**
 * What a task tool that answered did to a loop's task list: TodoWrite,
 * TaskCreate/TaskUpdate, or the desktop app's plan tools. None for any other
 * tool. The main loop's list and a subagent's own are kept alike.
 */
export const taskChange = (tool: string, e: Record<string, unknown>, result: unknown): ((list: Task[]) => Task[]) | undefined => {
  if (tool === 'TodoWrite') {
    const todos = Array.isArray(e.todos) ? (e.todos as TodoItem[]) : []
    return () =>
      todos.map((todo, i): Task => {
        const status = asTaskStatus(todo.status)
        const text = status === 'in_progress' && typeof todo.activeForm === 'string' && todo.activeForm ? todo.activeForm : String(todo.content ?? '')
        return { id: String(i + 1), text, status }
      })
  }
  if (tool === 'TaskCreate') {
    const id = (result as { task?: { id?: string } } | undefined)?.task?.id
    return id ? list => [...list, { id, text: String(e.subject ?? ''), status: 'pending' }] : undefined
  }
  if (tool === 'TaskUpdate') {
    return list =>
      e.status === 'deleted'
        ? list.filter(task => task.id !== e.taskId)
        : list.map(task =>
            task.id === e.taskId
              ? { ...task, text: typeof e.subject === 'string' ? e.subject : task.text, status: e.status === undefined ? task.status : asTaskStatus(e.status) }
              : task,
          )
  }
  if (PLAN_TOOL.test(tool)) return list => applyPlan(list, e as PlanUpdate)
  if (WRAP_TOOL.test(tool)) return list => list.map((task): Task => ({ ...task, status: 'completed' }))

  return undefined
}

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

// ---- Sessions (ADR-0044) -------------------------------------------------
//
// A session is this one, the task-orchestrator's run, a Workflow run, or a
// subagent that keeps its own task list or spawned subagents of its own. A
// sub-session becomes one the first time `assignTones` gives it a tone, and
// keeps that tone; every other row is a member of the session that owns it.

/** A task-orchestrator worker: its ledger names the agent, or the orchestrator spawned it. */
const isOrchWorker = (row: AgentRow, workers: ReadonlySet<string>) => workers.has(row.id) || row.spawnedBy === 'task-orchestrator'

const workersOf = (ledger: readonly OrchTask[]) => new Set(ledger.flatMap(task => (task.agentId ? [task.agentId] : [])))

/** A ledger task that will not run again. */
export const isEnded = (task: OrchTask) => task.status !== 'queued' && task.status !== 'running'

/**
 * The tones brought up to date, the same object when nothing changed: each
 * Workflow run, the orchestrator's run while its ledger has a task, and each
 * subagent that keeps its own task list or has children gets one, in the
 * order they started. A task-orchestrator worker never becomes a session:
 * workers do not delegate, and its own steps show in its caption.
 */
export const assignTones = (tones: Record<string, number>, rows: AgentRow[], runs: WorkflowRun[], ledger: readonly OrchTask[]) => {
  const workers = workersOf(ledger)
  const parents = new Set(rows.flatMap(row => (row.parentId ? [row.parentId] : [])))
  const wanted: { key: string; at: number }[] = [
    ...runs.map(run => ({ key: runKey(run.id), at: run.startedAt })),
    ...(ledger.length > 0 ? [{ key: ORCH, at: Math.min(...ledger.map(task => task.createdAt)) }] : []),
    ...rows
      .filter(row => !isOrchWorker(row, workers) && ((row.tasks?.length ?? 0) > 0 || parents.has(row.id)))
      .map(row => ({ key: agentKey(row.id), at: row.startedAt })),
  ]
  let next = tones
  for (const { key } of wanted.slice().sort((a, b) => a.at - b.at)) {
    if (next[key] === undefined) next = { ...next, [key]: nextTone(next) }
  }

  return next
}

/** What a session's bar counts: its task list's steps, its agents, or the orchestrator's tasks. */
export type Progress = { done: number; total: number; unit: 'STEPS' | 'AGENTS' | 'TASKS' }

/** One row under a session: a subagent, or a ledger task that has none yet. */
export type Member = {
  key: string
  /** Opens its transcript when pressed; none for a queued task. */
  agentId?: string
  label: string
  /** The status the icon draws from: running pulses, active is hollow, ended solid. */
  status: string
  isActive: boolean
  startedAt?: number
  endedAt?: number
  badge?: { status: Status; word: string }
  row?: AgentRow
  /** A queued task's dependencies. */
  waits?: string[]
  /** An orchestrated worker's model/effort: observed, else requested. */
  settings?: string
}

export type SessionKind = 'main' | 'orch' | 'run' | 'agent'

export type SessionNode = {
  key: string
  kind: SessionKind
  name: string
  depth: number
  agentId?: string
  isActive: boolean
  /** The status its icon draws from. */
  status: string
  startedAt?: number
  endedAt?: number
  badge?: { status: Status; word: string }
  progress: Progress
  running: Member[]
  completed: Member[]
  row?: AgentRow
}

export type SessionInput = {
  rows: AgentRow[]
  runs: WorkflowRun[]
  tones: Record<string, number>
  /** This session's own task list. */
  tasks: Task[]
  ledger: readonly OrchTask[]
  policy?: OrchPolicy
  isOrchOn?: boolean
}

/** The badge a ledger word earns, as task-orchestrator's own pane colours it. */
export const ledgerBadge = (status: OrchTask['status']): { status: Status; word: string } | undefined =>
  status === 'partial' || status === 'blocked'
    ? { status: 'caution', word: status.toUpperCase() }
    : status === 'failed'
      ? { status: 'critical', word: 'FAILED' }
      : status === 'cancelled'
        ? { status: 'offline', word: 'CANCELLED' }
        : undefined

const agentMember = (row: AgentRow): Member => ({
  key: row.id,
  agentId: row.id,
  label: `${row.type} · ${row.description}`,
  status: row.status,
  isActive: isActive(row.status),
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  badge: outcomeOf(row.status),
  row,
})

/** A ledger task as a member: its agent's row joined by `agentId`, the ledger's word winning. */
const taskMember = (task: OrchTask, row: AgentRow | undefined): Member => {
  const settings = task.observed ?? task.requested
  const status = task.status === 'queued' ? 'pending' : task.status === 'running' ? row?.status ?? 'running' : 'completed'
  return {
    key: `task-${task.id}`,
    agentId: task.agentId,
    label: `${task.id} · ${task.role} · ${task.objective}`,
    status,
    isActive: !isEnded(task),
    startedAt: task.startedAt,
    endedAt: task.endedAt,
    badge: ledgerBadge(task.status) ?? (row && task.status !== 'completed' ? outcomeOf(row.status) : undefined),
    row,
    waits: task.status === 'queued' ? task.deps : undefined,
    settings: task.status === 'queued' ? undefined : `${settings.model}/${settings.effort}`,
  }
}

const countOf = (members: Member[], unit: Progress['unit']): Progress => ({
  done: members.filter(member => !member.isActive).length,
  total: members.length,
  unit,
})

const stepsOf = (tasks: Task[]): Progress => ({ done: progressOf(tasks).done, total: tasks.length, unit: 'STEPS' })

/** Running first, then the ended ones; each newest first, but a ledger keeps its order. */
const split = (members: Member[], isLedger = false) => {
  const order = isLedger ? members : members.slice().reverse()
  return { running: order.filter(member => member.isActive), completed: order.filter(member => !member.isActive) }
}

/**
 * The pane's tree: this session first, then each sub-session under the one
 * that started it, depth-first; active sessions before ended ones, newest
 * first. Each carries its members and its progress.
 */
export const sessionTree = (input: SessionInput): SessionNode[] => {
  const { rows, runs, tones, tasks, ledger } = input
  const byId = new Map(rows.map(row => [row.id, row]))
  const workers = workersOf(ledger)
  const hasOrch = ledger.length > 0
  const isSessionRow = (row: AgentRow) => tones[agentKey(row.id)] !== undefined

  // The session a row is a member of, or that a session row nests under.
  const ownerOf = (row: AgentRow, depth = 0): string => {
    if (hasOrch && isOrchWorker(row, workers)) return ORCH
    const parent = row.parentId === undefined ? undefined : byId.get(row.parentId)
    if (parent && depth < 32) return isSessionRow(parent) ? agentKey(parent.id) : ownerOf(parent, depth + 1)
    if (row.runId && runs.some(run => run.id === row.runId)) return runKey(row.runId)
    return MAIN
  }
  const ownerOfLoop = (agentId: string | undefined) => {
    const row = agentId === undefined ? undefined : byId.get(agentId)
    return row === undefined ? MAIN : isSessionRow(row) ? agentKey(row.id) : ownerOf(row)
  }

  const members = new Map<string, Member[]>()
  const add = (key: string, member: Member) => members.set(key, [...(members.get(key) ?? []), member])
  for (const row of rows) {
    if (isSessionRow(row) || (hasOrch && workers.has(row.id))) continue
    add(ownerOf(row), agentMember(row))
  }

  const nodes: (SessionNode & { parent?: string })[] = []
  const main = members.get(MAIN) ?? []
  nodes.push({
    key: MAIN,
    kind: 'main',
    name: 'THIS SESSION',
    depth: 0,
    isActive: true,
    status: main.some(member => member.status === 'running') ? 'running' : 'completed',
    progress: tasks.length > 0 ? stepsOf(tasks) : countOf(main, 'AGENTS'),
    ...split(main),
  })

  if (hasOrch) {
    const own = [...ledger.map(task => taskMember(task, task.agentId ? byId.get(task.agentId) : undefined)), ...(members.get(ORCH) ?? [])]
    const isLive = ledger.some(task => !isEnded(task))
    nodes.push({
      key: ORCH,
      kind: 'orch',
      parent: MAIN,
      name: `ORCH ${(input.policy ?? 'balanced').toUpperCase()}${input.isOrchOn === false ? ' · OFF' : ''}`,
      depth: 0,
      isActive: isLive,
      status: own.some(member => member.status === 'running') ? 'running' : isLive ? 'pending' : 'completed',
      startedAt: Math.min(...ledger.map(task => task.createdAt)),
      endedAt: isLive ? undefined : Math.max(...ledger.map(task => task.endedAt ?? task.createdAt)),
      progress: { done: ledger.filter(isEnded).length, total: ledger.length, unit: 'TASKS' },
      ...split(own, true),
    })
  }

  for (const run of runs) {
    const own = members.get(runKey(run.id)) ?? []
    const isLive = own.length === 0 || own.some(member => member.isActive)
    nodes.push({
      key: runKey(run.id),
      kind: 'run',
      parent: ownerOfLoop(run.ownerId),
      name: `WF ${run.name}`,
      depth: 0,
      isActive: isLive,
      status: own.some(member => member.status === 'running') ? 'running' : isLive ? 'pending' : 'completed',
      startedAt: run.startedAt,
      endedAt: isLive ? undefined : Math.max(...own.map(member => member.endedAt ?? run.startedAt)),
      progress: countOf(own, 'AGENTS'),
      ...split(own),
    })
  }

  for (const row of rows.filter(isSessionRow)) {
    const own = members.get(agentKey(row.id)) ?? []
    nodes.push({
      key: agentKey(row.id),
      kind: 'agent',
      parent: ownerOf(row),
      name: `${row.type} · ${row.description}`,
      depth: 0,
      agentId: row.id,
      isActive: isActive(row.status),
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      badge: outcomeOf(row.status),
      progress: (row.tasks?.length ?? 0) > 0 ? stepsOf(row.tasks ?? []) : countOf(own, 'AGENTS'),
      row,
      ...split(own),
    })
  }

  // Depth-first from this session; a session whose owner is missing nests under it.
  const keys = new Set(nodes.map(node => node.key))
  const childrenOf = (key: string) =>
    nodes
      .filter(node => node.key !== MAIN && (keys.has(node.parent ?? MAIN) ? node.parent ?? MAIN : MAIN) === key)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || (b.startedAt ?? 0) - (a.startedAt ?? 0))
  const out: SessionNode[] = []
  const seen = new Set<string>()
  const walk = (node: SessionNode & { parent?: string }, depth: number) => {
    if (seen.has(node.key)) return
    seen.add(node.key)
    const { parent: _, ...rest } = node
    out.push({ ...rest, depth })
    for (const child of childrenOf(node.key)) walk(child, depth + 1)
  }
  walk(nodes[0]!, 0)

  return out
}

/** The token a running row's icon takes in the band: its owning session's tone. */
export const memberTone = (input: SessionInput, agentId: string) => {
  for (const node of sessionTree(input)) {
    if ([...node.running, ...node.completed].some(member => member.agentId === agentId)) return toneToken(input.tones, node.key)
  }
  return toneToken(input.tones, MAIN)
}

/**
 * The caption under a member: its own steps, what it is doing, its settings,
 * or what it waits on. An ended one keeps its calls and tokens, which its
 * turn's end is the first to report.
 */
export const memberCaption = (member: Member, at: number) => {
  const parts: string[] = []
  if (member.waits !== undefined) return member.waits.length > 0 ? `WAITS ON ${member.waits.join(', ')}` : 'QUEUED'
  const row = member.row
  if (row?.tasks && row.tasks.length > 0) {
    const { done, total } = progressOf(row.tasks)
    parts.push(`${done}/${total} STEPS`)
  }
  if (row && (row.activity || row.calls > 0 || row.tokens > 0)) parts.push(activityLine(row, at))
  if (member.isActive && member.settings) parts.push(member.settings)

  return parts.join(' · ')
}

/**
 * Ends a subagent from its own `turn.complete` (B-066): `answer` completed
 * it, `aborted` stopped it, a refusal or an error failed it. The list is
 * late to say so, or never does once it drops the agent, and a Workflow's
 * agents are in no list at all. A teammate is left to the list: its turn
 * ends in `idle`, waiting for a message, not in an end.
 */
export const turnEnded = (rows: AgentRow[], agentId: string, reason: string, at: number) =>
  rows.map(row =>
    row.id === agentId && !row.isTeammate && isActive(row.status)
      ? {
          ...row,
          status: reason === 'answer' ? 'completed' : reason === 'aborted' ? 'killed' : 'failed',
          endedAt: at,
          activity: undefined,
          isTurnEnded: true as const,
        }
      : row,
  )

/** A new turn in an ended subagent's loop (a message woke it): it runs again. */
export const turnStarted = (rows: AgentRow[], agentId: string) =>
  rows.map(row =>
    row.id === agentId && row.isTurnEnded
      ? { ...row, status: 'running', endedAt: undefined, isTurnEnded: undefined, isAlerted: undefined }
      : row,
  )

/** A Workflow run recorded or filled in: a spawn may name it before the tool's result does. */
export const recordRun = (runs: WorkflowRun[], run: { id: string; name?: string; ownerId?: string; startedAt: number }): WorkflowRun[] => {
  const known = runs.find(one => one.id === run.id)
  if (!known) return [...runs, { id: run.id, name: run.name || 'workflow', ownerId: run.ownerId, startedAt: run.startedAt }]
  return runs.map(one => (one.id === run.id ? { ...one, name: run.name || one.name, ownerId: one.ownerId ?? run.ownerId } : one))
}
