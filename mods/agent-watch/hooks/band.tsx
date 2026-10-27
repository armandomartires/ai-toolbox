import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import { bar, colorOf, fit, iconOf, progressOf } from './model'
import { PANE, TITLE } from './view'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])

/** The widest the bar grows; it shrinks with the band. */
const BAR_MAX = 20

/**
 * The band above the prompt: a bar of the task list's progress, the step in
 * progress, and the icon of each running agent, pulsing. Nothing while there
 * is no task list and no agent runs, or while a survey holds the band.
 */
export const registerBand = (on: On) =>
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  const [list, rows, tick] = await Promise.all([read($, tasks), read($, agents), read($, frame)])
  const running = rows.filter(row => row.status === 'running')
  const { done, total, current } = progressOf(list)
  if (e.props.hasSurvey || (total === 0 && running.length === 0)) return next(e)

  const { Box, Button, Text } = $.ui.resolve(e)
  const cols = Math.max(20, e.props.bodyColumns)
  const width = Math.min(BAR_MAX, Math.max(5, Math.floor(cols / 4)))
  const count = `${done}/${total}`
  const isDone = total > 0 && done === total
  // An icon opens its agent's transcript in the main view; the step text
  // opens the Agents pane. No hotkeys: a bare digit in an empty composer
  // would press one.
  const icons = running.map(row => (
    <Button key={`band-agent-${row.id}`} plain onPress={() => void $.ui.view({ agentId: row.id })}>
      <Text color={colorOf(row.hue)}>{`${iconOf(row.hue, row.status, tick)} `}</Text>
    </Button>
  ))
  const openPane = () => void $.ui.open({ id: PANE, title: TITLE })
  const room = cols - width - count.length - running.length * 2 - 6
  const step = isDone ? 'all done' : current ? fit(current, Math.max(8, room)) : ''

  return (
    <Box flexDirection="row">
      {total > 0 && (
        <Box flexShrink={0}>
          <Text color={isDone ? 'success' : 'suggestion'}>{bar(done, total, width)}</Text>
          <Text tabular dimColor>{` ${count} `}</Text>
        </Box>
      )}
      {step !== '' && (
        <Button key="band-step" plain dimColor={isDone} onPress={openPane}>
          <Text wrap="truncate-end">{step}</Text>
        </Button>
      )}
      {running.length > 0 && (
        <Box flexShrink={0} marginLeft={total > 0 ? 1 : 0}>
          {icons}
          <Text dimColor>{`${running.length} running`}</Text>
        </Box>
      )}
    </Box>
  )
})
