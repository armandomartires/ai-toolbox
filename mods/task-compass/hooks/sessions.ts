// The session tree (ADR-0044, ADR-0045): pure logic, no `$`, one module shared
// byte for byte by every mod that draws it. Its owner is
// mods/agent-watch/hooks/sessions.ts; a copy elsewhere fails the gate
// (scripts/check-mods.py, rule 7). It imports nothing but ./sigma, so the
// shapes it reads are declared here, structurally: a mod's own row types
// satisfy them, and fields it does not read are left out.
import { IDENTITY, elapsed } from './sigma'
import type { Status, Token } from './sigma'

/** A tool call in flight. */
export type Activity = { tool: string; detail: string; since: number }

/** One step of a task list. */
export type Task = { id: string; text: string; status: string }

/** A subagent row, the fields the tree reads. */
export type AgentRow = {
  id: string
  parentId?: string
  type: string
  description: string
  spawnedBy?: string
  runId?: string
  status: string
  startedAt: number
  endedAt?: number
  calls: number
  tokens: number
  activity?: Activity
  tasks?: Task[]
}

/** A Workflow run. */
export type WorkflowRun = { id: string; name: string; ownerId?: string; startedAt: number }

export type OrchPolicy = 'economy' | 'balanced' | 'quality'

/** A task-orchestrator ledger task, the fields the tree reads. */
export type OrchTask = {
  id: string
  role: string
  objective: string
  deps: string[]
  status: 'queued' | 'running' | 'completed' | 'partial' | 'blocked' | 'failed' | 'cancelled'
  requested: { model: string; effort: string }
  observed?: { model: string; effort: string }
  agentId?: string
  createdAt: number
  startedAt?: number
  endedAt?: number
}

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


/** The badge after an ended row's name when it did not complete: what became of it. */
export const outcomeOf = (status: string): { status: Status; word: string } | undefined =>
  status === 'failed' ? { status: 'critical', word: 'FAILED' } : status === 'killed' ? { status: 'offline', word: 'STOPPED' } : undefined


/** What the band says of a task list: how many are done, and the step in progress. */
export const progressOf = (tasks: Task[]) => ({
  done: tasks.filter(task => task.status === 'completed').length,
  total: tasks.length,
  current: tasks.find(task => task.status === 'in_progress')?.text,
})


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


/** A task-orchestrator worker: its ledger names the agent, or the orchestrator spawned it. */
export const isOrchWorker = (row: AgentRow, workers: ReadonlySet<string>) => workers.has(row.id) || row.spawnedBy === 'task-orchestrator'

export const workersOf = (ledger: readonly OrchTask[]) => new Set(ledger.flatMap(task => (task.agentId ? [task.agentId] : [])))

/** A ledger task that will not run again. */
export const isEnded = (task: OrchTask) => task.status !== 'queued' && task.status !== 'running'


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
  /** The ledger task this member is: set for a task, never for an agent. */
  taskId?: string
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
    taskId: task.id,
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
