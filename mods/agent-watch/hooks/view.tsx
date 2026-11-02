import { atom, read } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { WatchOutput } from './model'
import { renderSessions } from './panel'
import { kit, recall } from './sigma'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const runs = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const tones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
// task-orchestrator's run, read and never written (types/index.d.ts, the mirror).
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
const policy = atom({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
const enabled = atom({ plugin: 'task-orchestrator', key: 'enabled' } as const, false)

export const PANE = 'agent-watch'
export const TITLE = 'Agents'

/** The state the Sessions panel is drawn from: the atoms this mod writes and the orchestrator's run it reads. */
const readState = async ($: EngineInterface) => {
  const [rows, at, list, all, held, orchTasks, orchPolicy, orchOn] = await Promise.all([
    read($, agents),
    read($, now),
    read($, tasks),
    read($, runs),
    read($, tones),
    read($, ledger),
    read($, policy),
    read($, enabled),
  ])

  return { agents: rows, now: at, tasks: list, runs: all, tones: held, ledger: orchTasks, policy: orchPolicy, isOrchOn: orchOn }
}

/**
 * The Agents pane: the Sessions panel (`panel.tsx`, ADR-0047) and nothing
 * else, so no row of the pane is spent above it.
 */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const state = await readState($)
  const { Box } = $.ui.resolve(e)
  const sessions = await renderSessions($, e, state, 0)

  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {sessions}
    </Box>
  )
}

/**
 * `/agent-watch`'s row as a panel of counts; none for a row this session
 * did not answer (a resume, a reload), which the engine draws as text. A
 * declaration: the engine follows `$` past an import only into one.
 */
export function renderOutput($: EngineInterface, e: RenderInput<'CommandOutput'>) {
  const out = recall<WatchOutput>(e.props.text)
  if (out === undefined || e.props.isErrored) return undefined
  const ui = $.ui.resolve(e)
  const { Box } = ui
  const { badge, label, panel, value } = kit(ui, e.surface)
  const width = Math.min(56, e.viewport?.columns ?? 56)

  return panel(
    { title: 'Agents', code: out.isPlaced ? 'pane open' : 'no pane here', width },
    <Box flexDirection="row" columnGap={2} flexWrap="wrap">
      {label('Running')}
      {value(String(out.running), undefined, out.running > 0 ? 'cyan' : 'text-1')}
      {label('Completed')}
      {value(String(out.completed))}
      {out.failed > 0 ? badge('critical', `${out.failed} failed or stopped`) : label('None failed')}
    </Box>,
  )
}
