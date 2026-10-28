import type { AgentRow, OrchTask, Sprint, Status, Story, Task, TaskStatus } from '../types'
import { memberCaption } from './sessions'
import type { Member, SessionNode } from './sessions'
import { elapsed, fit } from './sigma'
import type { Status as Tone, Token } from './sigma'

export { elapsed, fit }

export type StatusStyle = {
  label: string
  glyph: string
  /** A SIGMAorbital token: monochrome by brightness, colour for state only (ADR-0043). */
  color: Token
  /** The checkbox character in GOALS.md; null for a plain item (backlog). */
  marker: string | null
}

export const STATUS: Record<Status, StatusStyle> = {
  backlog: { label: 'Backlog', glyph: '◌', color: 'text-3', marker: null },
  todo: { label: 'To do', glyph: '○', color: 'text-2', marker: ' ' },
  in_progress: { label: 'In progress', glyph: '◐', color: 'cyan', marker: '>' },
  // Review waits on a human: caution.
  review: { label: 'In review', glyph: '▲', color: 'amber', marker: '?' },
  blocked: { label: 'Blocked', glyph: '◆', color: 'red', marker: '!' },
  done: { label: 'Done', glyph: '●', color: 'text-1', marker: 'x' },
}

export const STATUSES = Object.keys(STATUS) as Status[]

const MARKERS: Record<string, Status> = {
  ' ': 'todo',
  '>': 'in_progress',
  '~': 'in_progress',
  '?': 'review',
  '!': 'blocked',
  x: 'done',
  X: 'done',
}

const ITEM = /^([-*+]|\d+[.)])\s+(?:\[(.)\]\s+)?(.*)$/
const SPRINT_HEADING = /^##\s+(.+)$/
const FIELD = /^(goal|dates?|status)\s*:\s*(.+)$/i
const BULLET = /^(?:[-*+]|\d+[.)])\s+/

const clean = (text: string) =>
  text.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim()

/** A status from words people write: "in progress", "Done", "blocked". */
export const statusFromWords = (text: string): Status | undefined => {
  const words = text.toLowerCase().replace(/[\s_-]+/g, ' ').trim()
  if (/^(done|complete|completed|closed|finished|resolved|cancelled|canceled)$/.test(words)) return 'done'
  if (/^(in progress|active|current|doing|started|wip)$/.test(words)) return 'in_progress'
  if (/^(in review|review|reviewing)$/.test(words)) return 'review'
  if (/^blocked$/.test(words)) return 'blocked'
  if (/^(to do|todo|planned|ready|not started)$/.test(words)) return 'todo'
  if (/^backlog$/.test(words)) return 'backlog'

  return undefined
}

/** A sprint with no `Status:` line takes its status from its stories. */
export const deriveStatus = (stories: Story[]): Status => {
  if (stories.length === 0) return 'todo'
  const has = (status: Status) => stories.some(story => story.status === status)
  if (stories.every(story => story.status === 'done')) return 'done'
  if (has('in_progress')) return 'in_progress'
  if (has('review')) return 'review'
  if (has('blocked')) return 'blocked'
  if (has('done')) return 'in_progress'
  if (stories.every(story => story.status === 'backlog')) return 'backlog'

  return 'todo'
}

/**
 * Each `## ` heading of GOALS.md is a sprint; its top-level list items are its
 * stories, their checkbox the status (a plain item is backlog), and the
 * indented lines under one its details. A file with no `## ` heading is one
 * sprint, "Goals".
 */
export const parseSprints = (markdown: string): Sprint[] => {
  const sprints: Sprint[] = []
  const explicit = new Map<number, Status>()
  let sprint: Sprint | undefined
  let story: Story | undefined
  let isInComment = false

  const open = (title: string) => {
    sprint = { n: sprints.length + 1, title, goal: '', dates: '', status: 'todo', stories: [] }
    sprints.push(sprint)
    story = undefined
    return sprint
  }

  markdown.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd()
    if (isInComment) {
      if (line.includes('-->')) isInComment = false
      return
    }
    if (line.trimStart().startsWith('<!--')) {
      isInComment = !line.includes('-->')
      return
    }
    const heading = SPRINT_HEADING.exec(line)
    if (heading?.[1]) {
      open(clean(heading[1]))
      return
    }
    if (/^#\s/.test(line)) {
      story = undefined
      return
    }
    if (line.trim() === '') return

    const item = ITEM.exec(line)
    if (item) {
      const into = sprint ?? open('Goals')
      const marker = item[2]
      story = {
        id: `${into.n}.${into.stories.length + 1}`,
        title: clean(item[3] ?? ''),
        status: marker === undefined ? 'backlog' : MARKERS[marker] ?? 'todo',
        details: [],
        line: i,
      }
      into.stories.push(story)
      return
    }
    if (/^\s/.test(raw) && story) {
      story.details.push(clean(line.trim().replace(BULLET, '')))
      return
    }
    if (!sprint) return

    const field = FIELD.exec(line.trim())
    if (field?.[1] && field[2]) {
      const name = field[1].toLowerCase()
      if (name === 'goal') sprint.goal = clean(field[2])
      else if (name.startsWith('date')) sprint.dates = clean(field[2])
      else {
        const status = statusFromWords(field[2])
        if (status) explicit.set(sprint.n, status)
      }
      return
    }
    if (!sprint.goal && sprint.stories.length === 0) sprint.goal = clean(line)
  })

  return sprints.map(one => ({
    ...one,
    status: explicit.get(one.n) ?? deriveStatus(one.stories),
  }))
}

