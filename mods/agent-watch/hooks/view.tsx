import { atom, read } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import { elapsed, fit, iconOf, memberCaption, sessionTree, toneToken } from './model'
import type { Member, SessionNode, WatchOutput } from './model'
import { color, kit, recall } from './sigma'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const frame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const runs = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const tones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
// task-orchestrator's run, read and never written (types/index.d.ts, the mirror).
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
const policy = atom({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
const enabled = atom({ plugin: 'task-orchestrator', key: 'enabled' } as const, false)

export const PANE = 'agent-watch'
export const TITLE = 'Agents'

/** The widest a session's meter grows. */
const BAR_MAX = 12

/**
 * The Agents pane, a SIGMAorbital panel: this session, then each sub-session
 * under the one that started it, each with its progress and its subagents
 * (ADR-0044). Every session draws one glyph and every subagent another; the
 * colour says which session owns a row, the pulse and a badge its state.
 */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const { badge, label, meter, panel } = kit(ui, e.surface)
  const [rows, at, tick, list, all, held, orchTasks, orchPolicy, orchOn] = await Promise.all([
    read($, agents),
    read($, now),
    read($, frame),
    read($, tasks),
    read($, runs),
    read($, tones),
    read($, ledger),
    read($, policy),
    read($, enabled),
  ])
  const cols = Math.max(20, e.props.bodyColumns)
  const viewing = e.props.view.agentId
  const tree = sessionTree({ rows, runs: all, tones: held, tasks: list, ledger: orchTasks, policy: orchPolicy, isOrchOn: orchOn })
  const running = rows.filter(row => row.status === 'running').length

  // A row's name opens its transcript in the main view; the one in view
  // goes back to the main conversation. The glyph stays a Text outside the
  // Button, which a desktop draws natively without the Text's colour.
  const memberRow = (member: Member, depth: number, tone: ReturnType<typeof toneToken>) => {
    const isViewed = member.agentId !== undefined && member.agentId === viewing
    const indent = '  '.repeat(Math.min(4, depth))
    const time = member.startedAt === undefined ? '' : elapsed((member.endedAt ?? at) - member.startedAt)
    const outcome = member.badge
    const text = fit(
      `${isViewed ? '▸' : ''}${member.label}`,
      Math.max(8, cols - indent.length - time.length - (outcome ? outcome.word.length + 3 : 0) - 4),
    )
    const agentId = member.agentId
    const show = () => void $.ui.view(isViewed || agentId === undefined ? {} : { agentId })
    const caption = memberCaption(member, at)

    return (
      <Box key={`member-${member.key}`} flexDirection="column">
        <Box flexDirection="row">
          <Box flexShrink={0}>
            <Text color={color(tone)}>{`${indent}${iconOf('agent', member.status, tick)} `}</Text>
          </Box>
          <Button key={`agent-${member.key}`} plain onPress={show}>
            <Text color={color(member.isActive || isViewed ? 'text-1' : 'text-2')} wrap="truncate-end">
              {text}
            </Text>
          </Button>
          <Box flexShrink={0} flexDirection="row">
            {outcome !== undefined && <Text> </Text>}
            {outcome !== undefined && badge(outcome.status, outcome.word)}
            {time !== '' && <Text color={color('text-3')} tabular size="caption">{` ${time}`}</Text>}
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

  // A session's head: its glyph in its tone, its name, its meter and count,
  // its time. A delegating agent's opens its transcript; this session's
  // brings the main conversation back.
  const sessionRow = (node: SessionNode) => {
    const tone = toneToken(held, node.key)
    const indent = '  '.repeat(Math.min(4, node.depth))
    const { done, total, unit } = node.progress
    const count = total > 0 ? `${done}/${total}` : ''
    const width = Math.min(BAR_MAX, Math.max(4, Math.floor(cols / 6)))
    const time = node.startedAt === undefined ? '' : elapsed((node.endedAt ?? at) - node.startedAt)
    const isViewed = node.agentId !== undefined && node.agentId === viewing
    const room = cols - indent.length - 2 - (total > 0 ? width + count.length + unit.length + 4 : 0) - time.length - (node.badge ? node.badge.word.length + 3 : 0) - 2
    const name = fit(`${isViewed ? '▸' : ''}${node.name}`, Math.max(8, room))
    const agentId = node.agentId
    const show = () => void $.ui.view(agentId === undefined || isViewed ? {} : { agentId })
    const caption = node.kind === 'agent' && node.row && node.isActive ? memberCaption({ key: node.key, label: '', status: node.status, isActive: true, row: { ...node.row, tasks: undefined } }, at) : ''

    return (
      <Box key={`head-${node.key}`} flexDirection="column" marginTop={1}>
        <Box flexDirection="row">
          <Box flexShrink={0}>
            <Text color={color(tone)}>{`${indent}${iconOf('session', node.status, tick)} `}</Text>
          </Box>
          <Button key={`session-${node.key}`} plain onPress={show}>
            <Text color={color(node.isActive || isViewed ? 'text-1' : 'text-2')} weight="bold" wrap="truncate-end">
              {name}
            </Text>
          </Button>
          <Box flexShrink={0} flexDirection="row" columnGap={1} marginLeft={1}>
            {node.badge !== undefined && badge(node.badge.status, node.badge.word)}
            {total > 0 && meter(done, total, width, tone)}
            {total > 0 && (
              <Text color={color('text-1')} tabular>
                {count}
              </Text>
            )}
            {total > 0 && label(unit)}
            {time !== '' && <Text color={color('text-3')} tabular size="caption">{time}</Text>}
          </Box>
        </Box>
        {caption !== '' && (
          <Text color={color('text-3')} size="caption" wrap="truncate-end">
            {`${indent}  ${caption}`}
          </Text>
        )}
        {[...node.running, ...node.completed].map(member => memberRow(member, node.depth + 1, tone))}
        {node.kind === 'main' && node.running.length + node.completed.length === 0 && tree.length === 1 && (
          <Text color={color('text-3')}>{`${indent}  No subagent yet.`}</Text>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {panel({ title: 'Sessions', code: `${running} running`, width: cols }, <Box flexDirection="column">{tree.map(sessionRow)}</Box>)}
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
