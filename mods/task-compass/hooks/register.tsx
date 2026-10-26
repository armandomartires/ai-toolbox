import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, Sprint, Status, Task } from '../types'
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
import { PANE, registerPane } from './view'

// The engine lists a module's $.state reads and writes from atoms declared in
// that same file, so view.tsx declares the ones it draws from again.
const sprints = atom({ plugin: 'task-compass', key: 'sprints' } as const, [])
const focus = atom({ plugin: 'task-compass', key: 'focus' } as const, null)
const tasks = atom({ plugin: 'task-compass', key: 'tasks' } as const, [])
const agents = atom({ plugin: 'task-compass', key: 'agents' } as const, [])
const now = atom({ plugin: 'task-compass', key: 'now' } as const, 0)
const goalsPath = atom({ plugin: 'task-compass', key: 'goalsPath' } as const, '')

const TITLE = 'Compass'
const GOALS_FILE = 'GOALS.md'
const STORY_TOOL = 'mcp__task-compass__story'
const PLAN_TOOL = /(^|__)update_plan$/
/** The desktop app's end of a turn: it ticks off the plan's last steps. */
const WRAP_TOOL = /(^|__)wrap_up$/
const LINGER_MS = 60_000

let goalsMtime = -1
let goalsAt = ''
/** The board the model's copy of the story tool's description carries. */
let described: string | undefined

/**
 * GOALS.md in the session's current folder, by its full path. A board that
 * differs from the one the story tool's description carries asks the engine
 * to describe the tool again, from the next turn on.
 */
const loadGoals = async ($: EngineInterface, force = false) => {
  const dir = (await $.session.cwd()).replace(/[\\/]+$/, '')
  const path = `${dir}${dir.includes('\\') ? '\\' : '/'}${GOALS_FILE}`
  const stat = await $.fs.stat(path).catch(() => undefined)
  const mtime = stat?.mtimeMs ?? 0
  if (!force && mtime === goalsMtime && path === goalsAt) return
  goalsMtime = mtime
  goalsAt = path
  const text = stat ? await $.fs.read(path).catch(() => '') : ''
  const list = parseSprints(text)
  await update($, sprints, () => list)
  await update($, goalsPath, () => path)
  if (described !== undefined && boardText(list) !== described) {
    described = undefined
    $.ui.invalidate('tool.describe')
  }
}

const boardText = (list: Sprint[]) =>
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
  list.length === 0
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
  const id = String(input.story ?? '').trim().replace(/^s(?:tory)?\s*/i, '')
  await loadGoals($, true)
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'compass',
      description: 'Open the Compass pane: sprints, stories, live tasks, running subagents',
    })
    await $.command.register({
      name: 'goals',
      description: 'Reload GOALS.md for the Compass pane; "/goals init" writes a starter sprint board',
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
      /(^|[\\/])GOALS\.md$/i.test(e.file_path)
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