/** GOALS.md with one story's checkbox changed; undefined when no such story. */
export const setStoryStatus = (
  markdown: string,
  id: string,
  status: Status,
): string | undefined => {
  const story = parseSprints(markdown)
    .flatMap(sprint => sprint.stories)
    .find(one => one.id === id)
  if (!story) return undefined

  const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
  const lines = markdown.split(/\r?\n/)
  const item = ITEM.exec(lines[story.line] ?? '')
  if (!item) return undefined
  const marker = STATUS[status].marker
  lines[story.line] = `${item[1]} ${marker === null ? '' : `[${marker}] `}${item[3] ?? ''}`

  return lines.join(eol)
}

/** The sprint the team is in: the first under way, else the first not done. */
export const currentSprint = (sprints: Sprint[]): number => {
  const active = sprints.findIndex(
    sprint => sprint.status === 'in_progress' || sprint.status === 'review',
  )
  if (active >= 0) return active
  const open = sprints.findIndex(sprint => sprint.status !== 'done' && sprint.status !== 'backlog')
  if (open >= 0) return open

  return Math.max(0, sprints.length - 1)
}

export const taskStatus = (status: TaskStatus): Status =>
  status === 'completed' ? 'done' : status === 'in_progress' ? 'in_progress' : 'todo'

export const STARTER_GOALS = `# Project

<!--
Each "## " heading is a sprint. Optional lines under it: Goal:, Dates:, Status:.
Each top-level list item is a story; its checkbox is its status:
  plain item = Backlog, [ ] To do, [>] In progress, [?] In review, [!] Blocked, [x] Done
Indented lines under a story are its details, shown when you hover its dot.
-->

## Sprint 1 — Foundations
Goal: The first outcome this project must deliver
Dates: 2026-11-02 → 2026-11-13
- [>] First story
  What done looks like for it
- [ ] Second story
- Idea for later

## Sprint 2 — Next
Goal: The outcome after that
- [ ] A story for sprint 2
`

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
    next = next.map((task, i) =>
      done.has(i + 1) ? { ...task, status: 'completed' } : task,
    )
  }
  if (typeof update.start === 'number') {
    const start = update.start
    next = next.map((task, i) =>
      i + 1 === start ? { ...task, status: 'in_progress' } : task,
    )
  }
  if (update.advance === true) {
    next = next.map(task =>
      task.status === 'in_progress' ? { ...task, status: 'completed' } : task,
    )
    const pending = next.findIndex(task => task.status === 'pending')
    next = next.map((task, i) =>
      i === pending ? { ...task, status: 'in_progress' } : task,
    )
  }

  return next
}

const STOP = new Set(
  'a an and the of to for in on with by from into is are be this that it at as or add fix make update write run'.split(
    ' ',
  ),
)
const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !STOP.has(word)),
  )

/** The story sharing the most words with the text, if any word is shared. */
export const guessStory = (text: string, stories: Story[]): string | undefined => {
  const textWords = words(text)
  let best: { id: string; score: number } | undefined
  for (const story of stories) {
    let score = 0
    for (const word of words(`${story.title} ${story.details.join(' ')}`)) {
      if (textWords.has(word)) score++
    }
    if (score > 0 && (!best || score > best.score)) best = { id: story.id, score }
  }

  return best?.id
}

export const isActive = (status: string) =>
  status === 'running' || status === 'pending' || status === 'waiting'

/** How long an ended subagent or ledger task stays listed. */
export const LINGER_MS = 60_000

