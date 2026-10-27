import { atom, read } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { AgentRow } from '../types'
import { activityLine, elapsed, fit, groupAgents, iconOf, isActive, nested, outcomeOf } from './model'
import type { WatchOutput } from './model'
import { agentState, color, kit, recall } from './sigma'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)

export const PANE = 'agent-watch'
export const TITLE = 'Agents'

/**
 * The Agents pane, a SIGMAorbital panel: the running subagents, then the
 * completed ones. An agent's glyph is its identity and its colour its state.
 */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const { badge, label, panel } = kit(ui, e.surface)
  const [rows, at, tick] = await Promise.all([read($, agents), read($, now), read($, frame)])
  const cols = Math.max(20, e.props.bodyColumns)
  const viewing = e.props.view.agentId
  const { running, completed } = groupAgents(rows)

  // A row's name opens its transcript in the main view; the one in view
  // goes back to the main conversation. The glyph stays a Text outside the
  // Button, which a desktop draws natively without the Text's colour.
  const agentRow = ({ row, depth }: { row: AgentRow; depth: number }) => {
    const active = isActive(row.status)
    const isViewed = row.id === viewing
    const indent = '  '.repeat(Math.min(3, depth))
    const time = elapsed((row.endedAt ?? at) - row.startedAt)
    const outcome = outcomeOf(row.status)
    const label = fit(
      `${isViewed ? '▸' : ''}${row.type} · ${row.description}`,
      Math.max(8, cols - indent.length - time.length - (outcome ? outcome.word.length + 3 : 0) - 4),
    )
    const show = () => void $.ui.view(isViewed ? {} : { agentId: row.id })
    // Under a running row, what it is doing: the call in flight, calls, tokens.
    const caption = active && (row.activity || row.calls > 0 || row.tokens > 0) ? activityLine(row, at) : ''

    return (
      <Box flexDirection="column">
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text color={color(agentState(row.status).token)}>{`${indent}${iconOf(row.hue, row.status, tick)} `}</Text>
        </Box>
        <Button key={`agent-${row.id}`} plain onPress={show}>
          <Text color={color(active || isViewed ? 'text-1' : 'text-2')} wrap="truncate-end">
            {label}
          </Text>
        </Button>
        <Box flexShrink={0} flexDirection="row">
          {outcome !== undefined && <Text> </Text>}
          {outcome !== undefined && badge(outcome.status, outcome.word)}
          <Text color={color('text-3')} tabular size="caption">{` ${time}`}</Text>
        </Box>
      </Box>
      {caption !== '' && (
        <Text color={color('text-3')} size="caption" wrap="truncate-end">
          {`${indent}  ${caption}`}
        </Text>
      )}
      </Box>
    )
  }

  const group = (title: string, list: AgentRow[], empty: string) => (
    <Box flexDirection="column" marginTop={1}>
      {label(list.length > 0 ? `${title}  ${list.length}` : title)}
      {list.length === 0 && <Text color={color('text-3')}>{empty}</Text>}
      {nested(list).map(agentRow)}
    </Box>
  )

  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {panel(
        { title: 'Subagents', code: `${running.length} running`, width: cols },
        <Box flexDirection="column">
          {group('Running', running, 'No subagent is running.')}
          {group('Completed', completed, 'None has finished yet.')}
        </Box>,
      )}
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
