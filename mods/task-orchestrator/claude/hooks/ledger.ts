// The task ledger, pure: dependencies, concurrency, writer overlap, retries,
// escalations and the completion rules. The hooks module holds one in
// $.state and calls these on it.

import { EFFORTS, familyRank } from './routing'
import type { Limits } from './routing'
import type { Report, Settings, Task, TaskStatus } from '../types'

export type { Report, Settings, Task, TaskStatus }

/** The note a task stopped at its turn cap carries: its agent may be resumed, and its next turn reopens the task (TASK-0260). */
export const TURN_CAP_NOTE = 'stopped at its turn cap'

export const ENDED: readonly TaskStatus[] = ['completed', 'partial', 'blocked', 'failed', 'cancelled']

export type Ledger = Task[]

/** A path split for comparison: its drive (lowercased, or ''), whether it is absolute, and its segments. */
type Parts = { drive: string; absolute: boolean; segments: string[] }

const partsOf = (path: string): Parts => {
  let rest = path.replace(/\\/g, '/')
  const found = /^([A-Za-z]):/.exec(rest)
  const drive = found ? found[1]!.toLowerCase() : ''
  if (found) rest = rest.slice(2)
  const absolute = rest.startsWith('/') || drive !== ''
  return { drive, absolute, segments: rest.split('/').filter(one => one !== '' && one !== '.') }
}

/** The segments laid onto `stack`, a `..` popping the one before it; a `..` with nothing to pop is kept when `keep`. */
const collapse = (stack: readonly string[], segments: readonly string[], keep: boolean): string[] => {
  const out = [...stack]
  for (const one of segments) {
    if (one !== '..') out.push(one)
    else if (out.length && out[out.length - 1] !== '..') out.pop()
    else if (keep) out.push(one)
  }
  return out
}

/** `a/b`, `a/b/`, `./a/b` and `a/x/../b` are one path; backslashes are separators; `.` is the empty path. */
export const normalizePath = (path: string): string => {
  const parts = partsOf(path)
  const out = collapse([], parts.segments, !parts.absolute).join('/')
  return parts.drive ? `${parts.drive}:/${out}` : parts.absolute ? `/${out}` : out
}

/** Whole segments: `owned` covers `path` when it is `path` or a directory above it; the empty path is the whole root. */
const covers = (owned: string, path: string): boolean => owned === '' || owned === path || path.startsWith(`${owned}/`)

/** The paths of `a` and `b` that cover one another; a writer with no list covers everything. */
export const overlap = (a: readonly string[], b: readonly string[]): string[] => {
  if (a.length === 0 || b.length === 0) return ['*']
  const found: string[] = []
  const shown = (path: string) => path || '.'
  for (const x of a.map(normalizePath)) for (const y of b.map(normalizePath)) if (covers(x, y) || covers(y, x)) found.push(x === y ? shown(x) : `${shown(x)} ~ ${shown(y)}`)
  return found
}

export const byId = (ledger: Ledger, id: string): Task | undefined => ledger.find(task => task.id === id)

export const byAgent = (ledger: Ledger, agentId: string): Task | undefined => ledger.find(task => task.agentId === agentId)

/** A session worker is its own process: the mod cannot fence its writes (ADR-0050). */
export const isSession = (task: Task): boolean => task.runAs === 'session'

/** A task waiting for the coordinator's own call (an Agent call, or start_session): blocked, with its hand-off. */
export const isHandedOff = (task: Task): boolean => task.status === 'blocked' && task.handoff === true

export const isActive = (task: Task): boolean => task.status === 'running'

export const activeCount = (ledger: Ledger): number => ledger.filter(isActive).length

/** A task handed off, session or subagent, waits for the coordinator's own call and holds its slot: no more are handed off than the cap lets run. */
export const holdsSlot = (task: Task): boolean => isHandedOff(task)

/** A running writer, and a handed-off one: the call that starts it is coming, so it holds the one-writer rule too. A session has a worktree of its own. */
export const activeWriters = (ledger: Ledger): Task[] => ledger.filter(task => (isActive(task) || isHandedOff(task)) && task.isWriter && !isSession(task))