/** One row of the Subagents panel: a ledger task joined to its agent, or an agent no task claims. */
export type SubagentRow = {
  key: string
  /** A ledger task, which the cap never cuts, or an agent no task claims. */
  kind: 'task' | 'agent'
  /** The agent whose transcript the name opens; absent for a task not started. */
  agentId?: string
  /** `T1 · builder · objective` for a task, `type · description` for an agent. */
  label: string
  status: string
  isActive: boolean
  startedAt?: number
  endedAt?: number
  depth: number
  /** The joined agent, whose position picks the glyph. */
  row?: AgentRow
  /** A ledger word that is not a plain completion, as task-orchestrator colours it. */
  badge?: { status: Tone; word: string }
  /** `model/effort`, observed else requested; none while queued. */
  settings?: string
  /** The tasks a queued one waits on. */
  waits?: string[]
}

/** The badge a ledger word earns, as task-orchestrator's own pane colours it. */
export const ledgerBadge = (status: OrchTask['status']): { status: Tone; word: string } | undefined =>
  status === 'partial' || status === 'blocked'
    ? { status: 'caution', word: status.toUpperCase() }
    : status === 'failed'
      ? { status: 'critical', word: 'FAILED' }
      : status === 'cancelled'
        ? { status: 'offline', word: 'CANCELLED' }
        : undefined

/** The badge an agent's own outcome earns, ported from agent-watch's `outcomeOf`. */
const agentOutcome = (status: string): { status: Tone; word: string } | undefined =>
  status === 'failed' ? { status: 'critical', word: 'FAILED' } : status === 'killed' ? { status: 'offline', word: 'STOPPED' } : undefined

/** A ledger task that will not run again. */
const isEnded = (task: OrchTask) => task.status !== 'queued' && task.status !== 'running'

/** A ledger task as a row: its agent's row joined by `agentId`, the ledger's word winning. */
function taskRow(task: OrchTask, row: AgentRow | undefined): SubagentRow {
  const settings = task.observed ?? task.requested
  const status = task.status === 'queued' ? 'pending' : task.status === 'running' ? row?.status ?? 'running' : 'completed'

  return {
    key: `task-${task.id}`,
    kind: 'task',
    agentId: task.agentId,
    label: `${task.id} · ${task.role} · ${task.objective}`,
    status,
    isActive: !isEnded(task),
    startedAt: task.startedAt,
    endedAt: task.endedAt,
    depth: 0,
    row,
    badge: ledgerBadge(task.status) ?? (row && task.status !== 'completed' ? agentOutcome(row.status) : undefined),
    waits: task.status === 'queued' ? task.deps : undefined,
    settings: task.status === 'queued' ? undefined : `${settings.model}/${settings.effort}`,
  }
}

/**
 * The Subagents panel's rows (ADR-0044): the ledger's tasks first, in ledger
 * order, each with its agent folded in, then the agents no task claims, as
 * they were listed. An ended task lingers `LINGER_MS` after it ended; one
 * with no `endedAt` stays.
 */
export function subagentRows(agentRows: readonly AgentRow[], ledger: readonly OrchTask[], at: number): SubagentRow[] {
  const byId = new Map(agentRows.map(row => [row.id, row]))
  const claimed = new Set(ledger.flatMap(task => (task.agentId ? [task.agentId] : [])))
  const depth = (row: AgentRow): number => {
    const parent = byId.get(row.parentId ?? '')
    return parent ? 1 + depth(parent) : 0
  }
  const tasks = ledger
    .filter(task => task.endedAt === undefined || at - task.endedAt < LINGER_MS)
    .map(task => taskRow(task, task.agentId ? byId.get(task.agentId) : undefined))
  const agents = agentRows
    .filter(row => !claimed.has(row.id))
    .map((row): SubagentRow => ({
      key: row.id,
      kind: 'agent',
      agentId: row.id,
      label: `${row.type} · ${row.description}`,
      status: row.status,
      isActive: isActive(row.status),
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      depth: depth(row),
      row,
    }))

  return [...tasks, ...agents]
}

/**
 * The rows to draw: every ledger task, never cut, then the unclaimed agents
 * capped to the slots `cap` leaves (the newest kept, at least none).
 */
export function shownRows(rows: readonly SubagentRow[], cap: number): SubagentRow[] {
  const tasks = rows.filter(row => row.kind === 'task')
  const agents = rows.filter(row => row.kind === 'agent')
  const slots = Math.max(0, cap - tasks.length)

  return [...tasks, ...(slots === 0 ? [] : agents.slice(-slots))]
}

/** Words wrapped to `width` columns; a word longer than that is cut. */
export const wrap = (text: string, width: number): string[] => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const piece = fit(word, width)
    if (line && line.length + 1 + piece.length > width) {
      lines.push(line)
      line = piece
    } else {
      line = line ? `${line} ${piece}` : piece
    }
  }
  if (line) lines.push(line)

  return lines.length > 0 ? lines : ['']
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
