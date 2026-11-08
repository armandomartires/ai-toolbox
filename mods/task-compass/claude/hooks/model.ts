import type { Status, Story, Task, TaskStatus } from '../types'
import { MARKER } from './board.ts'
import { fit } from './sigma'
import type { Token } from './sigma'

// The GOALS.md board itself is harness-neutral: board.ts, a byte-identical
// copy of mods/task-compass/core/board.ts (check-mods.py rule 10).
export { currentSprint, deriveStatus, parseSprints, setStoryStatus, statusFromWords } from './board.ts'
export { fit }

export type StatusStyle = {
  label: string
  glyph: string
  /** A SIGMAorbital token: monochrome by brightness, colour for state only (ADR-0043). */
  color: Token
  /** The checkbox character in GOALS.md; null for a plain item (backlog). */
  marker: string | null
}

export const STATUS: Record<Status, StatusStyle> = {
  backlog: { label: 'Backlog', glyph: '◌', color: 'text-3', marker: MARKER.backlog },
  todo: { label: 'To do', glyph: '○', color: 'text-2', marker: MARKER.todo },
  in_progress: { label: 'In progress', glyph: '◐', color: 'cyan', marker: MARKER.in_progress },
  // Review waits on a human: caution.
  review: { label: 'In review', glyph: '▲', color: 'amber', marker: MARKER.review },
  blocked: { label: 'Blocked', glyph: '◆', color: 'red', marker: MARKER.blocked },
  done: { label: 'Done', glyph: '●', color: 'text-1', marker: MARKER.done },
}

export const STATUSES = Object.keys(STATUS) as Status[]

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
