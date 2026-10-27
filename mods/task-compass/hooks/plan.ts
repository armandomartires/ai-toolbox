import type { Sprint, Story } from '../types'
import { deriveStatus, statusFromWords } from './model'

/**
 * A project-workflow `.ai/` layer read as the pane's sprints and stories:
 * the roadmap's *Sprint history* rows are the sprints, the task briefs in
 * `tasks/` their stories. Nothing here writes; the project's own rules keep
 * the files current.
 */

export const ROADMAP_FILE = '30.ROADMAP.md'
const LAYOUT_KEYS = new Set(['root', 'entrypoint'])

export type Layout = { root: string; entrypoint: string } | { error: string }

/**
 * `.ai-layout.json`'s root and entry point, the defaults when the file is
 * absent. A malformed declaration is reported, never guessed past.
 */
export const layoutOf = (json: string | undefined): Layout => {
  if (json === undefined) return { root: '.ai', entrypoint: '00.CONVENTIONS.md' }
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { error: '.ai-layout.json is not valid JSON' }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { error: '.ai-layout.json is not an object' }
  }
  const fields = data as Record<string, unknown>
  const unknown = Object.keys(fields).filter(key => !LAYOUT_KEYS.has(key))
  if (unknown.length > 0) return { error: `.ai-layout.json has an unknown key: ${unknown.join(', ')}` }
  const root = fields.root ?? '.ai'
  const entrypoint = fields.entrypoint ?? '00.CONVENTIONS.md'
  if (typeof root !== 'string' || typeof entrypoint !== 'string' || !root || !entrypoint) {
    return { error: '.ai-layout.json root and entrypoint must be non-empty strings' }
  }
  if (/^([\\/]|[a-z]:)/i.test(root)) return { error: '.ai-layout.json root must be relative' }

  return { root: root.replace(/^(\.[\\/])+/, '').replace(/[\\/]+$/, '') || '.', entrypoint }
}

/** `NetBoxNetworkModel` as words: `Net Box Network Model`. */
export const spaced = (name: string) =>
  name
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()

const pad3 = (n: number) => String(n).padStart(3, '0')

/** A task's own id, `S087.T004`. */
export const taskId = (sprint: number, task: number) => `S${pad3(sprint)}.T${pad3(task)}`

/** A task id as Claude may write it, `S087.T004`, `s87.t4` or `87.4`, as the pane's. */
export const taskIdOf = (text: string) => {
  const m = /^s?0*(\d{1,3})\s*[._]\s*t?0*(\d{1,3})$/i.exec(text.trim())

  return m?.[1] && m[2] ? taskId(Number(m[1]), Number(m[2])) : text.trim()
}

// Both spellings project-workflow uses: `S087_Name.T004_Name.md`, and the
// `S087.T004_Name.md` its conventions file and fixtures show. A change record
// (`S043_Name.T001.change-record.md`) and the template match neither.
const BRIEF_FILE = /^S(\d{3})(?:_([A-Za-z0-9]+))?\.T(\d{3})_([A-Za-z0-9_]+)\.md$/

export type BriefName = { sprint: number; task: number; name: string }

export const briefName = (file: string): BriefName | undefined => {
  const m = BRIEF_FILE.exec(file)
  if (!m?.[1] || !m[3] || !m[4]) return undefined

  return { sprint: Number(m[1]), task: Number(m[3]), name: m[4] }
}

/** How far into a brief its `**Status**:` line may sit. */
const STATUS_LINES = 20

/**
 * A brief's status: the text of its first `**Status**:` line, its markup
 * stripped, and the 0-based line it is on. Undefined when the brief has none.
 */
export const rawStatus = (text: string): { raw: string; line: number } | undefined => {
  const lines = text.split(/\r?\n/).slice(0, STATUS_LINES)
  const line = lines.findIndex(one => /^\s*\*\*Status\*\*\s*:/i.test(one))
  if (line < 0) return undefined
  const raw = (lines[line] ?? '')
    .replace(/^\s*\*\*Status\*\*\s*:/i, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return { raw, line }
}

/**
 * A raw status read by its first words, as people write them: "completed",
 * "done (2026-10-15), pending the merge request", "not started", "blocked
 * until …". Unknown when neither the first two words nor the first one name a
 * status.
 */
export const statusOfRaw = (raw: string) => {
  const words = raw.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  const status = statusFromWords(words.slice(0, 2).join(' ')) ?? statusFromWords(words[0] ?? '')

  return status ? { status, known: true } : { status: 'todo' as const, known: false }
}

export type RoadmapRow = { n: number; name: string; dates: string; theme: string; isMarkedOpen: boolean }

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())