export const addTask = (ledger: Ledger, task: Task): { ledger: Ledger; refused?: string } => {
  if (byId(ledger, task.id)) return { ledger, refused: `task ${task.id} already exists` }
  const missing = task.deps.filter(dep => !byId(ledger, dep))
  if (missing.length) return { ledger, refused: `task ${task.id} depends on unknown task(s) ${missing.join(', ')}` }
  return { ledger: [...ledger, task] }
}

/** Why a queued task cannot start now, or nothing. */
export const startBlocker = (ledger: Ledger, task: Task, limits: Limits): string | undefined => {
  if (task.status !== 'queued') return `task ${task.id} is ${task.status}`
  const deps = task.deps.map(dep => byId(ledger, dep))
  const waiting = deps.filter(dep => dep && dep.status !== 'completed')
  if (waiting.length) {
    // A task handed off has failed nothing: it waits for the coordinator's own call (start_session, or the Agent call).
    const failed = waiting.filter(dep => dep && ENDED.includes(dep.status) && !isHandedOff(dep))
    if (failed.length) return `dependency ${failed.map(dep => `${dep!.id} (${dep!.status})`).join(', ')} did not complete`
    return `waiting on ${waiting.map(dep => (isHandedOff(dep!) ? `${dep!.id} (handed off, awaiting ${isSession(dep!) ? 'start_session' : 'the Agent call'})` : dep!.id)).join(', ')}`
  }
  if (ledger.filter(other => other.id !== task.id && (isActive(other) || holdsSlot(other))).length >= limits.maxConcurrent) return `${limits.maxConcurrent} workers already running`
  // A session worker has a worktree of its own and lands by rebase: no fence, no one-writer rule.
  if (task.isWriter && !isSession(task)) {
    for (const other of activeWriters(ledger)) {
      if (other.id === task.id) continue
      if (!task.isolated || !other.isolated) {
        if (!task.isolated && !other.isolated) return `writer ${other.id} is running in the same checkout; one writer at a time without isolation`
        return `writer ${other.id} is running without isolation`
      }
      const shared = overlap(task.allowedFiles, other.allowedFiles)
      if (shared.length) return `files overlap with writer ${other.id}: ${shared.join(', ')}`
    }
  }
  return undefined
}

/**
 * The one admission gate: over the rows as they are, `task`'s row moved to `running` with `patch` applied, or why not.
 * A compare-and-set on status (the row must still be `from`: a cancel or an end that got there first wins), then the
 * start rules (`startBlocker`) as if the row were queued. A blocked row is admitted only while it is a hand-off, or,
 * for `resume`, only while it is not: a worker that reported blocked and is resumed by SendMessage (TASK-0289).
 */
export const admit = (ledger: Ledger, task: Task, patch: Partial<Task>, from: TaskStatus, limits: Limits, resume = false): { ledger: Ledger; refused?: string } => {
  const row = byId(ledger, task.id)
  if (!row) return { ledger, refused: `task ${task.id} is no longer in the ledger` }
  const wrongBlock = from === 'blocked' && isHandedOff(row) === resume
  if (row.status !== from || wrongBlock) return { ledger, refused: `task ${task.id} is ${row.status}, not ${from === 'blocked' ? (resume ? 'blocked by its worker' : 'handed off') : from}` }
  const blocker = startBlocker(ledger, { ...row, status: 'queued' }, limits)
  if (blocker) return { ledger, refused: blocker }
  return { ledger: setTask(ledger, task.id, { ...patch, status: 'running' }) }
}

/** The first `agent-<n>` no row has, for a worker the mod did not dispatch. */
export const freeAgentId = (ledger: Ledger): string => {
  let n = ledger.length + 1
  while (byId(ledger, `agent-${n}`)) n++
  return `agent-${n}`
}

/**
 * A worker that began outside dispatch (an Agent-tool spawn): its row added as `running` over the rows as they are, or
 * why not, by the same start rules. The id is the row's own when free, else the first free `agent-<n>`.
 */
export const admitNew = (ledger: Ledger, task: Task, limits: Limits): { ledger: Ledger; refused?: string; id: string } => {
  const id = !task.id || byId(ledger, task.id) ? freeAgentId(ledger) : task.id
  const row: Task = { ...task, id, status: 'running' }
  const blocker = startBlocker(ledger, { ...row, status: 'queued' }, limits)
  return blocker ? { ledger, refused: blocker, id } : { ledger: [...ledger, row], id }
}

