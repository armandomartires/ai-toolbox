import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ForgeCard, Source, Sprint, Status, Task } from '../types'
import {
  applyPlan,
  currentSprint,
  parseSprints,
  setStoryStatus,
  STARTER_GOALS,
  STATUS,
  STATUSES,
  statusFromWords,
} from './model'
import type { PlanUpdate } from './model'
import { briefName, layoutOf, parseRoadmap, planSprints, ROADMAP_FILE, taskIdOf } from './plan'
import type { BriefFile } from './plan'
import { CONF_UNREADABLE, confProblem, forgeDecline, forgeState, forgeText, isForge, trackerOf } from './tracker'
import type { Forge, Tracker } from './tracker'
import { THEME_USAGE, remember, setTheme, syncTheme, themeArg, watchTheme } from './sigma'
import { PANE, goalsRow, planNote, registerPane } from './view'
import type { CompassOutput, GoalsOutput } from './view'

// The engine lists a module's $.state reads and writes from atoms declared in
// that same file, so view.tsx declares the ones it draws from again.
const sprints = atom({ plugin: 'task-compass', key: 'sprints' } as const, [])
const focus = atom({ plugin: 'task-compass', key: 'focus' } as const, null)
const tasks = atom({ plugin: 'task-compass', key: 'tasks' } as const, [])
const now = atom({ plugin: 'task-compass', key: 'now' } as const, 0)
const goalsPath = atom({ plugin: 'task-compass', key: 'goalsPath' } as const, '')
const source = atom({ plugin: 'task-compass', key: 'source' } as const, 'goals')
const forge = atom({ plugin: 'task-compass', key: 'forge' } as const, null)

const TITLE = 'Compass'
const GOALS_FILE = 'GOALS.md'
const CONF_FILE = 'tracker.conf'
const PLAN_FILE = '20.PLAN.md'
const STORY_TOOL = 'mcp__task-compass__story'
const PLAN_TOOL = /(^|__)update_plan$/
/** The desktop app's end of a turn: it ticks off the plan's last steps. */
const WRAP_TOOL = /(^|__)wrap_up$/

let goalsMtime = -1
let goalsAt = ''
/** Which board the last load found; only a GOALS.md board is ever written. */
let boardSource: Source = 'goals'
/** The `.ai/` layer's root, when it is the board. */
let aiRoot = ''
/** A root GOALS.md the board no longer reads, because a copy lives under the layout root. */
let leftover = ''
/** Why a declared layer cannot be read: a malformed `.ai-layout.json`, reported as is. */
let layerError = ''
/** What the `.ai/` board was last built from: the roadmap's and each brief's mtime and size. */
let layerKey = ''
/** Each brief's text by its full path, with the mtime and size it was read at. */
const briefCache = new Map<string, { mtimeMs: number; size: number; text: string }>()
/** What `tracker.conf` last said, read again only when its mtime or size moves. */
let confKey = ''
let confTracker: Tracker | { error: string } = { tracker: 'files', declared: false }
/** The forge card on show, when the project tracks its work on a forge. */
let forgeNow: ForgeCard | null = null
/** What the forge card was last built from: the conf, the plan and the strays. */
let forgeKey = ''
/** The forge's plan file, which a Write or Edit of reloads. */
let forgePlan = ''
/** The board the model's copy of the story tool's description carries. */
let described: string | undefined

const join = (dir: string, name: string) => `${dir}${dir.includes('\\') ? '\\' : '/'}${name}`

const isFile = async ($: EngineInterface, path: string) =>
  (await $.fs.stat(path).catch(() => undefined)) !== undefined

/** Shows a board and, when the model's copy of it is stale, asks for the tool to be described again. */
const publish = async ($: EngineInterface, list: Sprint[], from: Source, where: string, card: ForgeCard | null = null) => {
  boardSource = from
  forgeNow = card
  await update($, sprints, () => list)
  await update($, goalsPath, () => where)
  await update($, source, () => from)
  await update($, forge, () => card)
  if (described !== undefined && boardText(list, from) !== described) {
    described = undefined
    $.ui.invalidate('tool.describe')
  }
}