/** The *Sprint history* table's rows, in file order. */
export const parseRoadmap = (text: string): RoadmapRow[] => {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex(line => /^##\s+Sprint history\b/i.test(line))
  if (start < 0) return []
  const rows: RoadmapRow[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    if (!line.trim().startsWith('|')) continue
    const [sprint = '', dates = '', , theme = ''] = cells(line)
    const m = /^`?S(\d{3})_([A-Za-z0-9_]+)`?$/.exec(sprint)
    if (!m?.[1] || !m[2]) continue
    rows.push({
      n: Number(m[1]),
      name: m[2],
      dates: dates.replace(/`/g, ''),
      theme: theme.replace(/`/g, ''),
      isMarkedOpen: /\(open\)/i.test(dates),
    })
  }

  return rows
}

/**
 * A Dates cell as the pane writes dates: `start → end`, or `start →` while it
 * has no end, or the one date of a one-day sprint.
 */
export const datesOf = (cell: string) => {
  const found = cell.match(/\d{4}-\d{2}-\d{2}/g) ?? []
  if (found.length === 0) return ''
  if (found.length > 1) return `${found[0]} → ${found.at(-1)}`
  // One date: a dash after it says the sprint has not ended.
  return /\d{4}-\d{2}-\d{2}\s*[–—→-]/.test(cell) ? `${found[0]} →` : (found[0] ?? '')
}

export type BriefFile = { file: string; text: string }

export type BriefEntry = { sprint: number; known: boolean; story: Story }

/** A brief as a story of its sprint; undefined when the file is not a brief. */
export const briefStory = (brief: BriefFile, tasksDir: string): BriefEntry | undefined => {
  const named = briefName(brief.file)
  if (!named) return undefined
  const found = rawStatus(brief.text)
  const raw = found?.raw ?? ''
  const { status, known } = statusOfRaw(raw)
  const sep = tasksDir.includes('\\') ? '\\' : '/'

  return {
    sprint: named.sprint,
    known,
    story: {
      id: taskId(named.sprint, named.task),
      title: spaced(named.name),
      status,
      details: [
        known ? `Status: ${raw}` : `Status: "${raw}" is not a status the pane knows; shown as To do`,
        `${tasksDir}${sep}${brief.file}`,
      ],
      // For a brief, the line of its status: where Claude edits it.
      line: found?.line ?? 0,
    },
  }
}

/**
 * The roadmap's sprints with their briefs, in number order, the open ones
 * last so they sit together. A sprint is open when its Dates cell says
 * `(open)` and a task of it is not done (rule A of the design brief).
 */
export const planSprints = (rows: RoadmapRow[], briefs: BriefFile[], tasksDir: string): Sprint[] => {
  const entries = briefs
    .map(brief => briefStory(brief, tasksDir))
    .filter((entry): entry is BriefEntry => entry !== undefined)
    .sort((a, b) => a.story.id.localeCompare(b.story.id))
  const byNumber = new Map<number, RoadmapRow>()
  for (const row of rows) if (!byNumber.has(row.n)) byNumber.set(row.n, row)

  const sprints = [...byNumber.values()]
    .sort((a, b) => a.n - b.n)
    .map((row): Sprint => {
      const own = entries.filter(entry => entry.sprint === row.n)
      const stories = own.map(entry => entry.story)
      const unknown = own.filter(entry => !entry.known).length
      return {
        n: row.n,
        label: `S${pad3(row.n)}`,
        title: spaced(row.name),
        // A theme that only points to a review is no goal.
        goal: /^→/.test(row.theme) ? '' : row.theme,
        dates: datesOf(row.dates),
        status: deriveStatus(stories),
        stories,
        isOpen: row.isMarkedOpen && stories.some(story => story.status !== 'done'),
        ...(unknown > 0 ? { unknown } : {}),
      }
    })

  return [...sprints.filter(sprint => !sprint.isOpen), ...sprints.filter(sprint => sprint.isOpen)]
}
