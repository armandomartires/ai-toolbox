/**
 * The GOALS.md board, harness-neutral (ADR-0054 clause 4): parse the sprints
 * and stories, change a story's checkbox, pick the current sprint. Pure
 * TypeScript that imports nothing, so a harness that needs it carries a
 * byte-identical copy (check-mods.py rule 10): claude/hooks/board.ts,
 * opencode/board.ts, codex/scripts/board.ts. Change it here, then copy it.
 */

/** The six board statuses a sprint, a story or a live task can be in. */
export type Status = 'backlog' | 'todo' | 'in_progress' | 'review' | 'blocked' | 'done'

/** One story of a sprint: a top-level list item under the sprint's heading. */
export type Story = {
  /** `<sprint>.<story>`, both 1-based in file order: `3.2`. */
  id: string
  title: string
  status: Status
  /** The indented lines under the item. */
  details: string[]
  /** 0-based line of the item in GOALS.md; for a `.ai/` brief, of its status. */
  line: number
}

/** One `##` section of GOALS.md; the same shape as claude/types/index.d.ts's Sprint. */
export type Sprint = {
  n: number
  title: string
  goal: string
  dates: string
  /** From a `Status:` line, else derived from the stories. */
  status: Status
  stories: Story[]
  /** How a board names it, `S087`; `S<n>` when absent. */
  label?: string
  /** A `.ai/` sprint the roadmap marks open and that has a task not done. */
  isOpen?: boolean
  /** How many of its stories carry a status the board does not know. */
  unknown?: number
}

/** The checkbox character each status writes in GOALS.md; null for a plain item (backlog). */
export const MARKER: Record<Status, string | null> = {
  backlog: null,
  todo: ' ',
  in_progress: '>',
  review: '?',
  blocked: '!',
  done: 'x',
}

/** The statuses in board order. */
export const STATUSES = Object.keys(MARKER) as Status[]

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
  const marker = MARKER[status]
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
