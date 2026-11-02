// Pure logic: no `$`, so a test calls it directly.
import type { AgentInfo } from 'claude-code'

import type { Activity, AgentRow, BackgroundStatus, BackgroundTask, OrchTask, Task, TaskStatus, WorkflowRun } from '../types'
import { elapsed, fit, hms } from './sigma'
import { ORCH, SESSION_TONES, agentKey, isActive, isOrchWorker, memberCaption, runKey, workersOf } from './sessions'
import type { Member, SessionNode } from './sessions'

export { elapsed, fit }

// The session tree lives in ./sessions (ADR-0045, ADR-0047: agent-watch alone
// owns it); everything it exported from here still is.
export {
  MAIN, ORCH, SESSION_TONES, activityLine, agentKey, iconOf, isActive, isEnded, ledgerBadge, memberCaption, memberTone,
  outcomeOf, progressOf, runKey, sessionTree, toneToken, tokensText,
} from './sessions'
export type { IconKind, Member, Progress, SessionInput, SessionKind, SessionNode } from './sessions'

/** The next tone: the one least used, this session holding the first; ties to the lowest. */
export const nextTone = (tones: Record<string, number>) => {
  const used = new Array<number>(SESSION_TONES.length).fill(0)
  used[0] = 1
  for (const tone of Object.values(tones)) used[tone % used.length] = (used[tone % used.length] ?? 0) + 1
  let best = 0
  for (let tone = 1; tone < used.length; tone++) if ((used[tone] ?? 0) < (used[best] ?? 0)) best = tone
  return best
}

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

/**
 * The caption a session's head draws: an active subagent's own line, without
 * its steps (the tree shows those as the meter). The view and `trimTree` read
 * it from here, so the lines counted are the lines drawn.
 */
export const headCaption = (node: SessionNode, at: number) =>
  node.kind === 'agent' && node.row && node.isActive
    ? memberCaption({ key: node.key, label: '', status: node.status, isActive: true, row: { ...node.row, tasks: undefined } }, at)
    : ''

/**
 * The members of each session the tree draws, and the lines it takes. A
 * session's head and every ledger task are never cut. What is left of `budget`
 * goes to the other members across all the sessions, running ones first and
 * ended ones after, each session keeping its order, so a long session cannot
 * starve the next. A session that lost some says "+N more", a line the budget
 * pays for, and a lone empty session says "No subagent yet.".
 */
export const trimTree = (tree: readonly SessionNode[], budget: number, at: number) => {
  const cost = (member: Member) => 1 + (memberCaption(member, at) === '' ? 0 : 1)
  const isKept = (member: Member) => member.taskId !== undefined
  const lists = new Map(tree.map(node => [node.key, [...node.running, ...node.completed]] as const))
  const isIdle = (node: SessionNode) => node.kind === 'main' && (lists.get(node.key)?.length ?? 0) === 0 && tree.length === 1
  let lines = 0
  for (const node of tree) {
    lines += 2 + (headCaption(node, at) === '' ? 0 : 1) + (isIdle(node) ? 1 : 0)
    for (const member of lists.get(node.key) ?? []) if (isKept(member)) lines += cost(member)
  }
  const fixed = lines
  let left = Math.max(0, budget - fixed)
  const taken = new Map<string, Set<Member>>(tree.map(node => [node.key, new Set<Member>()]))
  const state = new Map(tree.map(node => [node.key, { isStopped: false, isReserved: false }] as const))
  // Each pass offers every session its next members in turn; a member that does
  // not fit stops that session, and the "+N more" line it will need is held back.
  for (const wantRunning of [true, false]) {
    for (const node of tree) {
      const all = (lists.get(node.key) ?? []).filter(member => !isKept(member))
      const flow = state.get(node.key)!
      const live = new Set(node.running)
      all.forEach((member, index) => {
        if (live.has(member) !== wantRunning || flow.isStopped) return
        const isLast = index === all.length - 1
        const need = cost(member) + (!isLast && !flow.isReserved ? 1 : 0) - (isLast && flow.isReserved ? 1 : 0)
        if (need > left) {
          flow.isStopped = true
          return
        }
        left -= need
        lines += cost(member)
        if (!isLast) flow.isReserved = true
        else if (flow.isReserved) flow.isReserved = false
        taken.get(node.key)!.add(member)
      })
      // A session with an ended member ahead of an unshown running one is cut there.
      if (wantRunning && all.some(member => live.has(member) && !taken.get(node.key)!.has(member))) flow.isStopped = true
    }
  }
  const shown = new Map<string, { members: Member[]; hidden: number }>()
  for (const node of tree) {
    const own = taken.get(node.key)!
    const members = (lists.get(node.key) ?? []).filter(member => isKept(member) || own.has(member))
    const hidden = (lists.get(node.key) ?? []).filter(member => !isKept(member) && !own.has(member)).length
    if (hidden > 0) lines++
    shown.set(node.key, { members, hidden })
  }

  return { shown, lines }
}

