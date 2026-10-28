import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderInput } from 'claude-code'

import type { Sprint, Status } from '../types'
import { elapsed, fit, headCaption, isActive, STATUS, STATUSES, shownRows, subagentRows, trimTree } from './model'
import type { SubagentRow } from './model'
import { boardTitle, cardHeight, carousel, columnRows, COLUMN_MIN, focusOf, isRailRow, RAIL_GUTTER, sprintLabel } from './rails'
import type { Row } from './rails'
import { iconOf, memberCaption, sessionTree, toneToken } from './sessions'
import type { Member, SessionNode } from './sessions'
import { IDENTITY, agentState, color, kit, recall } from './sigma'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const sprints = atom({ plugin: 'task-compass', key: 'sprints' } as const, [])
const focus = atom({ plugin: 'task-compass', key: 'focus' } as const, null)
const tasks = atom({ plugin: 'task-compass', key: 'tasks' } as const, [])
const agents = atom({ plugin: 'task-compass', key: 'agents' } as const, [])
const now = atom({ plugin: 'task-compass', key: 'now' } as const, 0)
const goalsPath = atom({ plugin: 'task-compass', key: 'goalsPath' } as const, '')
const openCard = atom({ plugin: 'task-compass', key: 'openCard' } as const, null)
const railStart = atom({ plugin: 'task-compass', key: 'railStart' } as const, null)
const source = atom({ plugin: 'task-compass', key: 'source' } as const, 'goals')
// agent-watch's tracking, read and never written (types/index.d.ts, the mirror):
// the Sessions tree draws from it (ADR-0045).
const watchAgents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const watchNow = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const watchFrame = atom({ plugin: 'agent-watch', key: 'frame' } as const, 0)
const watchTasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const watchRuns = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const watchTones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
// task-orchestrator's run, read and never written (types/index.d.ts, the mirror).
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
const policy = atom({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
const enabled = atom({ plugin: 'task-orchestrator', key: 'enabled' } as const, false)

export const PANE = 'task-compass'
const GOALS_FILE = 'GOALS.md'
const AGENTS_SHOWN = 6
/** The widest a session's meter grows. */
const BAR_MAX = 12
/** The lines the Sessions tree may take beyond its session heads and the ledger's tasks. */
const TREE_LINES = 16

/**
 * A subagent's glyph, as agent-watch draws it: its identity by the order it
 * was first seen, hollow while it waits and solid otherwise. Its colour is
 * its state (`agentState`).
 */
const agentGlyph = (index: number, status: string) => {
  const pair = IDENTITY[index % IDENTITY.length] ?? IDENTITY[0]!
  return isActive(status) && status !== 'running' ? pair[1] : pair[0]
}

/** What `/compass` answers; what `/goals` answers, a sprint per row. */
export type CompassOutput = { isPlaced: boolean; sprints: number; stories: number }
export type GoalsOutput = {
  from: string
  sprints: { label: string; title: string; status: Status; done: number; total: number; isCurrent: boolean }[]
}

/** A sprint as `/goals` draws it. */
export const goalsRow = (sprint: Sprint, isCurrent: boolean): GoalsOutput['sprints'][number] => ({
  label: sprintLabel(sprint),
  title: sprint.title,
  status: sprint.status,
  done: sprint.stories.filter(story => story.status === 'done').length,
  total: sprint.stories.length,
  isCurrent,
})

/** The sprints `/goals` draws: the last ones, the current one included. */
const GOALS_SHOWN = 8

/**
 * `/compass` and `/goals` as SIGMAorbital panels; none for a row this
 * session did not answer (a resume, a reload), which the engine draws as
 * text. Declarations: the engine follows `$` past an import only into one.
 */
export function renderOutput($: EngineInterface, e: RenderInput<'CommandOutput'>) {
  if (e.props.isErrored) return undefined
  const kept = recall<CompassOutput | GoalsOutput>(e.props.text)
  if (kept === undefined) return undefined
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  const { label, meter, panel, value } = kit(ui, e.surface)
  const width = Math.min(72, e.viewport?.columns ?? 72)

  if ('isPlaced' in kept) {
    return panel(
      { title: 'Compass', code: kept.isPlaced ? 'pane open' : 'no pane here', width },
      <Box flexDirection="row" columnGap={2}>
        {label('Sprints')}
        {value(String(kept.sprints))}
        {label('Stories')}
        {value(String(kept.stories))}
      </Box>,
    )
  }
  const shown = kept.sprints.slice(-GOALS_SHOWN)
  return panel(
    { title: 'Goals', code: `${kept.sprints.length} sprints`, width },
    <Box flexDirection="column">
      <Text color={color('text-3')} size="caption" wrap="truncate-end">{kept.from}</Text>
      {kept.sprints.length > shown.length && label(`${kept.sprints.length - shown.length} earlier not shown`)}
      {shown.map(one => (
        <Box flexDirection="row" columnGap={1}>
          <Box flexShrink={0}>
            <Text color={color(one.isCurrent ? 'white' : STATUS[one.status].color)}>{one.isCurrent ? '◉' : STATUS[one.status].glyph}</Text>
          </Box>
          <Box flexShrink={0} width={6}>
            {label(one.label)}
          </Box>
          <Box flexGrow={1} flexShrink={1}>
            <Text color={color(one.isCurrent ? 'text-1' : 'text-2')} wrap="truncate-end">{one.title}</Text>
          </Box>
          {meter(one.done, one.total, 5)}
          {value(`${one.done}/${one.total}`)}
        </Box>
      ))}
    </Box>,
  )
}

/** The Compass pane: the sprint carousel, a legend, the subagents. */
export const registerPane = (on: On) => {
  on('ui.render', { component: 'CommandOutput', props: { command: 'compass' } }, async ($, e, next) => renderOutput($, e) ?? next(e))
  on('ui.render', { component: 'CommandOutput', props: { command: 'goals' } }, async ($, e, next) => renderOutput($, e) ?? next(e))
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const { badge, frame, label, meter, panel } = kit(ui, e.surface)
    const [sprintList, declared, taskList, agentRows, at, where, opened, scrolled, from, orchTasks, orchPolicy, orchOn, watched, watchClock, tick, watchList, watchRunList, watchTone] = await Promise.all([
      read($, sprints),
      read($, focus),
      read($, tasks),
      read($, agents),
      read($, now),
      read($, goalsPath),
      read($, openCard),
      read($, railStart),
      read($, source),
      read($, ledger),
      read($, policy),
      read($, enabled),
      read($, watchAgents),
      read($, watchNow),
      read($, watchFrame),
      read($, watchTasks),
      read($, watchRuns),
      read($, watchTones),
    ])
    const isTerminal = e.surface === 'terminal'
    const cols = Math.max(COLUMN_MIN, e.props.bodyColumns)
    // The pane's own room, which the tree fills: the rails take what the
    // legend and the subagents leave.
    const rows = Math.max(16, e.props.scroll.bodyRows)

    const { cur, focusId, isGuess } = focusOf(sprintList, declared, taskList)
    const view = carousel(cols, sprintList.length, cur, scrolled)
    const { first, centred, later, columnWidth, cardWidth, inner } = view
    const shown = sprintList.slice(first, first + view.count)
    // The tree draws from agent-watch's tracking, which it announces by
    // writing its clock on its first refresh; without it (not loaded) the
    // panel is the flat list of 0.5.0.
    const isWatching = watchClock > 0
    const merged = subagentRows(agentRows, orchTasks, at)
    const shownAgents = shownRows(merged, AGENTS_SHOWN)
    const hasTree = isWatching
    const tree = hasTree
      ? sessionTree({ rows: watched, runs: watchRunList, tones: watchTone, tasks: watchList, ledger: orchTasks, policy: orchPolicy, isOrchOn: orchOn })
      : []
    const clock = watchClock > 0 ? watchClock : at
    const trimmed = trimTree(tree, TREE_LINES, clock)
    const panelLines = hasTree ? trimmed.lines : shownAgents.length
    const room = Math.max(6, rows - (panelLines + 3) - 5)
    const scrollTo = (start: number | null) => () => void update($, railStart, () => start)

    // A run of the rail, `height` rows tall. The terminal joins `│` cells into
    // one line; a desktop draws each row as a line of text with spacing
    // between, which breaks them into dashes. There the rail is the left edge
    // of a bordered Box, the rest of it clipped away: one unbroken line.
    const railRun = (height: number) =>
      isTerminal ? (
        <Box flexDirection="column" width={1}>
          {Array.from({ length: height }, () => (
            <Text color={color('line')}>│</Text>
          ))}
        </Box>
      ) : (
        <Box width={1} height={height} overflow="hidden">
          <Box
            position="absolute"
            top={-1}
            left={0}
            width={3}
            height={height + 2}
            borderStyle="single"
            borderColor={color('line')}
          />
        </Box>
      )

    const drawRow = (row: Row) => {
      if (isRailRow(row)) return railRun(1)
      const prefix = row.prefix ? (
        <Box flexDirection="row" width={RAIL_GUTTER}>
          {railRun(1)}
        </Box>
      ) : null
      // `fit` cuts a name by characters; a desktop's proportional font can
      // still run it long, so it is cut at the edge rather than wrapped onto
      // a second row, and the dot never gives up its cell.
      const glyph = row.glyph ? (
        <Box flexShrink={0}>
          <Text color={color(row.color)}>{row.glyph}</Text>
        </Box>
      ) : null
      // Brightness is the hierarchy: the focus and the current sprint in
      // text-1, a finished or parked one in text-3, the rest text-2.
      const name = row.text ? (
        <Text
          color={color(row.textColor ?? (row.bold ? 'text-1' : row.dim ? 'text-3' : 'text-2'))}
          weight={row.bold ? 'semibold' : undefined}
          wrap="truncate-end"
        >
          {`${row.glyph ? ' ' : ''}${fit(row.text, Math.max(4, columnWidth - row.prefix.length - 3))}`}
        </Text>
      ) : null
      if (!row.card || !row.key) {
        return (
          <Box flexDirection="row">
            {prefix}
            {glyph}
            {name}
          </Box>
        )
      }

      // The name is the press that opens the card, or closes it. The dot
      // stays a Text beside it: a desktop draws a Button as a native one,
      // whose label loses the colors of the Texts in it.
      const key = row.key
      const toggle = () => void update($, openCard, open => (open === key ? null : key))
      const dot = (
        <Box flexDirection="row">
          {prefix}
          {glyph}
          <Button key={key} plain onPress={toggle}>
            {name ?? ' '}
          </Button>
        </Box>
      )
      if (opened !== key) return dot

      // The card opens in the flow under its dot, so the rows below slide down
      // to make room, and beside the rail, which runs on past it as it does
      // past the live tasks. A SIGMAorbital panel: `surface` behind a square
      // `line` frame, the title uppercase in text-1, the status in its colour
      // with its glyph, the rest text-2 and text-3.
      const fill = color('surface')
      return (
        <Box flexDirection="column">
          {dot}
          <Box flexDirection="row">
            <Box flexDirection="row" width={RAIL_GUTTER}>
              {railRun(cardHeight(row.card))}
            </Box>
            {/* The terminal draws `single` with square corners, ┌┐. A desktop
                rounds every border whatever its style, so there the panel is
                padded and framed by four straight edges laid over it. */}
            <Box
              width={cardWidth}
              flexDirection="column"
              backgroundColor={fill}
              {...(isTerminal
                ? { borderStyle: 'single', borderColor: color('line'), paddingX: 1 }
                : { paddingX: 2, paddingY: 1 })}
            >
              {!isTerminal && frame(cardWidth, cardHeight(row.card))}
              {row.card.lines.map(line => (
                <Text
                  color={color(line.color ?? (line.bold ? 'text-1' : line.dim ? 'text-3' : 'text-2'))}
                  backgroundColor={fill}
                  weight={line.bold ? 'semibold' : undefined}
                  mono
                  wrap="truncate-end"
                >
                  {(line.bold || line.color ? line.text.toUpperCase() : line.text).padEnd(inner)}
                </Text>
              ))}
            </Box>
          </Box>
        </Box>
      )
    }

    // A `.ai/` board marks every open sprint current; GOALS.md has one.
    const hasOpen = sprintList.some(one => one.isOpen)
    const title = boardTitle(sprintList, cur)
    const columns = shown.map(one => (
      <Box flexDirection="column" width={columnWidth}>
        {columnRows(one, {
          isCurrent: hasOpen ? one.isOpen === true : one.n === sprintList[cur]?.n,
          focusId,
          isGuess,
          declared,
          tasks: taskList,
          room,
          opened,
          inner,
          nowMs: at,
        }).map(drawRow)}
      </Box>
    ))

    // The carousel's controls; on the terminal, with the pane focused, h and
    // l scroll it and c goes back to the current sprint.
    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        {first > 0 ? (
          <Button key="earlier" plain hotkey={isTerminal ? 'h' : undefined} onPress={scrollTo(first - 1)}>
            <Text color={color('text-2')}>{`‹ ${first} EARLIER`}</Text>
          </Button>
        ) : (
          <Text> </Text>
        )}
        {first === centred ? (
          <Text color={color('text-3')} tabular>{title.toUpperCase()}</Text>
        ) : (
          <Button key="current" plain hotkey={isTerminal ? 'c' : undefined} onPress={scrollTo(null)}>
            <Text color={color('text-2')}>{`↺ ${title.toUpperCase()}`}</Text>
          </Button>
        )}
        {later > 0 ? (
          <Button key="later" plain hotkey={isTerminal ? 'l' : undefined} onPress={scrollTo(first + 1)}>
            <Text color={color('text-2')}>{`${later} LATER ›`}</Text>
          </Button>
        ) : (
          <Text> </Text>
        )}
      </Box>
    )

    // Each subagent's name opens its transcript in the main view; the one in
    // view goes back to the main conversation. A task not started has no
    // transcript, so its name does nothing.
    const running = merged.filter(one => one.isActive && one.waits === undefined).length
    const viewing = e.props.view.agentId
    const agentRow = (one: SubagentRow) => {
      const agentId = one.agentId
      const isViewed = agentId !== undefined && agentId === viewing
      const indent = '  '.repeat(Math.min(3, one.depth))
      const time = one.startedAt === undefined ? '' : elapsed((one.endedAt ?? at) - one.startedAt)
      const tail = one.waits !== undefined ? `WAITS ON ${one.waits.join(', ')}` : (one.settings ?? '')
      const name = fit(
        `${isViewed ? '▸' : ''}${one.label}`,
        Math.max(8, cols - indent.length - time.length - tail.length - (one.badge ? one.badge.word.length + 3 : 0) - 5),
      )
      const show = () => {
        if (agentId === undefined) return
        void $.ui.view(isViewed ? {} : { agentId })
      }
      const index = one.row ? agentRows.indexOf(one.row) : Math.max(0, merged.indexOf(one))
      return (
        <Box flexDirection="row">
          <Box flexShrink={0}>
            <Text color={color(agentState(one.status).token)}>
              {`${indent}${agentGlyph(index, one.status)} `}
            </Text>
          </Box>
          <Button key={`agent-${one.key}`} plain onPress={show}>
            <Text color={color(one.isActive || isViewed ? 'text-1' : 'text-2')} wrap="truncate-end">{name}</Text>
          </Button>
          <Box flexShrink={0} flexDirection="row">
            {tail !== '' && <Text color={color('text-3')} size="caption">{` ${tail}`}</Text>}
            {one.badge !== undefined && <Text> </Text>}
            {one.badge !== undefined && badge(one.badge.status, one.badge.word)}
            {time !== '' && <Text color={color('text-3')} tabular size="caption">{` ${time}`}</Text>}
          </Box>
        </Box>
      )
    }

    // The Sessions tree as agent-watch draws it (ADR-0044): a head per session,
    // its members indented under it in the session's tone.
    const treeMember = (member: Member, depth: number, tone: ReturnType<typeof toneToken>) => {
      const isViewed = member.agentId !== undefined && member.agentId === viewing
      const indent = '  '.repeat(Math.min(4, depth))
      const time = member.startedAt === undefined ? '' : elapsed((member.endedAt ?? clock) - member.startedAt)
      const outcome = member.badge
      const text = fit(
        `${isViewed ? '▸' : ''}${member.label}`,
        Math.max(8, cols - indent.length - time.length - (outcome ? outcome.word.length + 3 : 0) - 4),
      )
      const agentId = member.agentId
      // A task not started has no transcript, so its name does nothing.
      const show = () => {
        if (agentId === undefined) return
        void $.ui.view(isViewed ? {} : { agentId })
      }
      const caption = memberCaption(member, clock)

      return (
        <Box key={`member-${member.key}`} flexDirection="column">
          <Box flexDirection="row">
            <Box flexShrink={0}>
              <Text color={color(tone)}>{`${indent}${iconOf('agent', member.status, tick)} `}</Text>
            </Box>
            <Button key={`agent-${member.key}`} plain onPress={show}>
              <Text color={color(member.isActive || isViewed ? 'text-1' : 'text-2')} wrap="truncate-end">{text}</Text>
            </Button>
            <Box flexShrink={0} flexDirection="row">
              {outcome !== undefined && <Text> </Text>}
              {outcome !== undefined && badge(outcome.status, outcome.word)}
              {time !== '' && <Text color={color('text-3')} tabular size="caption">{` ${time}`}</Text>}
            </Box>
          </Box>
          {caption !== '' && (
            <Text color={color('text-3')} size="caption" wrap="truncate-end">{`${indent}  ${caption}`}</Text>
          )}
        </Box>
      )
    }

    const sessionHead = (node: SessionNode) => {
      const tone = toneToken(watchTone, node.key)
      const indent = '  '.repeat(Math.min(4, node.depth))
      const { done, total, unit } = node.progress
      const count = total > 0 ? `${done}/${total}` : ''
      const width = Math.min(BAR_MAX, Math.max(4, Math.floor(cols / 6)))
      const time = node.startedAt === undefined ? '' : elapsed((node.endedAt ?? clock) - node.startedAt)
      const isViewed = node.agentId !== undefined && node.agentId === viewing
      const space =
        cols - indent.length - 2 - (total > 0 ? width + count.length + unit.length + 4 : 0) - time.length - (node.badge ? node.badge.word.length + 3 : 0) - 2
      const name = fit(`${isViewed ? '▸' : ''}${node.name}`, Math.max(8, space))
      const agentId = node.agentId
      const show = () => void $.ui.view(agentId === undefined || isViewed ? {} : { agentId })
      const caption = headCaption(node, clock)
      const cut = trimmed.shown.get(node.key)

      return (
        <Box key={`head-${node.key}`} flexDirection="column" marginTop={1}>
          <Box flexDirection="row">
            <Box flexShrink={0}>
              <Text color={color(tone)}>{`${indent}${iconOf('session', node.status, tick)} `}</Text>
            </Box>
            <Button key={`session-${node.key}`} plain onPress={show}>
              <Text color={color(node.isActive || isViewed ? 'text-1' : 'text-2')} weight="bold" wrap="truncate-end">{name}</Text>
            </Button>
            <Box flexShrink={0} flexDirection="row" columnGap={1} marginLeft={1}>
              {node.badge !== undefined && badge(node.badge.status, node.badge.word)}
              {total > 0 && meter(done, total, width, tone)}
              {total > 0 && <Text color={color('text-1')} tabular>{count}</Text>}
              {total > 0 && label(unit)}
              {time !== '' && <Text color={color('text-3')} tabular size="caption">{time}</Text>}
            </Box>
          </Box>
          {caption !== '' && <Text color={color('text-3')} size="caption" wrap="truncate-end">{`${indent}  ${caption}`}</Text>}
          {(cut?.members ?? []).map(member => treeMember(member, node.depth + 1, tone))}
          {cut !== undefined && cut.hidden > 0 && (
            <Text color={color('text-3')} size="caption">{`${indent}  +${cut.hidden} more`}</Text>
          )}
          {node.kind === 'main' && node.running.length + node.completed.length === 0 && tree.length === 1 && (
            <Text color={color('text-3')}>{`${indent}  No subagent yet.`}</Text>
          )}
        </Box>
      )
    }

    // While the orchestrator's ledger holds a task, the panel names its policy.
    const treeRunning = watched.filter(row => row.status === 'running').length
    const code = hasTree
      ? `${treeRunning} running`
      : orchTasks.length > 0
        ? `ORCH ${orchPolicy.toUpperCase()}${orchOn ? '' : ' · OFF'} · ${running} running`
        : merged.length > 0
          ? `${running} running`
          : undefined

    return (
      <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
        {sprintList.length === 0 ? (
          <Text color={color('text-3')}>
            {from === 'ai'
              ? /\.ai-layout\.json: /.test(where)
                ? where
                : `No sprints in ${where || '.ai/'}: its roadmap's Sprint history has no rows`
              : `No sprints in ${where || GOALS_FILE} — run /goals init`}
          </Text>
        ) : (
          header
        )}

        <Box flexDirection="row" flexGrow={1}>
          {columns}
        </Box>

        <Box marginTop={1} flexDirection="row" flexWrap="wrap" columnGap={2}>
          {STATUSES.map(status => (
            <Box flexDirection="row">
              <Text color={color(STATUS[status].color)} size="caption">{STATUS[status].glyph}</Text>
              <Text color={color('text-3')} size="caption">{` ${STATUS[status].label.toUpperCase()}`}</Text>
            </Box>
          ))}
        </Box>

        <Box marginTop={1} flexDirection="column">
          {panel(
            { title: 'Sessions', code, width: cols },
            hasTree ? (
              <Box flexDirection="column">{tree.map(sessionHead)}</Box>
            ) : (
              <Box flexDirection="column">
                {merged.length === 0 && <Text color={color('text-3')}>None running.</Text>}
                {shownAgents.map(one => agentRow(one))}
              </Box>
            ),
          )}
        </Box>
      </Box>
    )
  })
}
