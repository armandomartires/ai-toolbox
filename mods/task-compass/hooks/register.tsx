import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, Source, Sprint, Status, Task } from '../types'
import {
  applyPlan,
  isActive,
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
import { PANE, registerPane } from './view'

// The engine lists a module's $.state reads and writes from atoms declared in
// that same file, so view.tsx declares the ones it draws from again.
const sprints = atom({ plugin: 'task-compass', key: 'sprints' } as const, [])
const focus = atom({ plugin: 'task-compass', key: 'focus' } as const, null)
const tasks = atom({ plugin: 'task-compass', key: 'tasks' } as const, [])
const agents = atom({ plugin: 'task-compass', key: 'agents' } as const, [])
const now = atom({ plugin: 'task-compass', key: 'now' } as const, 0)
const goalsPath = atom({ plugin: 'task-compass', key: 'goalsPath' } as const, '')
const source = atom({ plugin: 'task-compass', key: 'source' } as const, 'goals')

const TITLE = 'Compass'
const GOALS_FILE = 'GOALS.md'
const STORY_TOOL = 'mcp__task-compass__story'
const PLAN_TOOL = /(^|__)update_plan$/
/** The desktop app's end of a turn: it ticks off the plan's last steps. */
const WRAP_TOOL = /(^|__)wrap_up$/
const LINGER_MS = 60_000

let goalsMtime = -1
let goalsAt = ''
/** Which board the last load found; only a GOALS.md board is ever written. */
let boardSource: Source = 'goals'
/** The `.ai/` layer's root, when it is the board. */
let aiRoot = ''
/** Why a declared layer cannot be read: a malformed `.ai-layout.json`, reported as is. */
let layerError = ''
/** What the `.ai/` board was last built from: the roadmap's and each brief's mtime and size. */
let layerKey = ''
/** Each brief's text by its full path, with the mtime and size it was read at. */
const briefCache = new Map<string, { mtimeMs: number; size: number; text: string }>()
/** The board the model's copy of the story tool's description carries. */
let described: string | undefined

const join = (dir: string, name: string) => `${dir}${dir.includes('\\') ? '\\' : '/'}${name}`

const isFile = async ($: EngineInterface, path: string) =>
  (await $.fs.stat(path).catch(() => undefined)) !== undefined

/** Shows a board and, when the model's copy of it is stale, asks for the tool to be described again. */
const publish = async ($: EngineInterface, list: Sprint[], from: Source, where: string) => {
  boardSource = from
  await update($, sprints, () => list)
  await update($, goalsPath, () => where)
  await update($, source, () => from)
  if (described !== undefined && boardText(list, from) !== described) {
    described = undefined
    $.ui.invalidate('tool.describe')
  }
}

/**
 * A project-workflow layer in `dir`: `.ai-layout.json` or its defaults, with
 * the entry point and the roadmap both present. A malformed declaration is
 * reported, never guessed past.
 */
const findLayer = async ($: EngineInterface, dir: string): Promise<{ root: string } | { error: string } | undefined> => {
  const declared = join(dir, '.ai-layout.json')
  const json = (await isFile($, declared)) ? await $.fs.read(declared).catch(() => '') : undefined
  const layout = layoutOf(json)
  if ('error' in layout) return { error: `${declared}: ${layout.error}` }
  const root = join(dir, layout.root.replace(/[\\/]/g, dir.includes('\\') ? '\\' : '/'))
  const hasLayer = (await isFile($, join(root, layout.entrypoint))) && (await isFile($, join(root, ROADMAP_FILE)))

  return hasLayer ? { root } : undefined
}

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
 * The board of the session's current folder: its GOALS.md by full path,
 * else a project-workflow `.ai/` layer, else an empty GOALS.md board.
 */
const loadGoals = async ($: EngineInterface, force = false) => {
  const dir = (await $.session.cwd()).replace(/[\\/]+$/, '')
  const path = join(dir, GOALS_FILE)
  const stat = await $.fs.stat(path).catch(() => undefined)
  if (!stat) {
    const layer = await findLayer($, dir)
    if (layer && 'error' in layer) {
      if (!force && boardSource === 'ai' && layerError === layer.error) return
      layerKey = ''
      goalsMtime = -1
      aiRoot = ''
      layerError = layer.error
      return publish($, [], 'ai', layer.error)
    }
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
  from === 'ai'
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

/**
 * The story tool carries the board and when to call it in its own
 * description, kept out of ToolSearch, so the model reads them every request.
 * Each call reads GOALS.md afresh, so an empty board does not rule calls out:
 * the description may predate the file or the session's move into its folder.
 * The person leaves the board to the model, so the description asks it to
 * keep the board current unprompted.
 */
const storyDescription = (list: Sprint[]) =>
  boardSource === 'ai'
    ? [
        `Record which task of this project's .ai/ plan${aiRoot ? ` (${aiRoot})` : ''} you are working on, for the person's Compass pane: call this with the task's id, e.g. "S087.T004", when you start one, and again when you move to another. This tool writes nothing. A task's status lives in the **Status**: line of its brief in the plan's tasks folder; change it there under the project's own rules, and the pane follows within seconds. Open sprints and their tasks:`,
        aiBoardText(list),
      ].join('\n')
    : list.length === 0
    ? `Update the person's sprint board (${GOALS_FILE}) and their Compass pane. No ${GOALS_FILE} with sprints was found in the session's folder when this was written. If the person has one, or starts one with /goals init, call this all the same with a story id (<sprint>.<story>, e.g. "1.2") and a status: each call reads the file afresh and says which ids exist.`
    : [
        `Update the person's sprint board (${GOALS_FILE}) and their Compass pane. The person relies on you to keep it current and does no upkeep of their own, so do it unprompted as you work: call this with a story id and a status when you start a story (in_progress), hand it over for review (review), finish it (done) or get stuck (blocked); without a status it only marks the story you are working on. Use review only for work the person still has to look at; a story in review is done once they have seen it and moved on without asking for changes, so set it to done then, at the latest when you next call this. Call it again only when the story or its status changes. When you take on work the board has no story for, add one first: a "- [ ] <story>" line under the sprint it belongs to in ${GOALS_FILE}, details indented under it. The board:`,
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

const refreshAgents = async ($: EngineInterface) => {
  const [listed, at] = await Promise.all([$.agent.list(), $.clock.now()])
  await update($, agents, rows => {
    const known = new Map(rows.map(row => [row.id, row]))
    for (const info of listed) {
      const row = known.get(info.id)
      const wasActive = row ? isActive(row.status) : true
      known.set(info.id, {
        id: info.id,
        parentId: info.parentId,
        type: info.type,
        description: info.description || row?.description || '',
        status: info.status,
        startedAt: row?.startedAt ?? at,
        endedAt: isActive(info.status)
          ? undefined
          : wasActive
            ? at
            : row?.endedAt ?? at,
      })
    }
    return [...known.values()].filter(
      row => row.endedAt === undefined || at - row.endedAt < LINGER_MS,
    )
  })
  await update($, now, () => at)
}

/** Whether a path lies inside a folder, whichever way its slashes lean. */
const isUnder = (path: string, dir: string) => {
  if (!dir) return false
  const norm = (one: string) => one.replace(/\\/g, '/').toLowerCase()

  return norm(path).startsWith(`${norm(dir)}/`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'compass',
      description: 'Open the Compass pane: sprints, stories, live tasks, running subagents',
    })
    await $.command.register({
      name: 'goals',
      description: 'Reload the Compass board (GOALS.md, or a project-workflow .ai/ plan); "/goals init" writes a starter GOALS.md',
      argumentHint: '[init]',
    })
    await loadGoals($, true)
    await registerStoryTool($)
    // A resumed or reloaded session would send the description it recorded.
    $.ui.invalidate('tool.describe')
    // The clock the sprint dates are read against, before the first tick.
    await refreshAgents($).catch(() => undefined)

    let tick = 0
    $.clock.every(2_000, () => {
      tick++
      void (async () => {
        const rows = await read($, agents)
        const isBusy = rows.some(row => isActive(row.status) || row.endedAt !== undefined)
        if (isBusy || tick % 5 === 0) await refreshAgents($)
        if (tick % 3 === 0) await loadGoals($)
      })().catch(() => undefined)
    })

    if (e.isInteractive) void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'compass' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })

    return { text: isPlaced ? 'Compass pane opened.' : 'Compass pane is open but this surface does not show panes.' }
  })

  on('command.run', { command: 'goals' }, async ($, e) => {
    await loadGoals($, true)
    if (boardSource === 'ai') {
      if (layerError) return { text: `Compass cannot read this project's plan: ${layerError}. Fix the declaration; no ${GOALS_FILE} is written.` }
      if (e.args.trim() === 'init') {
        return { text: `This project plans in ${aiRoot}, which the Compass pane reads; it needs no ${GOALS_FILE}.` }
      }
      const list = await read($, sprints)
      const taskCount = list.reduce((sum, sprint) => sum + sprint.stories.length, 0)
      const open = list.filter(sprint => sprint.isOpen).map(sprint => sprint.label ?? `S${sprint.n}`)
      return {
        text: `Compass: ${list.length} sprints, ${taskCount} tasks loaded from ${aiRoot}; open: ${open.length > 0 ? open.join(', ') : 'none'}.`,
      }
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

    return {
      text:
        list.length > 0
          ? `Compass: ${list.length} sprints, ${storyCount} stories loaded from ${goalsAt}.`
          : `Compass: no sprints found in ${goalsAt}. Run /goals init to start one.`,
    }
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
    else await refreshAgents($).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) await refreshAgents($).catch(() => undefined)

    return done
  })

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.agentId) {
      const at = await $.clock.now()
      const row: AgentRow = {
        id: ran.agentId,
        parentId: e.parentAgentId,
        type: e.subagentType || 'agent',
        description: e.description,
        status: 'running',
        startedAt: at,
      }
      await update($, agents, rows => [...rows.filter(one => one.id !== row.id), row])
      await update($, now, () => at)
    }

    return ran
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
      (/(^|[\\/])GOALS\.md$/i.test(e.file_path) || isUnder(e.file_path, aiRoot))
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
