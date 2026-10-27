import { atom, read } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { AgentRow } from '../types'
import { activityLine, colorOf, elapsed, fit, groupAgents, iconOf, isActive, nested, outcomeOf } from './model'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)

export const PANE = 'agent-watch'
export const TITLE = 'Agents'

/** The theme color of an outcome mark. */
export const outcomeColor = (status: string) => (status === 'completed' ? 'success' : 'error')

/** The Agents pane: the running subagents, then the completed ones. */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const { Box, Button, Text } = $.ui.resolve(e)
  const [rows, at, tick] = await Promise.all([read($, agents), read($, now), read($, frame)])
  const cols = Math.max(20, e.props.bodyColumns)
  const viewing = e.props.view.agentId
  const { running, completed } = groupAgents(rows)

  // A row's name opens its transcript in the main view; the one in view
  // goes back to the main conversation. The icon and the name carry the
  // agent's own color; the icon pulses while it runs.
  const agentRow = ({ row, depth }: { row: AgentRow; depth: number }) => {
    const active = isActive(row.status)
    const isViewed = row.id === viewing
    const color = colorOf(row.hue)
    const indent = '  '.repeat(Math.min(3, depth))
    const time = elapsed((row.endedAt ?? at) - row.startedAt)
    const outcome = outcomeOf(row.status)
    const label = fit(
      `${isViewed ? '▸' : ''}${row.type} · ${row.description}`,
      Math.max(8, cols - indent.length - time.length - outcome.length - 4),
    )
    const show = () => void $.ui.view(isViewed ? {} : { agentId: row.id })
    // Under a running row, what it is doing: the call in flight, calls, tokens.
    const caption = active && (row.activity || row.calls > 0 || row.tokens > 0) ? activityLine(row, at) : ''

    return (
      <Box flexDirection="column">
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text color={color} dimColor={!active}>
            {`${indent}${iconOf(row.hue, row.status, tick)} `}
          </Text>
        </Box>
        <Button key={`agent-${row.id}`} plain dimColor={!active && !isViewed} onPress={show}>
          <Text color={color} bold={row.status === 'running'} wrap="truncate-end">
            {label}
          </Text>
        </Button>
        <Box flexShrink={0}>
          {outcome !== '' && <Text color={outcomeColor(row.status)}>{` ${outcome}`}</Text>}
          <Text dimColor tabular size="caption">{` ${time}`}</Text>
        </Box>
      </Box>
      {caption !== '' && (
        <Text dimColor size="caption" wrap="truncate-end">
          {`${indent}  ${caption}`}
        </Text>
      )}
      </Box>
    )
  }

  const group = (title: string, color: string, list: AgentRow[], empty: string) => (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color}>
        {list.length > 0 ? `${title}  ${list.length}` : title}
      </Text>
      {list.length === 0 && <Text dimColor>{empty}</Text>}
      {nested(list).map(agentRow)}
    </Box>
  )

  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {group('Running', 'warning', running, 'No subagent is running.')}
      {group('Completed', 'success', completed, 'None has finished yet.')}
    </Box>
  )
}
