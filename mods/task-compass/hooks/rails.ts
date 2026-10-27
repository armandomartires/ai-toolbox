import type { Focus, Sprint, Status, Story, Task } from '../types'
import { currentSprint, guessStory, STATUS, STATUSES, taskStatus, wrap } from './model'
import type { Token } from './sigma'

/** The narrowest a sprint's column gets, and the most columns shown. */
export const COLUMN_MIN = 22
const COLUMNS_MAX = 4
/** The rail and a space, left of a live task, a progress line or an open card. */
export const RAIL_GUTTER = 2
const BAR = 5
const DAY_MS = 86_400_000

export type CardLine = { text: string; color?: Token; bold?: boolean; dim?: boolean }

export type Card = { color: Token; lines: CardLine[] }

/**
 * One row of a sprint's column: a dot and its name, a live task, a progress
 * line, or a run of the rail (`│` with no text). A row with a `key` and a
 * `card` opens the card when its name is pressed.
 */
export type Row = {
  key?: string
  /** `'│ '` hangs the row off the rail, as a live task does. */
  prefix: string
  glyph: string
  /** SIGMAorbital tokens: the glyph's, and the name's where it differs from text-1/2/3. */
  color: Token
  text: string
  textColor?: Token
  bold?: boolean
  dim?: boolean
  card?: Card
}

export const isRailRow = (row: Row) => row.glyph === '│' && !row.text

export const cardHeight = (card: Card) => card.lines.length + 2

export const shortTitle = (sprint: Sprint) =>
  sprint.title.replace(/^sprint\s*\d+\s*[—–:-]?\s*/i, '') || sprint.title

const statusLine = (status: Status): CardLine => ({
  text: `${STATUS[status].glyph} ${STATUS[status].label}`,
  color: STATUS[status].color,
})

const wrapped = (text: string, width: number, style: Omit<CardLine, 'text'> = {}) =>
  wrap(text, width).map(line => ({ ...style, text: line }))

/**
 * The sprint the team is in and the story being worked on: the one Claude
 * named while it is not done, else the current sprint's story in progress,
 * else a guess from the live task's words.
 */
export const focusOf = (sprints: Sprint[], declared: Focus | null, tasks: Task[]) => {
  // A `.ai/` board's open sprints sit together at its end: the middle one is
  // the one the carousel centres, and all of them are searched.
  const open = sprints.flatMap((sprint, i) => (sprint.isOpen ? [i] : []))
  const cur = open.length > 0 ? (open[Math.floor((open.length - 1) / 2)] ?? 0) : currentSprint(sprints)
  const current = open.length > 0 ? open.map(i => sprints[i]!) : sprints[cur] ? [sprints[cur]!] : []
  const stories = current.flatMap(sprint => sprint.stories)
  const named = sprints
    .flatMap(one => one.stories)
    .find(story => story.id === declared?.story && story.status !== 'done')
  const working = stories.find(story => story.status === 'in_progress')
  const liveTask = tasks.find(task => task.status === 'in_progress')
  const guessed = liveTask && current.length > 0 ? guessStory(liveTask.text, stories) : undefined

  return {
    cur,
    focusId: named?.id ?? working?.id ?? guessed,
    isGuess: !named && !working && guessed !== undefined,
  }
}

/**
 * How many sprints fit side by side, which come first, and each column's and
 * card's width. The window centres the current sprint unless the person
 * scrolled it (`scrolled`, the first sprint they left in view).
 */
export const carousel = (cols: number, sprintCount: number, cur: number, scrolled: number | null) => {
  const count = Math.max(1, Math.min(sprintCount, Math.floor(cols / COLUMN_MIN), COLUMNS_MAX))
  const lastFirst = Math.max(0, sprintCount - count)
  const centred = Math.max(0, Math.min(cur - (count >= 3 ? 1 : 0), lastFirst))
  const first = Math.max(0, Math.min(scrolled ?? centred, lastFirst))
  const columnWidth = Math.floor(cols / count)
  // A card fills its column right of the rail; border and padding take four cells.
  const cardWidth = Math.max(8, columnWidth - RAIL_GUTTER)

  return {
    count,
    first,
    centred,
    later: Math.max(0, sprintCount - first - count),
    columnWidth,
    cardWidth,
    inner: Math.max(4, cardWidth - 4),
  }
}

/**
 * The day a sprint ends: the date after the arrow or dash of its `Dates:`
 * line, else its last date. An arrow or dash with nothing after it, or
 * `(open)`, says it has not ended: `2026-10-19 →` has no end.
 */
export const sprintEnd = (sprint: Sprint): string | undefined => {
  const range = /\d{4}-\d{2}-\d{2}\s*(?:→|->|[–—-])\s*(\d{4}-\d{2}-\d{2}|\(open\)|$)/i.exec(sprint.dates)
  if (range) return /^\d/.test(range[1] ?? '') ? range[1] : undefined

  return sprint.dates.match(/\d{4}-\d{2}-\d{2}/g)?.at(-1)
}