/**
 * Where a project keeps its planning files: `.ai-layout.json`'s root and entry
 * point, or the defaults. A malformed declaration is reported, never guessed past.
 */
const layoutAt = async (
  $: EngineInterface,
  dir: string,
): Promise<{ root: string; entrypoint: string } | { error: string }> => {
  const declared = join(dir, '.ai-layout.json')
  const json = (await isFile($, declared)) ? await $.fs.read(declared).catch(() => '') : undefined
  const layout = layoutOf(json)
  if ('error' in layout) return { error: `${declared}: ${layout.error}` }
  const root = layout.root === '.' ? dir : join(dir, layout.root.replace(/[\\/]/g, dir.includes('\\') ? '\\' : '/'))

  return { root, entrypoint: layout.entrypoint }
}

/**
 * The project's declared tracker: `tracker.conf` beside the session's folder,
 * re-read only when it moves (or when `force` says so); absent means files, and
 * so does anything that is not a regular file, as tracker_lib.py's isfile does.
 * A file that cannot be read is an error and is not cached, so the next load retries.
 */
const trackerAt = async ($: EngineInterface, dir: string, force = false): Promise<Tracker | { error: string }> => {
  const path = join(dir, CONF_FILE)
  const stat = await $.fs.stat(path).catch(() => undefined)
  const key = `${path}#${stat?.kind === 'file' ? `${stat.mtimeMs}:${stat.size}` : 'absent'}`
  if (!force && key === confKey) return confTracker
  const text = stat?.kind === 'file' ? await $.fs.read(path).then(one => one, () => null) : undefined
  if (text === null) {
    confKey = ''
    return { error: CONF_UNREADABLE }
  }
  confKey = key
  confTracker = trackerOf(text)

  return confTracker
}

/**
 * A forge project: the card of `<layout root>/20.PLAN.md`, read and never
 * written. A GOALS.md beside it is neither read nor copied nor drawn; it is
 * only reported. Nothing here calls the forge.
 */
const loadForge = async ($: EngineInterface, dir: string, tracker: Tracker & { tracker: Forge }, force: boolean) => {
  const layout = await layoutAt($, dir)
  leftover = ''
  if ('error' in layout) {
    if (!force && boardSource === 'ai' && layerError === layout.error) return
    forgeKey = ''
    forgePlan = ''
    layerKey = ''
    goalsMtime = -1
    aiRoot = ''
    layerError = layout.error
    return publish($, [], 'ai', layout.error)
  }
  const planPath = join(layout.root, PLAN_FILE)
  const homes = layout.root === dir ? [join(dir, GOALS_FILE)] : [join(dir, GOALS_FILE), join(layout.root, GOALS_FILE)]
  const [planStat, ...found] = await Promise.all([
    $.fs.stat(planPath).catch(() => undefined),
    ...homes.map(path => isFile($, path)),
  ])
  const strays = homes.filter((_, i) => found[i])
  const key = `${confKey}#${layout.root}#${planStat?.mtimeMs}:${planStat?.size}#${strays.join('|')}`
  if (!force && boardSource === 'forge' && key === forgeKey) return
  forgeKey = key
  forgePlan = planPath
  layerKey = ''
  layerError = ''
  goalsMtime = -1
  aiRoot = ''
  const base = { tracker: tracker.tracker, path: tracker.path ?? '', where: planPath, strays }
  const text = planStat?.kind === 'file' ? await $.fs.read(planPath).then(one => one, () => null) : null
  if (planStat && text === null) {
    // Present but unreadable is not "not the forge variant": say so, and read it again next time.
    forgeKey = ''
    const error = `Compass cannot read ${planPath}: it is not a readable file. Nothing is written.`
    const card: ForgeCard = { ...base, tracker: '', path: '', where: error, current: [], blocked: [], next: [], history: [], hasSections: false, error }
    return publish($, [], 'forge', planPath, card)
  }
  const card: ForgeCard = planStat
    ? { ...base, ...forgeState(text ?? '') }
    : { ...base, ...forgeState(''), isMissing: true, where: layout.root }
  await publish($, [], 'forge', planPath, card)
}

