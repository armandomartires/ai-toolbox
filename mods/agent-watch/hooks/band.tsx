import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import { fit, iconOf, memberTone, progressOf } from './model'
import { color, kit } from './sigma'
import { PANE, TITLE } from './view'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const runs = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const tones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
// task-orchestrator's ledger, read and never written (types/index.d.ts, the mirror).
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])

/** The widest the meter grows; it shrinks with the band. */
const BAR_MAX = 20

/**
 * The band above the prompt: a meter of the task list's progress, cyan while
 * it tracks and text-1 once done, the step in progress, and the glyph of
 * each running agent, pulsing, in the tone of the session that owns it. Nothing while there is no task list and no
 * agent runs, or while a survey holds the band.
 */
export const registerBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  const [list, rows, tick, all, held, orchTasks] = await Promise.all([
    read($, tasks),
    read($, agents),
    read($, frame),
    read($, runs),
    read($, tones),
    read($, ledger),
  ])
  const running = rows.filter(row => row.status === 'running')
  const { done, total, current } = progressOf(list)
  if (e.props.hasSurvey || (total === 0 && running.length === 0)) return next(e)

  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const { label, meter, value } = kit(ui, e.surface)
  const cols = Math.max(20, e.props.bodyColumns)
  const width = Math.min(BAR_MAX, Math.max(5, Math.floor(cols / 4)))
  const count = `${done}/${total}`
  const isDone = total > 0 && done === total
  const sessions = { rows, runs: all, tones: held, tasks: list, ledger: orchTasks }
  // A glyph opens its agent's transcript in the main view; the step text
  // opens the Agents pane. No hotkeys: a bare digit in an empty composer
  // would press one.
  const icons = running.map(row => (
    <Button key={`band-agent-${row.id}`} plain onPress={() => void $.ui.view({ agentId: row.id })}>
      <Text color={color(memberTone(sessions, row.id))}>{`${iconOf('agent', row.status, tick)} `}</Text>
    </Button>
  ))
  const openPane = () => void $.ui.open({ id: PANE, title: TITLE })
  const room = cols - width - count.length - 6 - running.length * 2 - 12
  const step = isDone ? 'ALL DONE' : current ? fit(current, Math.max(8, room)) : ''

  return (
    <Box flexDirection="row">
      {total > 0 && (
        <Box flexShrink={0} flexDirection="row" columnGap={1} marginRight={1}>
          {meter(done, total, width, isDone ? 'text-1' : 'cyan')}
          {value(count, 'steps')}
        </Box>
      )}
      {step !== '' && (
        <Button key="band-step" plain onPress={openPane}>
          <Text color={color(isDone ? 'text-3' : 'text-2')} wrap="truncate-end">{step}</Text>
        </Button>
      )}
      {running.length > 0 && (
        <Box flexShrink={0} flexDirection="row" marginLeft={total > 0 ? 1 : 0}>
          {icons}
          {label(`${running.length} running`)}
        </Box>
      )}
    </Box>
  )
})