/**
 * The queued tasks that may start now, in creation order, as many as the slots allow.
 * `sessions` false: a session task may not be handed off in this pass, so it is passed over and reserves no slot.
 */
export const runnable = (ledger: Ledger, limits: Limits, sessions = true): Task[] => {
  const out: Task[] = []
  let view = ledger
  for (const task of ledger.filter(task => task.status === 'queued')) {
    if (!sessions && isSession(task)) continue
    if (startBlocker(view, task, limits) !== undefined) continue
    out.push(task)
    view = view.map(one => (one.id === task.id ? { ...one, status: 'running' } : one))
  }
  return out
}

export const setTask = (ledger: Ledger, id: string, patch: Partial<Task>): Ledger => ledger.map(task => (task.id === id ? { ...task, ...patch } : task))

/** The word for the whole run: done only when nothing failed, blocked or stayed open. A cancelled task neither fails nor blocks it. */
export const overall = (ledger: Ledger): { word: 'done' | 'partial' | 'blocked' | 'failed' | 'running' | 'idle'; why: string } => {
  if (ledger.length === 0) return { word: 'idle', why: 'no task' }
  // A task handed off waits for the coordinator's own call: the run is still going, not blocked.
  const open = ledger.filter(task => !ENDED.includes(task.status) || isHandedOff(task))
  const failed = ledger.filter(task => task.status === 'failed')
  const blocked = ledger.filter(task => task.status === 'blocked' && !isHandedOff(task))
  const partial = ledger.filter(task => task.status === 'partial')
  const cancelled = ledger.filter(task => task.status === 'cancelled')
  if (failed.length) return { word: 'failed', why: `${failed.map(task => `${task.id} (${task.role}) ${task.status}`).join(', ')}` }
  if (blocked.length) return { word: 'blocked', why: blocked.map(task => `${task.id} (${task.role})`).join(', ') }
  // A queued task stuck behind a task that ended without completing (a cancelled one too) cannot run: the run is blocked, not running.
  for (const task of open) {
    const root = stalledBy(ledger, task)
    if (root) return { word: 'blocked', why: `${task.id} is stalled by ${root.id} (${root.status})` }
  }
  if (open.length) return { word: 'running', why: open.map(task => `${task.id} ${isHandedOff(task) ? 'handed off' : task.status}`).join(', ') }
  if (partial.length) return { word: 'partial', why: partial.map(task => `${task.id} (${task.role})`).join(', ') }
  // Nothing completed and nothing is left: the person cancelled it all, which is not a finished run.
  if (cancelled.length === ledger.length) return { word: 'idle', why: `${cancelled.length} task(s) cancelled` }
  const done = ledger.length - cancelled.length
  return { word: 'done', why: cancelled.length ? `${done} task(s) completed, ${cancelled.length} cancelled` : `${ledger.length} task(s) completed` }
}

/**
 * The deny auto mode gives an action no model request asked for, as a plugin's
 * spawn is: the engine says to issue it again once, as-is.
 */
export const isNoVerdict = (deny: string): boolean => /gave no verdict|did not ask for one/i.test(deny)

/** What a re-dispatch under an existing id may retry: a task that ended without completing. */
export const RETRYABLE: readonly TaskStatus[] = ['blocked', 'failed', 'partial']

/** Whether `from` reaches `target` through its dependencies. */
const reaches = (ledger: Ledger, from: string, target: string, seen = new Set<string>()): boolean => {
  if (from === target) return true
  if (seen.has(from)) return false
  seen.add(from)
  return (byId(ledger, from)?.deps ?? []).some(dep => reaches(ledger, dep, target, seen))
}

/**
 * A dispatch: a new task added, or, under the id of a retryable task, that task
 * queued again in its place as its next retry, its dependants still waiting on it.
 */
/** The rung of a model alias or id on the ladder, or -1 when it names none. */
export const modelRank = (model: string): number => familyRank(model)