/** An invalid `tracker.conf`: shown like a malformed `.ai-layout.json`, nothing written, no fall back to GOALS.md. */
const loadTrackerError = async ($: EngineInterface, dir: string, error: string, force: boolean) => {
  // The error already starts with the file's name; it takes the full path once.
  const shown = error.startsWith(CONF_FILE) ? `${join(dir, CONF_FILE)}${error.slice(CONF_FILE.length)}` : error
  if (!force && boardSource === 'forge' && forgeNow?.error === error) return
  forgeKey = ''
  forgePlan = ''
  layerKey = ''
  goalsMtime = -1
  aiRoot = ''
  layerError = ''
  leftover = ''
  const card: ForgeCard = { tracker: '', path: '', where: shown, strays: [], current: [], blocked: [], next: [], history: [], hasSections: false, error }
  await publish($, [], 'forge', shown, card)
}

/** The forge card as the model reads it, and what to do about a stray GOALS.md. */
const strayNote = (card: ForgeCard) =>
  card.strays.length > 0
    ? ` ${card.strays.join(' and ')} ${card.strays.length > 1 ? 'are' : 'is a'} stray ${GOALS_FILE} that this project's convention forbids on a forge tracker; nothing reads it. Tell the person once and offer to delete it.`
    : ''

const forgeTracker = (card: ForgeCard): Tracker => ({ tracker: card.tracker || 'gitlab', path: card.path, declared: true })

const forgeBody = (card: ForgeCard) => planNote(card) ?? forgeText(card, forgeTracker(card), card.where)

/** What the tool and `/goals` say of a forge card that holds an error: an invalid `tracker.conf`, or a plan file that cannot be read. */
const problem = (error: string) => (error.startsWith('Compass ') ? error : confProblem(error))

/** A project-workflow layer: the entry point and the roadmap both present under the layout's root. */
const findLayer = async ($: EngineInterface, layout: { root: string; entrypoint: string }) =>
  (await isFile($, join(layout.root, layout.entrypoint))) && (await isFile($, join(layout.root, ROADMAP_FILE)))
    ? { root: layout.root }
    : undefined

/**
 * The `.ai/` board, rebuilt only when the roadmap or a brief changed: each
 * tick lists `tasks/` once and reads only the briefs whose mtime or size
 * moved. Nothing here writes.
 */
const loadLayer = async ($: EngineInterface, root: string, force: boolean) => {
  const roadmap = join(root, ROADMAP_FILE)
  const tasksDir = join(root, 'tasks')
  const [stat, entries] = await Promise.all([
    $.fs.stat(roadmap).catch(() => undefined),
    $.fs.list(tasksDir).catch(() => []),
  ])
  const files = entries.filter(entry => entry.kind === 'file' && briefName(entry.name))
  const key = `${root}#${stat?.mtimeMs}:${stat?.size}#${files.map(f => `${f.name}:${f.mtimeMs}:${f.size}`).join('|')}`
  if (!force && boardSource === 'ai' && key === layerKey) return
  layerKey = key
  aiRoot = root
  layerError = ''
  goalsMtime = -1

  // Only the briefs whose mtime or size moved are read, side by side.
  const paths = files.map(entry => join(tasksDir, entry.name))
  const stale = files.filter((entry, i) => {
    const cached = briefCache.get(paths[i]!)
    return !cached || cached.mtimeMs !== entry.mtimeMs || cached.size !== entry.size
  })
  const texts = await Promise.all(stale.map(entry => $.fs.read(join(tasksDir, entry.name)).catch(() => '')))
  stale.forEach((entry, i) =>
    briefCache.set(join(tasksDir, entry.name), { mtimeMs: entry.mtimeMs, size: entry.size, text: texts[i] ?? '' }),
  )
  const seen = new Set(paths)
  for (const path of briefCache.keys()) if (!seen.has(path)) briefCache.delete(path)
  const briefs: BriefFile[] = files.map((entry, i) => ({ file: entry.name, text: briefCache.get(paths[i]!)?.text ?? '' }))

  const text = stat ? await $.fs.read(roadmap).catch(() => '') : ''
  await publish($, planSprints(parseRoadmap(text), briefs, tasksDir), 'ai', root)
}

