import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { registerBand } from './band'
import { applyPlan, isActive, mergeListed, spawnedRow } from './model'
import type { PlanUpdate } from './model'
import { PANE, TITLE, renderPane } from './view'
import type { Task } from '../types'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])

/** The desktop app's plan tools, by name under any MCP prefix. */
const PLAN_TOOL = /(^|__)update_plan$/
const WRAP_TOOL = /(^|__)wrap_up$/

/** How often the pane is brought up to date while an agent is active. */
const TICK_MS = 1_000
/** How often a running agent's icon pulses. */
export const FRAME_MS = 400

const refresh = async ($: EngineInterface) => {
  const [listed, at] = await Promise.all([$.agent.list(), $.clock.now()])
  await update($, agents, rows => mergeListed(rows, listed, at))
  await update($, now, () => at)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // The pane first: a session the desktop app hosts through the SDK reports
    // no person at the prompt, yet draws panes, and with no surface to draw
    // it the pane waits undrawn. `/agents` is a name Claude Code ships, so the
    // command is `/agent-watch`.
    void $.ui.open({ id: PANE, title: TITLE })
    await $.command.register({ name: 'agent-watch', description: 'Open the Agents pane: the subagents of this session' })
    await refresh($).catch(() => undefined)

    let tick = 0
    $.clock.every(TICK_MS, () => {
      tick++
      void (async () => {
        const rows = await read($, agents)
        // Busy: an agent is active, or ended less than a minute ago.
        const at = await $.clock.now()
        const isBusy = rows.some(row => isActive(row.status) || (row.endedAt ?? 0) > at - 60_000)
        if (isBusy || tick % 10 === 0) await refresh($)
      })().catch(() => undefined)
    })
    // The pulse: the frame moves only while an agent runs, so a still pane
    // is not redrawn.
    $.clock.every(FRAME_MS, () => {
      void (async () => {
        const rows = await read($, agents)
        if (rows.some(row => row.status === 'running')) await update($, frame, n => n + 1)
      })().catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'agent-watch' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })

    return { text: isPlaced ? 'Agents pane opened.' : 'Agents pane is open but this surface does not show panes.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.agentId) {
      const at = await $.clock.now()
      const spawn = { id: ran.agentId, parentId: e.parentAgentId, type: e.subagentType, description: e.description }
      await update($, agents, rows => spawnedRow(rows, spawn, at))
      await update($, now, () => at)
    }

    return ran
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) await refresh($).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) await refresh($).catch(() => undefined)

    return done
  })

  // The main loop's task list: TodoWrite, TaskCreate/TaskUpdate, or the
  // desktop app's plan tools. One hook for every tool: a matcher would make
  // TypeScript expand every connected MCP tool's type, past its depth.
  on('tool.call', async ($, e, next) => {
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
      if (id) await update($, tasks, list => [...list, { id, text: e.subject, status: 'pending' }])
    } else if (e.tool === 'TaskUpdate') {
      await update($, tasks, list =>
        e.status === 'deleted'
          ? list.filter(task => task.id !== e.taskId)
          : list.map(task =>
              task.id === e.taskId
                ? { ...task, text: e.subject ?? task.text, status: (e.status as Task['status'] | undefined) ?? task.status }
                : task,
            ),
      )
    } else if (PLAN_TOOL.test(name)) {
      await update($, tasks, list => applyPlan(list, e as unknown as PlanUpdate))
    } else if (WRAP_TOOL.test(name)) {
      await update($, tasks, list => list.map((task): Task => ({ ...task, status: 'completed' })))
    }

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, renderPane)
  registerBand(on)
}
