import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { AgentRow } from '../types'
import { elapsed, fit, isActive, STATUS, STATUSES, STICKY_MUTED, STICKY_TEXT, stickyOf } from './model'
import { boardTitle, cardHeight, carousel, columnRows, COLUMN_MIN, focusOf, isRailRow, RAIL_GUTTER } from './rails'
import type { Row } from './rails'

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

export const PANE = 'task-compass'
const GOALS_FILE = 'GOALS.md'
const AGENTS_SHOWN = 6

const agentGlyph = (status: string) =>
  status === 'running'
    ? '◐'
    : status === 'pending' || status === 'waiting'
      ? '○'
      : status === 'idle'
        ? '◌'
        : status === 'completed'
          ? '●'
          : '✖'

const agentColor = (status: string) =>
  status === 'running'
    ? 'warning'
    : isActive(status)
      ? 'suggestion'
      : status === 'completed'
        ? 'success'
        : 'error'

/** The Compass pane: the sprint carousel, a legend, the subagents. */
export const registerPane = (on: On) =>
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const [sprintList, declared, taskList, agentRows, at, where, opened, scrolled, from] = await Promise.all([
      read($, sprints),
      read($, focus),
      read($, tasks),
      read($, agents),
      read($, now),
      read($, goalsPath),
      read($, openCard),
      read($, railStart),
      read($, source),
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
    const shownAgents = agentRows.slice(-AGENTS_SHOWN)
    const room = Math.max(6, rows - (shownAgents.length + 3) - 5)
    const scrollTo = (start: number | null) => () => void update($, railStart, () => start)

    // A run of the rail, `height` rows tall. The terminal joins `│` cells into
    // one line; a desktop draws each row as a line of text with spacing
    // between, which breaks them into dashes. There the rail is the left edge
    // of a bordered Box, the rest of it clipped away: one unbroken line.
    const railRun = (height: number) =>
      isTerminal ? (
        <Box flexDirection="column" width={1}>
          {Array.from({ length: height }, () => (
            <Text color="inactive">│</Text>
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
            borderColor="inactive"
          />
        </Box>
      )

    // A square frame for a desktop card, `height` rows tall and as wide as the
    // card: each edge is one straight side of a bordered Box, clipped to a
    // strip one cell thick with the rounded corners pushed outside the clip.
    // The four lines meet at the card's own corners, square. Drawn first, so
    // the card's text paints over any of it.
    const squareFrame = (height: number, color: string) => {
      const side = (clip: { top: number; left: number; width: number; height: number }, inner: { top: number; left: number; width: number; height: number }) => (
        <Box position="absolute" {...clip} overflow="hidden">
          <Box position="absolute" {...inner} borderStyle="single" borderColor={color} />
        </Box>
      )
      return [
        side({ top: 0, left: 0, width: cardWidth, height: 1 }, { top: 0, left: -1, width: cardWidth + 2, height: 3 }),
        side({ top: height - 1, left: 0, width: cardWidth, height: 1 }, { top: -2, left: -1, width: cardWidth + 2, height: 3 }),
        side({ top: 0, left: 0, width: 1, height }, { top: -1, left: 0, width: 3, height: height + 2 }),
        side({ top: 0, left: cardWidth - 1, width: 1, height }, { top: -1, left: -2, width: 3, height: height + 2 }),
      ]
    }

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
          <Text color={row.color}>{row.glyph}</Text>
        </Box>
      ) : null
      const name = row.text ? (
        <Text
          color={row.textColor}
          weight={row.bold ? 'semibold' : undefined}
          dimColor={row.dim}
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
      // past the live tasks. A flat pastel sticky note: theme colors would
      // not read on it, so a line's color becomes the sticky's ink and a dim
      // line a muted ink.
      const sticky = stickyOf(row.card.color)
      return (
        <Box flexDirection="column">
          {dot}
          <Box flexDirection="row">
            <Box flexDirection="row" width={RAIL_GUTTER}>
              {railRun(cardHeight(row.card))}
            </Box>
            {/* The terminal draws `single` with square corners, ┌┐. A desktop
                rounds every border whatever its style, so there the note is
                padded paper framed by four straight edges laid over it. */}
            <Box
              width={cardWidth}
              flexDirection="column"
              backgroundColor={sticky.paper}
              {...(isTerminal
                ? { borderStyle: 'single', borderColor: sticky.ink, paddingX: 1 }
                : { paddingX: 2, paddingY: 1 })}
            >
              {!isTerminal && squareFrame(cardHeight(row.card), sticky.ink)}
              {row.card.lines.map(line => (
                <Text
                  color={line.color ? sticky.ink : line.dim ? STICKY_MUTED : STICKY_TEXT}
                  backgroundColor={sticky.paper}
                  weight={line.bold ? 'semibold' : undefined}
                  mono
                  wrap="truncate-end"
                >
                  {line.text.padEnd(inner)}
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
          <Button key="earlier" plain dimColor hotkey={isTerminal ? 'h' : undefined} onPress={scrollTo(first - 1)}>
            {`‹ ${first} earlier`}
          </Button>
        ) : (
          <Text> </Text>
        )}
        {first === centred ? (
          <Text dimColor tabular>{title}</Text>
        ) : (
          <Button key="current" plain dimColor hotkey={isTerminal ? 'c' : undefined} onPress={scrollTo(null)}>
            {`↺ ${title}`}
          </Button>
        )}
        {later > 0 ? (
          <Button key="later" plain dimColor hotkey={isTerminal ? 'l' : undefined} onPress={scrollTo(first + 1)}>
            {`${later} later ›`}
          </Button>
        ) : (
          <Text> </Text>
        )}
      </Box>
    )

    // Each subagent's name opens its transcript in the main view; the one in
    // view goes back to the main conversation.
    const running = agentRows.filter(row => isActive(row.status)).length
    const viewing = e.props.view.agentId
    const depth = (row: AgentRow): number => {
      const parent = agentRows.find(one => one.id === row.parentId)
      return parent ? 1 + depth(parent) : 0
    }
    const agentRow = (row: AgentRow) => {
      const isViewed = row.id === viewing
      const indent = '  '.repeat(Math.min(3, depth(row)))
      const time = elapsed((row.endedAt ?? at) - row.startedAt)
      const label = fit(
        `${isViewed ? '▸' : ''}${row.type} · ${row.description}`,
        Math.max(8, cols - indent.length - time.length - 3),
      )
      const show = () => void $.ui.view(isViewed ? {} : { agentId: row.id })
      return (
        <Box flexDirection="row">
          <Box flexShrink={0}>
            <Text color={agentColor(row.status)} dimColor={!isActive(row.status)}>
              {`${indent}${agentGlyph(row.status)} `}
            </Text>
          </Box>
          <Button key={`agent-${row.id}`} plain dimColor={!isActive(row.status) && !isViewed} onPress={show}>
            <Text wrap="truncate-end">{label}</Text>
          </Button>
          <Box flexShrink={0}>
            <Text dimColor tabular size="caption">{` ${time}`}</Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
        {sprintList.length === 0 ? (
          <Text dimColor>
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
              <Text color={STATUS[status].color} size="caption">{STATUS[status].glyph}</Text>
              <Text dimColor size="caption">{` ${STATUS[status].label}`}</Text>
            </Box>
          ))}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text weight="semibold" size="heading" color="claude">
            {agentRows.length > 0 ? `Subagents  ${running} running` : 'Subagents'}
          </Text>
          {agentRows.length === 0 && <Text dimColor>None running.</Text>}
          {shownAgents.map(agentRow)}
        </Box>
      </Box>
    )
  })
