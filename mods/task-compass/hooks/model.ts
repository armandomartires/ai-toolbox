import type { Sprint, Status, Story, Task, TaskStatus } from '../types'
import { elapsed, fit } from './sigma'
import type { Token } from './sigma'

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
