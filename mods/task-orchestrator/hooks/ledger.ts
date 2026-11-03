// The task ledger, pure: dependencies, concurrency, writer overlap, retries,
// escalations and the completion rules. The hooks module holds one in
// $.state and calls these on it.

import type { Limits } from './routing'
import type { Report, Settings, Task, TaskStatus } from '../types'

export type { Report, Settings, Task, TaskStatus }

export const ENDED: readonly TaskStatus[] = ['completed', 'partial', 'blocked', 'failed', 'cancelled']

export type Ledger = Task[]

/** `a/b` and `a/b/` and `./a/b` are one path; backslashes are separators. */
export const normalizePath = (path: string): string => {
  let out = path.replace(/\\/g, '/').replace(/\/+$/, '')
  out = out.replace(/^\.\//, '')
  return out
}

const covers = (owned: string, path: string): boolean => owned === path || path.startsWith(`${owned}/`) || owned.startsWith(`${path}/`)

/** The paths of `a` and `b` that cover one another; a writer with no list covers everything. */
export const overlap = (a: readonly string[], b: readonly string[]): string[] => {
  if (a.length === 0 || b.length === 0) return ['*']
  const found: string[] = []
  for (const x of a.map(normalizePath)) for (const y of b.map(normalizePath)) if (covers(x, y)) found.push(x === y ? x : `${x} ~ ${y}`)
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

/** A session task handed off, waiting for the coordinator's start_session, holds its slot: no more are handed off than the cap lets run. */
const holdsSlot = (task: Task): boolean => isSession(task) && task.status === 'blocked' && task.handoff === true

export const activeWriters = (ledger: Ledger): Task[] => ledger.filter(task => isActive(task) && task.isWriter && !isSession(task))

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
    // A session task handed off has failed nothing: it waits for the coordinator's start_session call.
    const failed = waiting.filter(dep => dep && ENDED.includes(dep.status) && !(isSession(dep) && isHandedOff(dep)))
    if (failed.length) return `dependency ${failed.map(dep => `${dep!.id} (${dep!.status})`).join(', ')} did not complete`
    return `waiting on ${waiting.map(dep => (isSession(dep!) && isHandedOff(dep!) ? `${dep!.id} (handed off, awaiting start_session)` : dep!.id)).join(', ')}`
  }
  if (ledger.filter(other => other.id !== task.id && (isActive(other) || holdsSlot(other))).length >= limits.maxConcurrent) return `${limits.maxConcurrent} workers already running`
  // A session worker has a worktree of its own and lands by rebase: no fence, no one-writer rule.
  if (task.isWriter && !isSession(task)) {
    for (const other of activeWriters(ledger)) {
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

/** The word for the whole run: done only when nothing failed, blocked or stayed open. */
export const overall = (ledger: Ledger): { word: 'done' | 'partial' | 'blocked' | 'failed' | 'running' | 'idle'; why: string } => {
  if (ledger.length === 0) return { word: 'idle', why: 'no task' }
  const open = ledger.filter(task => !ENDED.includes(task.status))
  const failed = ledger.filter(task => task.status === 'failed' || task.status === 'cancelled')
  const blocked = ledger.filter(task => task.status === 'blocked')
  const partial = ledger.filter(task => task.status === 'partial')
  if (failed.length) return { word: 'failed', why: `${failed.map(task => `${task.id} (${task.role}) ${task.status}`).join(', ')}` }
  if (blocked.length) return { word: 'blocked', why: blocked.map(task => `${task.id} (${task.role})`).join(', ') }
  if (open.length) return { word: 'running', why: open.map(task => `${task.id} ${task.status}`).join(', ') }
  if (partial.length) return { word: 'partial', why: partial.map(task => `${task.id} (${task.role})`).join(', ') }
  return { word: 'done', why: `${ledger.length} task(s) completed` }
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
  const retries = old.retries + 1
  const task: Task = { ...fresh, retries, escalations: old.escalations, createdAt: old.createdAt, notes: [...fresh.notes, `retry ${retries} of ${limits.maxRetries} after ${old.status}`] }
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
    // Not stalled: a handed-off session task is not retried, it is started by the coordinator's call.
    if (isSession(dep) && isHandedOff(dep)) continue
    if (ENDED.includes(dep.status) && dep.status !== 'completed') return dep
    const deeper = stalledBy(ledger, dep, seen)
    if (deeper) return deeper
  }
  return undefined
}

/** The handed-off session task a queued one waits behind, directly or through its own dependencies. */
export const handoffRoot = (ledger: Ledger, task: Task, seen = new Set<string>()): Task | undefined => {
  if (task.status !== 'queued') return undefined
  for (const dep of task.deps.map(id => byId(ledger, id))) {
    if (!dep || seen.has(dep.id)) continue
    seen.add(dep.id)
    if (isSession(dep) && isHandedOff(dep)) return dep
    const deeper = handoffRoot(ledger, dep, seen)
    if (deeper) return deeper
  }
  return undefined
}

/** What a task behind a handed-off session task says: no retry, the start_session call. */
export const handoffWaitText = (task: Task, root: Task): string =>
  `waits on ${root.id} (handed off): its start_session call is not made yet; make the call its hand-off names, or cancel ${task.id}`

/** What a stalled task says: what it waits on and the two ways out. */
export const stallText = (task: Task, root: Task): string =>
  `waits on ${root.id} (${root.status}): dispatch ${root.id} again under its id to retry it, or cancel ${task.id}`

/** Whether a retry or an escalation is still within the limits. */
export const mayRetry = (task: Task, limits: Limits): string | undefined =>
  task.retries >= limits.maxRetries ? `task ${task.id} has used its ${limits.maxRetries} retries: stop and report` : undefined

export const mayEscalate = (task: Task, limits: Limits): string | undefined =>
  task.escalations >= limits.maxEscalations ? `task ${task.id} has used its ${limits.maxEscalations} escalation(s): stop and report` : undefined

const settingsText = (settings: Settings | undefined): string => (settings ? `${settings.model}/${settings.effort}` : '?')

/** One line a task, in the shape the brief asks for. */
export const line = (task: Task): string => {
  const observed = task.observed ? `observed ${settingsText(task.observed)}` : task.resolvedModel ? `resolved ${task.resolvedModel}, effort unverified` : 'unverified'
  const next = task.report?.next?.trim() || task.reason || (task.status === 'queued' ? 'waits for its turn' : task.status === 'running' ? 'collect it' : '')
  const mismatch = task.notes.find(one => one.startsWith('effort mismatch'))
  return `${task.id} → ${task.role}${task.agentId ?? task.sessionId ? ` [${task.agentId ?? task.sessionId}]` : ''} → requested ${settingsText(task.requested)} → ${observed}${mismatch ? ` (${mismatch})` : ''} → ${task.status}${next ? ` → ${next}` : ''}`
}

export const summary = (ledger: Ledger): string => (ledger.length ? ledger.map(line).join('\n') : 'No task in the ledger.')

export const blockers = (ledger: Ledger, limits: Limits): string[] =>
  ledger
    .filter(task => task.status === 'queued')
    .map(task => {
      const root = stalledBy(ledger, task)
      const handed = root ? undefined : handoffRoot(ledger, task)
      return `${task.id}: ${root ? stallText(task, root) : handed ? handoffWaitText(task, handed) : (startBlocker(ledger, task, limits) ?? (task.reason || 'ready'))}`
    })

/** A row of the audit trail: no prompt, no report body, no secret. */
export const auditRow = (task: Task) => ({
  id: task.id,
  role: task.role,
  taskClass: task.taskClass,
  status: task.status,
  requested: task.requested,
  resolvedModel: task.resolvedModel,
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

/** A path as the ledger keeps it: relative to `cwd` when under it, else as given. */
export const relativeTo = (cwd: string, path: string): string => {
  const base = normalizePath(cwd)
  const full = normalizePath(path)
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full
}

/** Why a running worker may not write `path` now, or nothing. */
export const writeBlocker = (ledger: Ledger, task: Task, path: string | undefined, cwd: string): string | undefined => {
  if (!task.isWriter) return `${task.id} (${task.role}) is a read-only assignment and may not write`
  if (path === undefined || path === '') return `${task.id}: a write with no path is refused`
  const target = relativeTo(cwd, path)
  if (task.allowedFiles.length && !task.allowedFiles.map(normalizePath).some(owned => covers(owned, target)))
    return `${task.id} may not write ${target}: outside its allowed files (${task.allowedFiles.join(', ')})`
  for (const other of activeWriters(ledger)) {
    if (other.id === task.id || (other.isolated && task.isolated)) continue
    if (other.allowedFiles.length === 0 || other.allowedFiles.map(normalizePath).some(owned => covers(owned, target)))
      return `${task.id} may not write ${target}: writer ${other.id} owns it`
  }
  return undefined
}