/** How a retry asks for more than the run before it, or undefined: a bigger model or a higher effort is an escalation. */
export const escalationOf = (old: Settings, fresh: Settings): string | undefined => {
  const steps = [
    ...(modelRank(fresh.model) > modelRank(old.model) && modelRank(old.model) >= 0 ? [`model ${old.model} → ${fresh.model}`] : []),
    ...(EFFORTS.indexOf(fresh.effort as never) > EFFORTS.indexOf(old.effort as never) && EFFORTS.indexOf(old.effort as never) >= 0 ? [`effort ${old.effort} → ${fresh.effort}`] : []),
  ]
  return steps.length ? steps.join(', ') : undefined
}

export const retryTask = (ledger: Ledger, fresh: Task, limits: Limits): { ledger: Ledger; refused?: string } => {
  const old = byId(ledger, fresh.id)
  if (!old) return addTask(ledger, fresh)
  if (!RETRYABLE.includes(old.status)) return { ledger, refused: `task ${fresh.id} already exists and is ${old.status}; only a ${RETRYABLE.join(', ')} task is retried under its id` }
  const capped = mayRetry(old, limits)
  if (capped) return { ledger, refused: capped }
  const missing = fresh.deps.filter(dep => !byId(ledger, dep))
  if (missing.length) return { ledger, refused: `task ${fresh.id} depends on unknown task(s) ${missing.join(', ')}` }
  const cycle = fresh.deps.filter(dep => reaches(ledger, dep, fresh.id))
  if (cycle.length) return { ledger, refused: `task ${fresh.id} may not depend on ${cycle.join(', ')}: it waits on ${fresh.id}` }
  // A retry on a bigger model or a higher effort is also an escalation, counted against its own limit (TASK-0224).
  const raised = escalationOf(old.requested, fresh.requested)
  if (raised) {
    const spent = mayEscalate(old, limits)
    if (spent) return { ledger, refused: `${spent} (this retry asks for ${raised})` }
  }
  const retries = old.retries + 1
  const escalations = old.escalations + (raised ? 1 : 0)
  const task: Task = { ...fresh, retries, escalations, createdAt: old.createdAt, notes: [...fresh.notes, `retry ${retries} of ${limits.maxRetries} after ${old.status}`, ...(raised ? [`escalation ${escalations} of ${limits.maxEscalations}: ${raised}`] : [])] }
  // Replaced, not merged: the old row's agent, report, reason and hand-off go.
  return { ledger: ledger.map(one => (one.id === fresh.id ? task : one)) }
}

/**
 * The task a queued one is stuck behind: a dependency, or a dependency's own,
 * that ended without completing. It starts only once that one is retried and completes.
 */
export const stalledBy = (ledger: Ledger, task: Task, seen = new Set<string>()): Task | undefined => {
  if (task.status !== 'queued') return undefined
  for (const dep of task.deps.map(id => byId(ledger, id))) {
    if (!dep || seen.has(dep.id)) continue
    seen.add(dep.id)
    // Not stalled: a handed-off task is not retried, it is started by the coordinator's call.
    if (isHandedOff(dep)) continue
    if (ENDED.includes(dep.status) && dep.status !== 'completed') return dep
    const deeper = stalledBy(ledger, dep, seen)
    if (deeper) return deeper
  }
  return undefined
}

/** The handed-off task (session or subagent) a queued one waits behind, directly or through its own dependencies. */
export const handoffRoot = (ledger: Ledger, task: Task, seen = new Set<string>()): Task | undefined => {
  if (task.status !== 'queued') return undefined
  for (const dep of task.deps.map(id => byId(ledger, id))) {
    if (!dep || seen.has(dep.id)) continue
    seen.add(dep.id)
    if (isHandedOff(dep)) return dep
    const deeper = handoffRoot(ledger, dep, seen)
    if (deeper) return deeper
  }
  return undefined
}

/** What a task behind a handed-off task says: no retry, the call its hand-off names. */
export const handoffWaitText = (task: Task, root: Task): string =>
  `waits on ${root.id} (handed off): its ${isSession(root) ? 'start_session' : 'Agent'} call is not made yet; make the call its hand-off names, or cancel ${task.id}`

/**
 * What a stalled task says, by the state of the root it waits on: a cancelled root is never retried, a turn-capped one
 * is resumed (a re-dispatch starts fresh and loses its edits), any other is retried under its id.
 */