/** A sprint's name on the pane: `S087`, or `S3` for a GOALS.md sprint. */
export const sprintLabel = (sprint: Sprint) => sprint.label ?? `S${sprint.n}`

/**
 * The carousel's caption: `Sprint 2 of 5`, or for a `.ai/` board the open
 * sprints and how many there are, `S087–S089 open · 88 sprints`.
 */
export const boardTitle = (sprints: Sprint[], cur: number) => {
  const open = sprints.filter(sprint => sprint.isOpen)
  if (open.length === 0) return `Sprint ${cur + 1} of ${sprints.length}`
  const plural = sprints.length === 1 ? '' : 's'
  // A run of numbers reads as a range; open sprints apart are listed.
  const isRun = open.every((sprint, i) => i === 0 || sprint.n === open[i - 1]!.n + 1)
  const names =
    open.length > 1 && isRun
      ? `${sprintLabel(open[0]!)}–${sprintLabel(open.at(-1)!)}`
      : open.map(sprintLabel).join(', ')

  return `${names} open · ${sprints.length} sprint${plural}`
}

/**
 * Whole days from `nowMs`'s day to the sprint's last day: 0 on it, negative
 * once it is past; undefined without an end date or a clock.
 */
export const daysLeft = (sprint: Sprint, nowMs: number): number | undefined => {
  const end = sprintEnd(sprint)
  if (!end || nowMs <= 0) return undefined
  const today = Date.parse(new Date(nowMs).toISOString().slice(0, 10))

  return Math.round((Date.parse(end) - today) / DAY_MS)
}

export const isLate = (sprint: Sprint, nowMs: number) =>
  sprint.status !== 'done' && (daysLeft(sprint, nowMs) ?? 0) < 0

const daysText = (days: number) =>
  days < 0
    ? `${-days} day${days === -1 ? '' : 's'} late`
    : days === 0
      ? 'ends today'
      : `${days} day${days === 1 ? '' : 's'} left`

/** `▰▰▱▱▱ 2/5`: the sprint's done stories out of all of them. */
export const progressBar = (sprint: Sprint) => {
  const total = sprint.stories.length
  const done = sprint.stories.filter(story => story.status === 'done').length
  const filled = total === 0 ? 0 : Math.round((done / total) * BAR)

  return `${'▰'.repeat(filled)}${'▱'.repeat(BAR - filled)} ${done}/${total}`
}

export type ColumnContext = {
  isCurrent: boolean
  focusId: string | undefined
  isGuess: boolean
  declared: Focus | null
  tasks: Task[]
  /** The rows the column may take before it folds and packs. */
  room: number
  /** The key of the row whose card is open. */
  opened: string | null
  inner: number
  nowMs: number
}

/**
 * A sprint's column, top to bottom: its dot, its progress, then its stories
 * with Claude's live tasks under the one being worked on, a run of the rail
 * between dots while there is room. A long column folds its leading done
 * stories into one dot, the open card's rows counted.
 */
