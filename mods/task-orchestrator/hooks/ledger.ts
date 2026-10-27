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

export const isActive = (task: Task): boolean => task.status === 'running'

export const activeCount = (ledger: Ledger): number => ledger.filter(isActive).length

export const activeWriters = (ledger: Ledger): Task[] => ledger.filter(task => isActive(task) && task.isWriter)

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
    const failed = waiting.filter(dep => dep && ENDED.includes(dep.status))
    if (failed.length) return `dependency ${failed.map(dep => `${dep!.id} (${dep!.status})`).join(', ')} did not complete`
    return `waiting on ${waiting.map(dep => dep!.id).join(', ')}`
  }
  if (activeCount(ledger) >= limits.maxConcurrent) return `${limits.maxConcurrent} workers already running`
  if (task.isWriter) {
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

/** The queued tasks that may start now, in creation order, as many as the slots allow. */
export const runnable = (ledger: Ledger, limits: Limits): Task[] => {
  const out: Task[] = []
  let view = ledger
  for (const task of ledger.filter(task => task.status === 'queued')) {
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
  return `${task.id} → ${task.role}${task.agentId ? ` [${task.agentId}]` : ''} → requested ${settingsText(task.requested)} → ${observed} → ${task.status}${next ? ` → ${next}` : ''}`
}

export const summary = (ledger: Ledger): string => (ledger.length ? ledger.map(line).join('\n') : 'No task in the ledger.')

export const blockers = (ledger: Ledger, limits: Limits): string[] =>
  ledger.filter(task => task.status === 'queued').map(task => `${task.id}: ${startBlocker(ledger, task, limits) ?? 'ready'}`)

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
  retries: task.retries,
  escalations: task.escalations,
  createdAt: task.createdAt,
  startedAt: task.startedAt,
  endedAt: task.endedAt,
  files: task.allowedFiles,
  reportStatus: task.report?.status,
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