export const stallText = (task: Task, root: Task, limits?: Limits): string => {
  const head = `waits on ${root.id} (${root.status}): `
  if (root.status === 'cancelled') return `${head}${root.id} was cancelled: cancel ${task.id}, or dispatch a new task with the same dependencies`
  if (root.status === 'partial' && root.notes.includes(TURN_CAP_NOTE) && root.agentId) return `${head}resume ${root.id} with SendMessage to its agent id ${root.agentId}; a re-dispatch would start fresh and lose its edits`
  const spent = limits !== undefined && root.retries >= limits.maxRetries
  const count = limits === undefined ? '' : ` (retry ${root.retries + 1} of ${limits.maxRetries})`
  if (spent) return `${head}${root.id} has used its ${limits!.maxRetries} retries: cancel ${task.id}, or dispatch a new task with the same dependencies`
  return `${head}dispatch ${root.id} again under its id to retry it${count}, or cancel ${task.id}`
}

/** Whether a retry or an escalation is still within the limits. */
export const mayRetry = (task: Task, limits: Limits): string | undefined =>
  task.retries >= limits.maxRetries ? `task ${task.id} has used its ${limits.maxRetries} retries: stop and report` : undefined

export const mayEscalate = (task: Task, limits: Limits): string | undefined =>
  task.escalations >= limits.maxEscalations ? `task ${task.id} has used its ${limits.maxEscalations} escalation(s): stop and report` : undefined

const settingsText = (settings: Settings | undefined): string => (settings ? `${settings.model}/${settings.effort}` : '?')