export const columnRows = (one: Sprint, ctx: ColumnContext): Row[] => {
  const { focusId, isGuess, tasks, inner, nowMs } = ctx
  const days = daysLeft(one, nowMs)
  const late = isLate(one, nowMs)

  const sprintCard = (): Card => {
    const doneCount = one.stories.filter(story => story.status === 'done').length
    const counts = STATUSES.filter(status => status !== 'done')
      .map(status => [status, one.stories.filter(story => story.status === status).length] as const)
      .filter(([, n]) => n > 0)
      .map(([status, n]) => `${n} ${STATUS[status].label.toLowerCase()}`)
    return {
      color: STATUS[one.status].color,
      lines: [
        ...wrapped(one.title, inner, { bold: true }),
        statusLine(one.status),
        ...(one.goal ? wrapped(`Goal: ${one.goal}`, inner) : []),
        ...(one.dates ? wrapped(one.dates, inner, { dim: true }) : []),
        ...(days !== undefined && one.status !== 'done'
          ? wrapped(daysText(days), inner, late ? { color: STATUS.blocked.color } : { dim: true })
          : []),
        ...wrapped(`${doneCount}/${one.stories.length} stories done${counts.length ? ` · ${counts.join(' · ')}` : ''}`, inner, { dim: true }),
        ...(one.unknown
          ? wrapped(`${one.unknown} with a status the pane does not know`, inner, { color: STATUS.blocked.color })
          : []),
      ],
    }
  }

  const storyCard = (story: Story): Card => {
    const isFocus = story.id === focusId
    const done = tasks.filter(task => task.status === 'completed').length
    return {
      color: STATUS[story.status].color,
      lines: [
        ...wrapped(story.title, inner, { bold: true }),
        statusLine(story.status),
        ...wrapped(`Story ${story.id} · ${one.title}`, inner, { dim: true }),
        ...story.details.flatMap(detail => wrapped(`· ${detail}`, inner)),
        ...(isFocus && tasks.length > 0
          ? wrapped(`Claude: ${done}/${tasks.length} live tasks done${isGuess ? ' (matched by wording)' : ''}`, inner, { dim: true })
          : []),
        ...(isFocus && ctx.declared?.why ? wrapped(ctx.declared.why, inner, { dim: true }) : []),
      ],
    }
  }

  const taskCard = (task: Task, storyId: string): Card => {
    const status = taskStatus(task.status)
    return {
      color: STATUS[status].color,
      lines: [
        ...wrapped(task.text, inner, { bold: true }),
        statusLine(status),
        ...wrapped(`Claude's live task, for story ${storyId}`, inner, { dim: true }),
      ],
    }
  }

  const header: Row = {
    key: `s${one.n}`,
    prefix: '',
    // The current sprint's mark is the screen's one peak, in white.
    glyph: ctx.isCurrent ? '◉' : STATUS[one.status].glyph,
    color: ctx.isCurrent ? 'white' : STATUS[one.status].color,
    text: `${sprintLabel(one)} ${shortTitle(one)}`,
    bold: ctx.isCurrent,
    dim: !ctx.isCurrent && one.status === 'done',
    card: sprintCard(),
  }
  const progress: Row = {
    prefix: '│ ',
    glyph: '',
    color: 'line',
    text: `${progressBar(one)}${late ? ' LATE' : ''}`,
    textColor: late ? STATUS.blocked.color : undefined,
    dim: !late,
  }

  const taskRows = (story: Story): Row[] => {
    if (story.id !== focusId || tasks.length === 0) return []
    const finished = tasks.filter(task => task.status === 'completed')
    const open = tasks.filter(task => task.status !== 'completed')
    const list: Row[] = []
    if (finished.length > 0) {
      list.push({
        key: `t${one.n}-done`,
        prefix: '│ ',
        glyph: '•',
        color: STATUS.done.color,
        text: `${finished.length} task${finished.length > 1 ? 's' : ''} done`,
        dim: true,
        card: {
          color: STATUS.done.color,
          lines: finished.flatMap(task => wrapped(`✓ ${task.text}`, inner)),
        },
      })
    }
    for (const task of open) {
      const status = taskStatus(task.status)
      list.push({
        key: `t${one.n}-${task.id}`,
        prefix: '│ ',
        glyph: '•',
        color: STATUS[status].color,
        text: task.text,
        bold: status === 'in_progress',
        card: taskCard(task, story.id),
      })
    }
    return list
  }

  const storyRows = (story: Story): Row[] => [
    {
      key: `st${story.id}`,
      prefix: '',
      glyph: STATUS[story.status].glyph,
      color: STATUS[story.status].color,
      text: `${story.id === focusId ? (isGuess ? '~' : '▸') : ''}${story.title}`,
      bold: story.id === focusId,
      dim: story.status === 'done' || story.status === 'backlog',
      card: storyCard(story),
    },
    ...taskRows(story),
  ]

  // The rows a body takes: one each, and the open card's under its row.
  const height = (rows: Row[]) =>
    rows.reduce((n, row) => n + 1 + (row.card && row.key === ctx.opened ? cardHeight(row.card) : 0), 0)
  // The header, its progress and the rail under them.
  const top = [header, progress]
  const fixed = height(top) + 1

  // Leading done stories fold into one dot when the column runs long.
  let stories = one.stories
  const folded: Row[] = []
  if (fixed + height(stories.flatMap(storyRows)) > ctx.room) {
    const leading = stories.findIndex(story => story.status !== 'done')
    const doneCount = leading < 0 ? stories.length : leading
    if (doneCount > 1) {
      const doneStories = stories.slice(0, doneCount)
      stories = stories.slice(doneCount)
      folded.push({
        key: `s${one.n}-done`,
        prefix: '',
        glyph: STATUS.done.glyph,
        color: STATUS.done.color,
        text: `${doneCount} stories done`,
        dim: true,
        card: {
          color: STATUS.done.color,
          lines: doneStories.flatMap(story => wrapped(`✓ ${story.id} ${story.title}`, inner)),
        },
      })
    }
  }

  // A run of the rail between dots while there is room for it.
  const body = [...folded, ...stories.flatMap(storyRows)]
  const rail: Row = { prefix: '', glyph: '│', color: 'line', text: '' }
  const gaps = body.filter((row, i) => i > 0 && !row.prefix).length
  const isSpaced = fixed + height(body) + gaps <= ctx.room
  const spaced = isSpaced ? body.flatMap((row, i) => (i === 0 || row.prefix ? [row] : [rail, row])) : body

  return [
    ...top,
    rail,
    ...spaced,
    ...(one.stories.length === 0 ? [{ ...rail, glyph: '┊', text: 'no stories' }] : []),
  ]
}