// ---- Background tasks (ADR-0049) -----------------------------------------
//
// A loop's background shell or monitor: opened from the tool's result, which
// names its id, and ended by its notification, a TaskStop, its owner's end
// when it dies with it, or `classic.Stop`'s in-flight list no longer naming it.

/** The tool result that opens a background task, if the call opened one: Bash's `backgroundTaskId`, Monitor's `taskId`. */
export const backgroundStarted = (
  tool: string,
  args: Record<string, unknown>,
  result: unknown,
  ownerId: string | undefined,
  at: number,
): BackgroundTask | undefined => {
  const out = (result ?? {}) as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')
  if (tool === 'Bash' && typeof out.backgroundTaskId === 'string' && out.backgroundTaskId) {
    const command = text(args.command)
    // A command moved to the background at its timeout started that long ago.
    const late = typeof out.timedOutAfterMs === 'number' ? out.timedOutAfterMs : 0
    return {
      id: out.backgroundTaskId,
      kind: 'shell',
      description: text(args.description) || fit(command, 60),
      command: command || undefined,
      ownerId,
      ...(out.backgroundEndsWithFinalResponse === true ? { endsWithOwner: true as const } : {}),
      status: 'running',
      startedAt: at - late,
    }
  }
  if (tool === 'Monitor' && typeof out.taskId === 'string' && out.taskId) {
    const ws = args.ws as { url?: unknown } | undefined
    const command = text(args.command) || text(ws?.url)
    return { id: out.taskId, kind: 'monitor', description: text(args.description) || fit(command, 60), command: command || undefined, ownerId, status: 'running', startedAt: at }
  }

  return undefined
}

/** A task recorded: a new one appended, a known one (an earlier reconcile) keeping its earlier start. */
export const backgroundAdded = (list: BackgroundTask[], task: BackgroundTask): BackgroundTask[] => {
  const known = list.find(one => one.id === task.id)
  if (known === undefined) return [...list, task]
  return list.map(one => (one.id === task.id ? { ...task, startedAt: Math.min(known.startedAt, task.startedAt) } : one))
}

/** A notification's or a stop's word as a state: a non-zero exit fails a task, whatever word came with it. */
const backgroundWord = (word: string, exitCode: number | undefined): BackgroundStatus =>
  word === 'killed' || word === 'stopped' ? 'killed' : word === 'failed' || (exitCode !== undefined && exitCode !== 0) ? 'failed' : 'completed'

/**
 * A known task ended: its state and exit code set, its end kept from the first
 * time it ended. A task the in-flight list ended without a word takes the
 * notification's when that arrives after.
 */
export const backgroundEnded = (list: BackgroundTask[], id: string, word: string, exitCode: number | undefined, at: number): BackgroundTask[] =>
  list.map(one =>
    one.id === id
      ? { ...one, status: backgroundWord(word, exitCode), exitCode: exitCode ?? one.exitCode, endedAt: one.endedAt ?? at }
      : one,
  )

/**
 * What a task notification's text names: its task, its status, and the exit
 * code its summary gives (`... completed (exit code 1)`). None for a text that
 * names no task.
 */
export const notificationOf = (text: string): { id: string; word: string; exitCode?: number } | undefined => {
  const id = /<task-id>\s*([^<\s]+)\s*<\/task-id>/.exec(text)?.[1]
  if (id === undefined) return undefined
  const word = /<status>\s*([^<\s]+)\s*<\/status>/.exec(text)?.[1]?.toLowerCase() ?? 'completed'
  const code = /exit code[:\s]+(-?\d+)/i.exec(text)?.[1]

  return { id, word, exitCode: code === undefined ? undefined : Number(code) }
}

/** One entry of the engine's in-flight list (`classic.Stop`'s `background_tasks`), the fields read. */
export type InFlight = { id: string; type: string; description?: string; command?: string }

/**
 * The tasks brought up to date with the engine's in-flight list: a shell or
 * monitor it names that is not tracked is added, running from now; a tracked
 * running one it no longer names has ended, `completed` until its notification
 * says otherwise. Subagents and workflows are left out: they are agents and runs.
 */
export const backgroundReconciled = (list: BackgroundTask[], inFlight: readonly InFlight[], at: number): BackgroundTask[] => {
  const kinds = inFlight.filter(one => one.type === 'shell' || one.type === 'monitor')
  const named = new Set(inFlight.map(one => one.id))
  let next = list.map(one => (one.status === 'running' && !named.has(one.id) ? { ...one, status: 'completed' as const, endedAt: at } : one))
  for (const one of kinds) {
    if (next.some(known => known.id === one.id)) continue
    const command = one.command?.replace(/\s+/g, ' ').trim()
    next = [...next, { id: one.id, kind: one.type as 'shell' | 'monitor', description: one.description || fit(command ?? '', 60), command, status: 'running', startedAt: at }]
  }

  return next
}

/** A subagent ended: the running tasks that die with its final answer are stopped. */
export const backgroundOwnerEnded = (list: BackgroundTask[], ownerId: string, at: number): BackgroundTask[] =>
  list.map(one => (one.ownerId === ownerId && one.endsWithOwner && one.status === 'running' ? { ...one, status: 'killed' as const, endedAt: at } : one))
