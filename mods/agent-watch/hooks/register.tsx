import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { registerBand } from './band'
import {
  alertText,
  assignTones,
  callEnded,
  callStarted,
  endedBadly,
  isActive,
  markAlerted,
  mergeListed,
  recordRun,
  runningText,
  spawnedRow,
  summarizeCall,
  taskChange,
  tokensOf,
  turnCounted,
  turnEnded,
  turnStarted,
  watchText,
} from './model'
import { remember, syncTheme, watchTheme } from './sigma'
import { PANE, TITLE, renderOutput, renderPane } from './view'
import type { AgentRow } from '../types'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const runs = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const tones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
// task-orchestrator's ledger, read and never written (types/index.d.ts, the mirror).
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])

/** How often the pane is brought up to date while an agent is active. */
const TICK_MS = 1_000
/** How often a running agent's icon pulses. */
export const FRAME_MS = 400

/** The status-line text last set, so the entry is written only when it changes. */
let lastStatus: string | undefined

/** `N agents running` under the prompt; cleared at zero. */
const syncStatus = async ($: EngineInterface) => {
  const rows = await read($, agents)
  const text = runningText(rows.filter(row => isActive(row.status)).length)
  if (text !== lastStatus) {
    lastStatus = text
    $.ui.status(text)
  }
}

/**
 * The rows changed by `change`. An agent that just failed or was stopped is
 * toasted once: found inside the updater, which may run twice on a version
 * miss, so the ids are collected in a map. Then each new sub-session gets
 * its tone.
 */
const changeAgents = async ($: EngineInterface, change: (rows: AgentRow[]) => AgentRow[]) => {
  const alerts = new Map<string, AgentRow>()
  await update($, agents, rows => {
    const next = change(rows)
    for (const row of endedBadly(rows, next)) alerts.set(row.id, row)
    return markAlerted(next, alerts.keys())
  })
  for (const row of alerts.values()) $.ui.toast(alertText(row), { timeoutMs: 8_000 })
  await syncTones($)
}

/** Each new sub-session's tone: a Workflow run, the orchestrator's run, a delegating agent. */
const syncTones = async ($: EngineInterface) => {
  const [rows, all, tasksOfOrch] = await Promise.all([read($, agents), read($, runs), read($, ledger)])
  await update($, tones, held => assignTones(held, rows, all, tasksOfOrch))
}

/** The rows brought up to date with `$.agent.list()`. */
const refresh = async ($: EngineInterface) => {
  const [listed, at] = await Promise.all([$.agent.list(), $.clock.now()])
  await changeAgents($, rows => mergeListed(rows, listed, at))
  await update($, now, () => at)
  await syncStatus($)
}

export const register: Register = on => {
  // SIGMAorbital's colours follow the host's theme setting (ADR-0043).
  watchTheme(on)

  on('session.start', async ($, e, next) => {
    await syncTheme($)
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
        const [rows, orchTasks] = await Promise.all([read($, agents), read($, ledger)])
        // Busy: an agent is active or ended less than a minute ago, or the
        // orchestrator holds a task that has not ended.
        const at = await $.clock.now()
        const isBusy =
          rows.some(row => isActive(row.status) || (row.endedAt ?? 0) > at - 60_000) ||
          orchTasks.some(task => task.status === 'queued' || task.status === 'running')
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
    const rows = await read($, agents)
    const out = {
      isPlaced,
      running: rows.filter(row => isActive(row.status)).length,
      completed: rows.filter(row => row.status === 'completed').length,
      failed: rows.filter(row => row.status === 'failed' || row.status === 'killed').length,
    }

    return { text: remember(watchText(out), out) }
  })

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.agentId) {
      const at = await $.clock.now()
      const runId = e.workflow?.runId || undefined
      const spawn = { id: ran.agentId, parentId: e.parentAgentId, type: e.subagentType, description: e.description, model: ran.model, runId }
      // A Workflow agent opens its run, which the tool's result names.
      if (runId) await update($, runs, all => recordRun(all, { id: runId, startedAt: at }))
      await changeAgents($, rows => spawnedRow(rows, spawn, at))
      await update($, now, () => at)
      await syncStatus($)
    }

    return ran
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      // A subagent its turn ended, woken again: it runs, whatever the list says.
      await changeAgents($, rows => turnStarted(rows, id)).catch(() => undefined)
      await refresh($).catch(() => undefined)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) {
      const id = e.agentId
      const tokens = tokensOf(e.usage)
      const model = e.usage?.model
      const at = await $.clock.now()
      // A subagent's end is its turn's: the list lags, or drops it unsaid,
      // and names no Workflow agent at all.
      await changeAgents($, rows => turnEnded(turnCounted(rows, id, tokens, model), id, e.reason, at)).catch(() => undefined)
      await refresh($).catch(() => undefined)
    }

    return done
  })

  // The moment a subagent stops, before the one-second tick would see it.
  on('classic.SubagentStop', async ($, e, next) => {
    await refresh($).catch(() => undefined)

    return next(e)
  })

  // Every loop's task list (TodoWrite, TaskCreate/TaskUpdate, or the desktop
  // app's plan tools): the main loop's is the band's, a subagent's its own,
  // which makes it a session. A Workflow call's result names its run. One
  // hook for every tool: a matcher would make TypeScript expand every
  // connected MCP tool's type, past its depth.
  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    // In a subagent's loop: the call in flight is its activity, and counted
    // once it ended, a deny or a throw included.
    if (agentId) {
      const since = await $.clock.now()
      const { tool, detail } = summarizeCall(String(e.tool), e as unknown as Record<string, unknown>)
      await update($, agents, rows => callStarted(rows, agentId, { tool, detail, since })).catch(() => undefined)
    }
    let ran: Awaited<ReturnType<typeof next>>
    try {
      ran = await next(e)
    } finally {
      if (agentId) await update($, agents, rows => callEnded(rows, agentId)).catch(() => undefined)
    }
    if (ran.deny !== undefined || ran.isError) return ran

    const name = String(e.tool)
    if (name === 'Workflow') {
      const result = ran.result as { runId?: unknown; workflowName?: unknown } | undefined
      if (typeof result?.runId === 'string' && result.runId) {
        const run = { id: result.runId, name: typeof result.workflowName === 'string' ? result.workflowName : undefined, ownerId: agentId, startedAt: await $.clock.now() }
        await update($, runs, all => recordRun(all, run))
        await syncTones($)
      }
      return ran
    }
    const change = taskChange(name, e as unknown as Record<string, unknown>, ran.result)
    if (change === undefined) return ran
    if (agentId) await changeAgents($, rows => rows.map(row => (row.id === agentId ? { ...row, tasks: change(row.tasks ?? []) } : row)))
    else await update($, tasks, change)

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, renderPane)
  on('ui.render', { component: 'CommandOutput', props: { command: 'agent-watch' } }, async ($, e, next) => renderOutput($, e) ?? next(e))
  registerBand(on)
}