/**
 * The board of the session's current folder: its GOALS.md under the layout
 * root, else a project-workflow `.ai/` layer, else an empty GOALS.md board.
 * A GOALS.md at the project root is copied under the layout root when that
 * has none; a mod cannot delete, so the root file stays and is reported as a
 * leftover. Without a readable layout the root file is used in place.
 */
const loadGoals = async ($: EngineInterface, force = false) => {
  const dir = (await $.session.cwd()).replace(/[\\/]+$/, '')
  // The declared tracker is read first: a forge or an invalid declaration never reaches the GOALS.md copy below.
  const tracker = await trackerAt($, dir, force)
  if ('error' in tracker) return loadTrackerError($, dir, tracker.error, force)
  if (isForge(tracker)) return loadForge($, dir, tracker, force)
  forgeKey = ''
  const rootPath = join(dir, GOALS_FILE)
  const layout = await layoutAt($, dir)
  const homePath = 'error' in layout || layout.root === dir ? undefined : join(layout.root, GOALS_FILE)
  const statOf = (path: string) => $.fs.stat(path).catch(() => undefined)

  let path = homePath ?? rootPath
  let stat = await statOf(path)
  let stale = ''
  if (homePath && stat) {
    if (await isFile($, rootPath)) stale = rootPath
  } else if (homePath && !stat) {
    const rootStat = await statOf(rootPath)
    if (rootStat) {
      const copied = await $.fs.read(rootPath).then(text => $.fs.write(homePath, text)).then(() => true, () => false)
      stat = copied ? await statOf(homePath) : undefined
      if (stat) stale = rootPath
      else [path, stat] = [rootPath, rootStat]
    }
  }
  leftover = stale

  if (!stat) {
    if ('error' in layout) {
      if (!force && boardSource === 'ai' && layerError === layout.error) return
      layerKey = ''
      goalsMtime = -1
      aiRoot = ''
      layerError = layout.error
      return publish($, [], 'ai', layout.error)
    }
    const layer = await findLayer($, layout)
    if (layer) return loadLayer($, layer.root, force)
  }
  const mtime = stat?.mtimeMs ?? 0
  if (!force && boardSource === 'goals' && mtime === goalsMtime && path === goalsAt) return
  goalsMtime = mtime
  goalsAt = path
  layerKey = ''
  layerError = ''
  const text = stat ? await $.fs.read(path).catch(() => '') : ''
  await publish($, parseSprints(text), 'goals', path)
}

/** A `.ai/` board as the model reads it: the open sprints and their tasks. */
const aiBoardText = (list: Sprint[]) => {
  if (layerError) return `No plan is shown: ${layerError}.`
  const open = list.filter(sprint => sprint.isOpen)
  if (open.length === 0) return 'No sprint is open.'

  return open
    .flatMap(sprint => [
      `${sprint.label ?? `S${sprint.n}`} ${sprint.title} [open]${sprint.goal ? ` goal: ${sprint.goal}` : ''}`,
      ...sprint.stories.map(story => `  ${story.id} ${story.title} [${STATUS[story.status].label}]`),
    ])
    .join('\n')
}