/** A token count as the line prints it: 980, 12.4k, 1.2M. */
export const tokensText = (tokens: number): string =>
  tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}k` : String(tokens)

/** A turn's usage as the engine reports it, the four counts summed; undefined when it reported none. */
export const usageTokens = (usage: unknown): number | undefined => {
  if (typeof usage !== 'object' || usage === null) return undefined
  const one = usage as Record<string, unknown>
  const count = (key: string) => (typeof one[key] === 'number' ? (one[key] as number) : 0)
  return count('input_tokens') + count('output_tokens') + count('cache_read_input_tokens') + count('cache_creation_input_tokens')
}

/** The tokens every task reported, summed, and how many reported. */
export const runTokens = (ledger: Ledger): { tokens: number; counted: number } =>
  ledger.reduce((sum, task) => (task.tokens === undefined ? sum : { tokens: sum.tokens + task.tokens, counted: sum.counted + 1 }), { tokens: 0, counted: 0 })

/** One line a task, in the shape the brief asks for. */
export const line = (task: Task): string => {
  const observed = task.observed ? `observed ${settingsText(task.observed)}` : task.resolvedModel ? `resolved ${task.resolvedModel}, effort unverified` : 'unverified'
  const next = task.report?.next?.trim() || task.reason || (task.status === 'queued' ? 'waits for its turn' : task.status === 'running' ? 'collect it' : '')
  const mismatch = task.notes.find(one => one.startsWith('effort mismatch'))
  return `${task.id} → ${task.role}${task.agentId ?? task.sessionId ? ` [${task.agentId ?? task.sessionId}]` : ''} → requested ${settingsText(task.requested)} → ${observed}${mismatch ? ` (${mismatch})` : ''} → ${task.status}${task.tokens !== undefined ? ` · ${tokensText(task.tokens)} tok` : ''}${task.branch ? ` · branch ${task.branch}` : ''}${next ? ` → ${next}` : ''}`
}

export const summary = (ledger: Ledger): string => (ledger.length ? ledger.map(line).join('\n') : 'No task in the ledger.')

/** Why one queued task waits, in the words `blockers` prints; undefined for a task that is not queued. */
export const blockerFor = (ledger: Ledger, task: Task, limits: Limits): string | undefined => {
  if (task.status !== 'queued') return undefined
  const root = stalledBy(ledger, task)
  const handed = root ? undefined : handoffRoot(ledger, task)
  return root ? stallText(task, root, limits) : handed ? handoffWaitText(task, handed) : (startBlocker(ledger, task, limits) ?? (task.reason || 'ready'))
}

export const blockers = (ledger: Ledger, limits: Limits): string[] =>
  ledger.filter(task => task.status === 'queued').map(task => `${task.id}: ${blockerFor(ledger, task, limits)}`)

/** What the status line counts: the tasks holding a slot (running, and handed off), the queued ones, and the policy. */
export const statusSummary = (ledger: Ledger, policy: string): { policy: string; running: number; queued: number } => ({
  policy,
  running: ledger.filter(task => isActive(task) || holdsSlot(task)).length,
  queued: ledger.filter(task => task.status === 'queued').length,
})

/** A row of the audit trail: no prompt, no report body, no secret. */
export const auditRow = (task: Task) => ({
  id: task.id,
  role: task.role,
  taskClass: task.taskClass,
  status: task.status,
  requested: task.requested,
  resolvedModel: task.resolvedModel,
  tokens: task.tokens,
  observed: task.observed,
  agentId: task.agentId,
  runAs: task.runAs,
  sessionId: task.sessionId,
  retries: task.retries,
  escalations: task.escalations,
  createdAt: task.createdAt,
  startedAt: task.startedAt,
  endedAt: task.endedAt,
  files: task.allowedFiles,
  reportStatus: task.report?.status,
  handoff: task.handoff,
})

/** Tools whose call writes a file the hook can name. */
export const WRITE_TOOLS: readonly string[] = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']

/**
 * A path resolved against the worker's root `cwd`, `.` and `..` collapsed, no file system touched. `inside` is its
 * segments under the root (lowercased when the root starts with a drive letter, so the comparison ignores case), or
 * undefined when it lies outside; `shown` is what to name: the path under the root, or the full path outside it.
 */
const resolveIn = (cwd: string, path: string): { inside: string | undefined; shown: string } => {
  const root = partsOf(cwd)
  const target = partsOf(path)
  const windows = root.drive !== ''
  const fold = (one: string) => (windows ? one.toLowerCase() : one)
  const rootSegments = collapse([], root.segments, false)
  // A path with a root of its own (a drive, or a leading slash) is taken as given; any other is laid onto the cwd.
  const segments = collapse(target.absolute ? [] : rootSegments, target.segments, false)
  const drive = target.absolute ? target.drive : root.drive
  const full = `${drive ? `${drive}:` : ''}${target.absolute || root.absolute ? '/' : ''}${segments.join('/')}`
  const under = (!target.absolute || (target.drive === root.drive && (root.absolute || !windows))) && segments.length >= rootSegments.length && rootSegments.every((one, at) => fold(one) === fold(segments[at]!))
  if (!under) return { inside: undefined, shown: full }
  const rest = segments.slice(rootSegments.length)
  return { inside: rest.map(fold).join('/'), shown: rest.join('/') }
}

/** A path as the ledger keeps it: relative to `cwd` when under it, else resolved in full. */
export const relativeTo = (cwd: string, path: string): string => resolveIn(cwd, path).shown

/** Why a running worker may not write `path` now, or nothing. */
export const writeBlocker = (ledger: Ledger, task: Task, path: string | undefined, cwd: string): string | undefined => {
  if (!task.isWriter) return `${task.id} (${task.role}) is a read-only assignment and may not write`
  // An unknown checkout cannot fence: with no root every path would resolve as inside, so every write is refused.
  const root = normalizePath(cwd ?? '')
  if (!root.startsWith('/') && !/^[A-Za-z]:/.test(root)) return `${task.id}: the checkout path is unknown, so the write is refused`
  if (path === undefined || path === '') return `${task.id}: a write with no path is refused`
  const target = resolveIn(cwd, path)
  if (target.inside === undefined) return `${task.id} may not write ${target.shown}: outside the checkout (${normalizePath(cwd) || '/'})`
  const inside = target.inside
  // An owned path resolves against the same root, one outside it owns nothing here, and an empty list is the whole root.
  const owns = (owned: readonly string[]): boolean =>
    owned.length === 0 ||
    owned.some(one => {
      const at = resolveIn(cwd, one)
      return at.inside !== undefined && covers(at.inside, inside)
    })
  if (!owns(task.allowedFiles)) return `${task.id} may not write ${target.shown}: outside its allowed files (${task.allowedFiles.join(', ')})`
  for (const other of activeWriters(ledger)) {
    if (other.id === task.id || (other.isolated && task.isolated)) continue
    if (owns(other.allowedFiles)) return `${task.id} may not write ${target.shown}: writer ${other.id} owns it`
  }
  return undefined
}
