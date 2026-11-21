/**
 * A project's declared work tracker (`tracker.conf`, ADR-0037) and, when it is
 * a forge, the forge variant of `20.PLAN.md` read as a card. Nothing here
 * writes and nothing calls the network: the project's own rules keep the files
 * current, and the forge owns the tasks.
 *
 * The grammar mirrors project-workflow's `tracker_lib.py` (`load`, `validate`)
 * case for case.
 *
 * Harness-neutral (ADR-0054 clause 4): it imports nothing, and each harness
 * folder that uses it carries a byte-identical copy (check-mods.py rule 10).
 * Change it here, then copy it.
 */

export type Forge = 'gitlab' | 'github'
export type TrackerName = 'files' | Forge
export type Tracker = { tracker: TrackerName; path?: string; declared: boolean }

const CONF = 'tracker.conf'
const BOM = '\uFEFF'
/** The error for a `tracker.conf` that exists but cannot be read; `confProblem` words it as a read failure. */
export const CONF_UNREADABLE = `${CONF}: the file is not readable`
const BOM_ERROR = `${CONF}:1: the file starts with a byte-order mark; save it as UTF-8 without one`
const TRACKERS = ['files', 'gitlab', 'github']
const PATH_KEYS = { gitlab: 'gitlab_project', github: 'github_repo' } as const
const KEYS = ['tracker', 'gitlab_project', 'github_repo']
const SEGMENT = '[A-Za-z0-9][A-Za-z0-9._-]*'
const PATHS = {
  gitlab: new RegExp(`^${SEGMENT}(/${SEGMENT})+$`),
  github: new RegExp(`^${SEGMENT}/${SEGMENT}$`),
}
const SHAPES = { gitlab: 'group/name (subgroups allowed)', github: 'owner/name' }

/**
 * `tracker.conf` read as the declaration: lines of `key = value`, a `#` comment
 * a whole line only. Absent (undefined) means files. A malformed declaration is
 * reported, never guessed past.
 */
export const trackerOf = (text: string | undefined): Tracker | { error: string } => {
  if (text === undefined) return { tracker: 'files', declared: false }
  const conf = new Map<string, string>()
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const [i, raw] of lines.entries()) {
    // tracker_lib.py's strip() keeps a byte order mark, which JS trim() drops: refuse it the same way.
    if (i === 0 && raw.startsWith(BOM)) return { error: BOM_ERROR }
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const at = line.indexOf('=')
    if (at < 0) return { error: `${CONF}:${i + 1}: expected \`key = value\`, got '${raw}'` }
    const key = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    if (!KEYS.includes(key)) return { error: `${CONF}:${i + 1}: unknown key '${key}'. Known: ${KEYS.join(', ')}` }
    if (conf.has(key)) return { error: `${CONF}:${i + 1}: '${key}' is set twice` }
    conf.set(key, value)
  }

  const tracker = conf.get('tracker')
  if (!tracker) return { error: `${CONF}: \`tracker\` is required: one of ${TRACKERS.join(' | ')}` }
  if (tracker !== 'files' && tracker !== 'gitlab' && tracker !== 'github') {
    return { error: `${CONF}: tracker='${tracker}'; known: ${TRACKERS.join(' | ')}` }
  }
  for (const forge of ['gitlab', 'github'] as const) {
    const key = PATH_KEYS[forge]
    if (forge !== tracker && conf.has(key)) {
      return { error: `${CONF}: ${key} belongs to tracker = ${forge}, not ${tracker} - remove it` }
    }
  }
  if (tracker === 'files') return { tracker, declared: true }

  const key = PATH_KEYS[tracker]
  const value = conf.get(key) ?? ''
  if (!value) return { error: `${CONF}: tracker = ${tracker} needs ${key} = ${SHAPES[tracker]}` }
  if (value.includes('://') || value.includes('@') || value.includes(':')) {
    return { error: `${CONF}: ${key}='${value}': names only - the project path, never a host or URL` }
  }
  if (!PATHS[tracker].test(value)) return { error: `${CONF}: ${key}='${value}' is not ${SHAPES[tracker]}` }

  return { tracker, path: value, declared: true }
}

/** Whether the project tracks its work on a forge rather than in `.ai/` files. */
export const isForge = (t: Tracker): t is Tracker & { tracker: Forge } => t.tracker !== 'files'

/** How many lines of one section the card keeps. */
export const SECTION_LINES = 6