const boardText = (list: Sprint[], from: Source = boardSource) =>
  from === 'forge'
    ? forgeNow ? `${forgeNow.error ?? forgeBody(forgeNow)}${strayNote(forgeNow)}` : ''
    : from === 'ai'
    ? aiBoardText(list)
    : goalsBoardText(list)

const goalsBoardText = (list: Sprint[]) =>
  list
    .flatMap(sprint =>
      sprint.status === 'done'
        ? [`Sprint ${sprint.n} ${sprint.title} [done]`]
        : [
            `Sprint ${sprint.n} ${sprint.title} [${STATUS[sprint.status].label}]${sprint.goal ? ` goal: ${sprint.goal}` : ''}`,
            ...sprint.stories.map(
              story => `  ${story.id} ${story.title} [${STATUS[story.status].label}]`,
            ),
          ],
    )
    .join('\n')

/** Tells the person, through the model, that a root GOALS.md is a copy nothing reads any more. */
const leftoverNote = () =>
  leftover
    ? ` ${leftover} is a leftover copy of the board now kept in ${goalsAt}; tell the person once and offer to delete it.`
    : ''

/**
 * The story tool carries the board and when to call it in its own
 * description, kept out of ToolSearch, so the model reads them every request.
 * Each call reads GOALS.md afresh, so an empty board does not rule calls out:
 * the description may predate the file or the session's move into its folder.
 * The person leaves the board to the model, so the description asks it to
 * keep the board current unprompted.
 */
const storyDescription = (list: Sprint[]) =>
  boardSource === 'forge' && forgeNow
    ? forgeNow.error
      ? `${problem(forgeNow.error)} This tool writes nothing and calls no forge.`
      : [
          `This project tracks its work on ${forgeNow.tracker} ${forgeNow.path} (tracker.conf), so its Compass pane shows a state card read from ${forgeNow.where}, not a sprint board. This tool writes nothing and calls no forge: the tasks are issues there, and the project's own rules keep the state file current. What the card holds:`,
          boardText(list),
        ].join('\n')
    : boardSource === 'ai'
    ? [
        `Record which task of this project's .ai/ plan${aiRoot ? ` (${aiRoot})` : ''} you are working on, for the person's Compass pane: call this with the task's id, e.g. "S087.T004", when you start one, and again when you move to another. This tool writes nothing. A task's status lives in the **Status**: line of its brief in the plan's tasks folder; change it there under the project's own rules, and the pane follows within seconds. Open sprints and their tasks:`,
        aiBoardText(list),
      ].join('\n')
    : list.length === 0
    ? `Update the person's sprint board (${GOALS_FILE}) and their Compass pane. No ${GOALS_FILE} with sprints was found in the session's folder when this was written. If the person has one, or starts one with /goals init, call this all the same with a story id (<sprint>.<story>, e.g. "1.2") and a status: each call reads the file afresh and says which ids exist.${leftoverNote()}`
    : [
        `Update the person's sprint board (${GOALS_FILE}) and their Compass pane. The person relies on you to keep it current and does no upkeep of their own, so do it unprompted as you work: call this with a story id and a status when you start a story (in_progress), hand it over for review (review), finish it (done) or get stuck (blocked); without a status it only marks the story you are working on. Use review only for work the person still has to look at; a story in review is done once they have seen it and moved on without asking for changes, so set it to done then, at the latest when you next call this. Call it again only when the story or its status changes. When you take on work the board has no story for, add one first: a "- [ ] <story>" line under the sprint it belongs to in ${goalsAt || GOALS_FILE}, details indented under it.${leftoverNote()} The board:`,
        boardText(list),
      ].join('\n')

const registerStoryTool = async ($: EngineInterface) =>
  $.tool.register({
    name: 'story',
    description: storyDescription(await read($, sprints)),
    inputSchema: {
      type: 'object',
      properties: {
        story: { type: 'string', description: 'The story id, <sprint>.<story>, e.g. "3.2".' },
        status: { type: 'string', enum: STATUSES, description: 'The story\'s new status.' },
        why: { type: 'string', description: 'A few words on what you are doing for it.' },
      },
      required: ['story'],
    },
    isDeferred: false,
  })

type StoryInput = { story?: unknown; status?: unknown; why?: unknown }

/** The story tool: rewrites a story's checkbox and marks it as the current story. */
const answerStory = async ($: EngineInterface, input: StoryInput) => {
  await loadGoals($, true)
  if (boardSource === 'forge' && forgeNow) return { result: forgeNow.error ? problem(forgeNow.error) : boardText([], 'forge') }
  if (boardSource === 'ai' && layerError && !('error' in confTracker) && isForge(confTracker)) {
    return {
      result: `This project tracks its work on ${confTracker.tracker} ${confTracker.path} (tracker.conf), but Compass cannot read its plan layout: ${layerError}. Nothing was written.`,
    }
  }
  if (boardSource === 'ai') return answerTask($, input)
  const id = String(input.story ?? '').trim().replace(/^s(?:tory)?\s*/i, '')
  const list = await read($, sprints)
  const story = list.flatMap(sprint => sprint.stories).find(one => one.id === id)
  if (!story) {
    return { result: `No story "${id}" in ${GOALS_FILE}. Ids are <sprint>.<story>:\n${boardText(list)}` }
  }

  let changed = ''
  if (input.status !== undefined) {
    const raw = String(input.status)
    const status = (STATUSES as string[]).includes(raw) ? (raw as Status) : statusFromWords(raw)
    if (!status) return { result: `Unknown status "${raw}". Use one of: ${STATUSES.join(', ')}.` }
    const text = await $.fs.read(goalsAt)
    const next = setStoryStatus(text, id, status)
    if (next === undefined) return { result: `Could not find story ${id}'s line in ${GOALS_FILE}.` }
    if (next !== text) await $.fs.write(goalsAt, next)
    await loadGoals($, true)
    changed = ` is now ${STATUS[status].label}`
  }
  await update($, focus, () => ({
    story: id,
    why: typeof input.why === 'string' ? input.why : undefined,
  }))

  return { result: `Story ${id} "${story.title}"${changed}; the Compass pane shows it as the current story.` }
}

/**
 * The story tool on a `.ai/` board: it marks the task Claude is on and
 * writes nothing, whatever it is given. A status belongs in the brief.
 */
const answerTask = async ($: EngineInterface, input: StoryInput) => {
  const raw = String(input.story ?? '').trim()
  const id = taskIdOf(raw)
  const list = await read($, sprints)
  const story = list.flatMap(sprint => sprint.stories).find(one => one.id === id)
  if (!story) return { result: `No task "${raw}" in ${aiRoot}. Ids are S<sprint>.T<task>, e.g. "S087.T004". ${aiBoardText(list)}` }

  await update($, focus, () => ({
    story: story.id,
    why: typeof input.why === 'string' ? input.why : undefined,
  }))
  const where = story.details[1] ?? aiRoot
  const status =
    input.status === undefined
      ? ''
      : ` Nothing was written: the status is line ${story.line + 1} of ${where}. Change it there under the project's own rules, and the pane follows.`

  return { result: `Task ${story.id} "${story.title}" is the one the Compass pane shows you on.${status}` }
}

/**
 * `/goals`'s answer, its board kept so its row draws as a panel. The current
 * sprint is the open one on a `.ai/` board, else the focus's. A declaration:
 * the engine follows `$` past an import only into one.
 */
async function goalsOutput($: EngineInterface, from: string, text: string) {
  const list = await read($, sprints)
  const hasOpen = list.some(one => one.isOpen)
  const cur = currentSprint(list)
  const out: GoalsOutput = { from, sprints: list.map((one, i) => goalsRow(one, hasOpen ? one.isOpen === true : i === cur)) }
  return { text: list.length > 0 ? remember(text, out) : text }
}