export type ForgeState = {
  updated?: string
  current: string[]
  milestone?: string
  board?: string
  blocked: string[]
  next: string[]
  history: string[]
  tag?: string
  hasSections: boolean
}

type Section = 'current' | 'open' | 'blocked' | 'next' | 'history'

/** A Map, so a heading such as `## constructor` finds nothing instead of an Object.prototype member. */
const HEADINGS = new Map<string, Section>([
  ['current state', 'current'],
  ['open milestone and board', 'open'],
  ['blocked', 'blocked'],
  ['next action', 'next'],
  ['history', 'history'],
])

const unmark = (text: string) => text.replace(/`/g, '').trim()

/**
 * The forge variant of `20.PLAN.md` as a card: its *Last updated* line and
 * five sections, each capped at SECTION_LINES lines. Unknown headings and HTML
 * comments are ignored; `hasSections` is false for any other plan.
 */
export const forgeState = (text: string): ForgeState => {
  const state: ForgeState = { current: [], blocked: [], next: [], history: [], hasSections: false }
  const bodies: Record<Section, string[]> = { current: [], open: [], blocked: [], next: [], history: [] }
  let into: Section | undefined
  for (const raw of text.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const line = raw.trim()
    const heading = /^##\s+(.*?)\s*#*$/.exec(line)
    if (heading) {
      into = HEADINGS.get((heading[1] ?? '').toLowerCase())
      if (into) state.hasSections = true
      continue
    }
    if (/^#\s/.test(line)) {
      into = undefined
      continue
    }
    const updated = /^Last updated:\s*(.*?)\.?$/i.exec(line)
    if (updated && !into) {
      if (updated[1]) state.updated = updated[1]
      continue
    }
    if (into && line) bodies[into].push(line)
  }

  state.current = bodies.current.slice(0, SECTION_LINES)
  state.blocked = bodies.blocked.slice(0, SECTION_LINES)
  state.next = bodies.next.slice(0, SECTION_LINES)
  state.history = bodies.history.slice(0, SECTION_LINES)
  for (const line of bodies.open.slice(0, SECTION_LINES)) {
    const m = /^(?:[-*]\s*)?\*{0,2}(Milestone|Board)\*{0,2}\s*:\s*\*{0,2}\s*(.*)$/i.exec(line)
    if (!m?.[2]) continue
    if (m[1]?.toLowerCase() === 'milestone') state.milestone ??= unmark(m[2])
    else state.board ??= unmark(m[2])
  }
  for (const line of bodies.history) {
    const m = /\btag\s+`([^`\s]+)`/i.exec(line)
    if (m?.[1]) {
      state.tag = m[1]
      break
    }
  }

  return state
}

/**
 * What the tool and `/goals` say of a `tracker.conf` that is invalid or
 * unreadable: the error already names the file, so it follows the sentence as
 * is, with one full stop. A grammar error asks for a fix; a read failure does not.
 */
export const confProblem = (error: string) => {
  const said = `Compass cannot read this project's ${error}${/[.!?]$/.test(error) ? '' : '.'}`
  return error === CONF_UNREADABLE ? `${said} No GOALS.md is written.` : `${said} Fix the declaration; no GOALS.md is written.`
}

const named = (t: Tracker) => (t.path ? `${t.tracker} ${t.path}` : t.tracker)

/** The card as plain text for the model. It says nothing was written. */
export const forgeText = (state: ForgeState, tracker: Tracker, where: string) => {
  const lines = [
    `This project tracks its work on ${named(tracker)} (tracker.conf); its tasks are issues there.`,
    `Nothing was written: the state below was read from ${where}.`,
  ]
  if (state.updated) lines.push(`Last updated: ${state.updated}`)
  const section = (title: string, body: string[]) => {
    if (body.length > 0) lines.push('', `${title}:`, ...body.map(one => `  ${one}`))
  }
  section('Current state', state.current)
  if (state.milestone || state.board) lines.push('')
  if (state.milestone) lines.push(`Milestone: ${state.milestone}`)
  if (state.board) lines.push(`Board: ${state.board}`)
  section('Blocked', state.blocked)
  section('Next action', state.next)
  if (state.tag) lines.push('', `Earlier planning is in tag ${state.tag}.`)

  return lines.join('\n')
}

/** The one line that says why no GOALS file is written for a forge project. */
export const forgeDecline = (tracker: Tracker) =>
  `This project tracks its work on ${named(tracker)} per tracker.conf; its tasks are issues there, and no GOALS.md is written.`