/** The clock the board's sprint dates are read against. */
const refreshNow = async ($: EngineInterface) => {
  const at = await $.clock.now()
  await update($, now, () => at)
}

/** Whether a path lies inside a folder, whichever way its slashes lean. */
const isUnder = (path: string, dir: string) => {
  if (!dir) return false
  const norm = (one: string) => one.replace(/\\/g, '/').toLowerCase()

  return norm(path).startsWith(`${norm(dir)}/`)
}

/** Whether two paths are one file, whichever way their slashes lean. */
const isSame = (path: string, other: string) =>
  other !== '' && path.replace(/\\/g, '/').toLowerCase() === other.replace(/\\/g, '/').toLowerCase()

export const register: Register = on => {
  // SIGMAorbital's colours follow the host's theme setting (ADR-0043).
  watchTheme(on)

  on('session.start', async ($, e, next) => {
    await syncTheme($)
    await $.command.register({
      name: 'compass',
      description: 'Open the Compass pane: sprints, stories and the live task list',
      argumentHint: `[${THEME_USAGE}]`,
    })
    await $.command.register({
      name: 'goals',
      description: 'Reload the Compass board (.ai/GOALS.md, a project-workflow .ai/ plan, or a forge project\'s state card); "/goals init" writes a starter .ai/GOALS.md only where the project tracks its work in files and has none',
      argumentHint: '[init]',
    })
    await loadGoals($, true)
    await registerStoryTool($)
    // A resumed or reloaded session would send the description it recorded.
    $.ui.invalidate('tool.describe')
    // The clock the sprint dates are read against, before the first tick.
    await refreshNow($).catch(() => undefined)

    let tick = 0
    $.clock.every(2_000, () => {
      tick++
      void (async () => {
        if (tick % 5 === 0) await refreshNow($)
        if (tick % 3 === 0) await loadGoals($)
      })().catch(() => undefined)
    })

    if (e.isInteractive) void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'compass' }, async ($, e) => {
    // `theme dark|light|auto` pins the colours by hand, before anything else.
    const theme = themeArg(e.args)
    if (theme !== undefined) {
      return { text: 'error' in theme ? `${theme.error}. Usage: /compass ${THEME_USAGE}` : await setTheme($, theme.choice) }
    }
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })
    const list = await read($, sprints)
    const out: CompassOutput = { isPlaced, sprints: list.length, stories: list.reduce((sum, one) => sum + one.stories.length, 0) }
    const text = `${isPlaced ? 'Compass pane opened' : 'Compass pane is open but this surface does not show panes'}: ${out.sprints} sprints, ${out.stories} stories.`

    return { text: remember(text, out) }
  })


  on('command.run', { command: 'goals' }, async ($, e) => {
    await loadGoals($, true)
    if (boardSource === 'forge' && forgeNow) {
      if (forgeNow.error) return { text: problem(forgeNow.error) }
      const where = forgeNow.isMissing ? `There is no ${PLAN_FILE} in ${forgeNow.where} yet.` : `Its state is in ${forgeNow.where}.`

      return { text: `${forgeDecline(forgeTracker(forgeNow))} ${where}${strayNote(forgeNow)}` }
    }
    if (boardSource === 'ai') {
      if (layerError) return { text: `Compass cannot read this project's plan: ${layerError}. Fix the declaration; no ${GOALS_FILE} is written.` }
      if (e.args.trim() === 'init') {
        return { text: `This project plans in ${aiRoot}, which the Compass pane reads; it needs no ${GOALS_FILE}.` }
      }
      const list = await read($, sprints)
      const taskCount = list.reduce((sum, sprint) => sum + sprint.stories.length, 0)
      const open = list.filter(sprint => sprint.isOpen).map(sprint => sprint.label ?? `S${sprint.n}`)
      return goalsOutput(
        $,
        aiRoot,
        `Compass: ${list.length} sprints, ${taskCount} tasks loaded from ${aiRoot}; open: ${open.length > 0 ? open.join(', ') : 'none'}.`,
      )
    }
    if (e.args.trim() === 'init') {
      if (await $.fs.exists(goalsAt)) {
        return { text: `${GOALS_FILE} already exists; edit it to change the sprints.` }
      }
      await $.fs.write(goalsAt, STARTER_GOALS)
      await loadGoals($, true)
    }
    const list = await read($, sprints)
    const storyCount = list.reduce((sum, sprint) => sum + sprint.stories.length, 0)
    const stale = leftover
      ? ` ${leftover} is a leftover copy of the board now kept in ${goalsAt}; delete it with: rm -- "${leftover}"`
      : ''

    return goalsOutput(
      $,
      goalsAt,
      (list.length > 0
        ? `Compass: ${list.length} sprints, ${storyCount} stories loaded from ${goalsAt}.`
        : `Compass: no sprints found in ${goalsAt}. Run /goals init to start one.`) + stale,
    )
  })

  // The description is written when the engine renders the tool, from the
  // GOALS.md of the folder the session is in by then, not at session.start:
  // the desktop app starts a session in a temporary folder and moves it.
  on('tool.describe', { tool: STORY_TOOL }, async ($, e, next) => {
    described = undefined
    await loadGoals($).catch(() => undefined)
    const list = await read($, sprints)
    described = boardText(list)

    return { ...(await next(e)), description: storyDescription(list) }
  })

  on('classic.CwdChanged', async ($, e, next) => {
    await loadGoals($).catch(() => undefined)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) await loadGoals($).catch(() => undefined)

    return next(e)
  })

  // One tool.call hook for every tool: a matcher naming the story tool makes
  // TypeScript expand every connected MCP tool's call type, past its depth.
  on('tool.call', async ($, e, next) => {
    if (String(e.tool) === STORY_TOOL) return answerStory($, e as unknown as StoryInput)

    const ran = await next(e)
    if (e.agentId || ran.deny !== undefined || ran.isError) return ran

    const name = String(e.tool)
    if (e.tool === 'TodoWrite') {
      await update($, tasks, () =>
        e.todos.map((todo, i): Task => ({
          id: String(i + 1),
          text: todo.status === 'in_progress' ? todo.activeForm || todo.content : todo.content,
          status: todo.status,
        })),
      )
    } else if (e.tool === 'TaskCreate') {
      const id = (ran.result as { task?: { id?: string } } | undefined)?.task?.id
      if (id) {
        const task: Task = { id, text: e.subject, status: 'pending' }
        await update($, tasks, list => [...list, task])
      }
    } else if (e.tool === 'TaskUpdate') {
      await update($, tasks, list =>
        e.status === 'deleted'
          ? list.filter(task => task.id !== e.taskId)
          : list.map(task =>
              task.id === e.taskId
                ? {
                    ...task,
                    text: e.subject ?? task.text,
                    status: (e.status as Task['status'] | undefined) ?? task.status,
                  }
                : task,
            ),
      )
    } else if (
      (e.tool === 'Write' || e.tool === 'Edit') &&
      (/(^|[\\/])(GOALS\.md|tracker\.conf)$/i.test(e.file_path) || isUnder(e.file_path, aiRoot) || isSame(e.file_path, forgePlan))
    ) {
      await loadGoals($, true)
    } else if (PLAN_TOOL.test(name)) {
      await update($, tasks, list => applyPlan(list, e as unknown as PlanUpdate))
    } else if (WRAP_TOOL.test(name)) {
      await update($, tasks, list => list.map((task): Task => ({ ...task, status: 'completed' })))
    }

    return ran
  })

  registerPane(on)
}
