import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderInput } from 'claude-code'

import type { Sprint, Status } from '../types'
import { fit, STATUS, STATUSES } from './model'
import { boardTitle, cardHeight, carousel, columnRows, COLUMN_MIN, drawnRows, focusOf, isRailRow, RAIL_GUTTER, sprintLabel } from './rails'
import type { Row } from './rails'
import { color, heldOf, kit, recall, resizeAnswer } from './sigma'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const sprints = atom({ plugin: 'task-compass', key: 'sprints' } as const, [])
const focus = atom({ plugin: 'task-compass', key: 'focus' } as const, null)
const tasks = atom({ plugin: 'task-compass', key: 'tasks' } as const, [])
const now = atom({ plugin: 'task-compass', key: 'now' } as const, 0)
const goalsPath = atom({ plugin: 'task-compass', key: 'goalsPath' } as const, '')
const openCard = atom({ plugin: 'task-compass', key: 'openCard' } as const, null)
const railStart = atom({ plugin: 'task-compass', key: 'railStart' } as const, null)
const source = atom({ plugin: 'task-compass', key: 'source' } as const, 'goals')
// The sprints folded to their header and progress (none by default).
const foldedSprints = atom({ plugin: 'task-compass', key: 'foldedSprints' } as const, [])
// The rows the person dragged this mod's panels to (ADR-0053), read with `heldOf`, written by `resizeAnswer`.
const panelRows = atom({ plugin: 'task-compass', key: 'panelRows' } as const, {})
export const PANE = 'task-compass'
const GOALS_FILE = 'GOALS.md'
/** The cells a bracketed panel's border and padding take across: two each side. */
const FRAME_COLS = 4
/**
 * The rows the board's own parts take around its columns, seven: the title bar (1) and its rule (1), the frame
 * above and below (2), the carousel's header (1), the legend's `marginTop` (1) and the legend (1). The legend
 * is about 65 cells, so on a pane under about 69 columns it wraps to a second row, which this does not
 * count: the pane then scrolls one row. The columns get what is left of the pane (`room`), and fold their done
 * stories into one dot past it; a pane shorter than this plus `BOARD_FLOOR` scrolls.
 */
const BOARD_CHROME_ROWS = 7
const BOARD_FLOOR = 6
/** The resize handle's `Client` key on the Sprints panel's bottom edge: what `ui.message` names when it posts. */
export const SPRINTS_HANDLE = 'sprints-handle'
/** The Sprints body's rows beside its columns: the carousel header, the legend's margin and the legend. */
const BODY_EXTRA_ROWS = 3
/** Each of this pane's handles with the fewest rows a drag holds its panel's body at. */
const MINS = { [SPRINTS_HANDLE]: BOARD_FLOOR + BODY_EXTRA_ROWS }

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

// What the pane beneath this hook last said, so a live failure leaves one debug-log line (ADR-0048, clause 3) and a redraw adds none.
let lastBelow = ''
const noteBelow = ($: EngineInterface, said: string) => {
  if (said === lastBelow) return
  lastBelow = said
  $.ui.log(`task-compass: next(e) ${said}`, { to: 'debug' })
}

/**
 * Core's own drawing of a component, `{ type: 'engine', ref }`: what `next(e)` resolves to for the innermost hook when no plugin below drew the pane (the engine's types: core is the last hook). Embedded in a tree it nests the engine's frame in the pane's body or fails the tree whole, and the engine then draws its own pane over the board (ADR-0048, clause 3), so it is never embedded.
 */
const isEngineElement = (value: unknown) => typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'engine'

/** This mod's version, bumped with plugin.json's (the test kit cannot read a .json): a desktop prints it after the legend, so the person sees which copy draws the board. */
export const VERSION = '0.11.0'

/** The Compass pane: the sprint carousel and its legend, then what another mod contributes (ADR-0048). */
export const registerPane = (on: On) => {
  on('ui.render', { component: 'CommandOutput', props: { command: 'compass' } }, async ($, e, next) => renderOutput($, e) ?? next(e))
  on('ui.render', { component: 'CommandOutput', props: { command: 'goals' } }, async ($, e, next) => renderOutput($, e) ?? next(e))
  // A drag on a handle in the pane: the rows it asks for are held for this surface, or let go back to automatic (ADR-0053).
  on('ui.message', { requestId: PANE }, async ($, e, next) => (await resizeAnswer(e, MINS, fn => update($, panelRows, fn))) ?? next(e))
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    // What another mod contributes to this pane (agent-watch's meter and Sessions panel, ADR-0048): drawn after the board, whichever mod loaded first.
    // A rejected next(e) is no contribution, and neither is core's own drawing (isEngineElement): a throw here, or an element the engine refuses, would make it draw its own pane in place of the board.
    let isRejected = false
    const resolved = await next(e).catch((error: unknown) => {
      isRejected = true
      noteBelow($, `rejected: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    })
    if (!isRejected) noteBelow($, resolved === undefined ? 'resolved nothing' : `resolved ${typeof resolved}${typeof resolved === 'object' && resolved !== null ? ` (type ${String((resolved as { type?: unknown }).type)})` : ''}`)
    const contributed = isEngineElement(resolved) ? undefined : resolved
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const { frame, panel } = kit(ui, e.surface)
    const [sprintList, declared, taskList, at, where, opened, scrolled, from, foldedList, heldRowsMap] = await Promise.all([
      read($, sprints),
      read($, focus),
      read($, tasks),
      read($, now),
      read($, goalsPath),
      read($, openCard),
      read($, railStart),
      read($, source),
      read($, foldedSprints),
      read($, panelRows),
    ])
    const isTerminal = e.surface === 'terminal'
    const cols = Math.max(COLUMN_MIN, e.props.bodyColumns)
    // The pane's own room: the columns take what the board's chrome leaves, and
    // fold their done stories past it. A pane shorter than that scrolls.
    const rows = Math.max(16, e.props.scroll.bodyRows)
    // A drag on the handle on the board's edge holds its body at a height (ADR-0053): the columns take what the header and legend leave.
    const held = heldOf(heldRowsMap, e, SPRINTS_HANDLE)
    const room = held !== undefined ? Math.max(BOARD_FLOOR, held - BODY_EXTRA_ROWS) : Math.max(BOARD_FLOOR, rows - BOARD_CHROME_ROWS)

    const { cur, focusId, isGuess } = focusOf(sprintList, declared, taskList)
    // The Sprints panel is a bracketed frame: what it holds is four cells narrower than the pane.
    const body = Math.max(1, cols - FRAME_COLS)
    const view = carousel(body, sprintList.length, cur, scrolled)
    const { first, centred, later, columnWidth, cardWidth, inner } = view
    const shown = sprintList.slice(first, first + view.count)
    const folds = new Set(foldedList)
    // A fold toggle: a plain Button in `line-strong` (`▾ HIDE` open, `▸ SHOW …` folded), with its hotkey on the terminal only.
    const foldButton = (key: string, hotkey: string | undefined, text: string, flip: () => void) => (
      <Button key={key} plain hotkey={isTerminal ? hotkey : undefined} onPress={flip}>
        <Text color={color('line-strong')}>{text}</Text>
      </Button>
    )
    const flipSprint = (n: number) => () => void update($, foldedSprints, now => (now.includes(n) ? now.filter(one => one !== n) : [...now, n]))
    // `k` folds the current sprint's rows, the one the carousel centres.
    const currentN = sprintList[cur]?.n
    const scrollTo = (start: number | null) => () => void update($, railStart, () => start)

    // A run of the rail, `height` rows tall. The terminal joins `│` cells into
    // one line; a desktop draws each row as a line of text with spacing
    // between, which breaks them into dashes. There the rail is the left edge
    // of a bordered Box, the rest of it clipped away: one unbroken line.
    // The desktop's rail sits in a two-cell slot, on the boundary of its cells (`left` 1), where a glyph drawn centred in two cells has its centre.
    const railRun = (height: number) =>
      isTerminal ? (
        <Box flexDirection="column" width={1}>
          {Array.from({ length: height }, () => (
            <Text color={color('line')}>│</Text>
          ))}
        </Box>
      ) : (
        <Box key="rail" width={RAIL_GUTTER} height={height} overflow="hidden">
          <Box
            position="absolute"
            top={-1}
            left={1}
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
      // On a desktop the glyph is centred in two cells, so its centre is the rail's line; the name loses the space that gave it room.
      const glyph = row.glyph ? (
        <Box key="glyph" flexShrink={0} {...(isTerminal ? {} : { width: 2, justifyContent: 'center' as const })}>
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
          {`${row.glyph && isTerminal ? ' ' : ''}${fit(row.text, Math.max(4, columnWidth - row.prefix.length - 3))}`}
        </Text>
      ) : null
      if (row.fold) {
        const { n } = row.fold
        return (
          <Box flexDirection="row">
            {prefix}
            {foldButton(`fold-s${n}`, n === currentN ? 'k' : undefined, row.text, flipSprint(n))}
          </Box>
        )
      }
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
    const laid = shown.map(one =>
      columnRows(one, {
        isCurrent: hasOpen ? one.isOpen === true : one.n === sprintList[cur]?.n,
        focusId,
        isGuess,
        declared,
        tasks: taskList,
        room,
        opened,
        inner,
        nowMs: at,
        isFolded: folds.has(one.n),
      }),
    )
    const columns = laid.map(list => (
      <Box flexDirection="column" width={columnWidth}>
        {list.map(drawRow)}
      </Box>
    ))
    // What the body takes as drawn when it sizes itself: the longest column, the header and the legend.
    const bodyRows = Math.max(1, ...laid.map(list => drawnRows(list, opened))) + BODY_EXTRA_ROWS

    // The carousel's controls; on the terminal, with the pane focused, h and
    // l scroll it and c goes back to the current sprint.
    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        {first > 0 ? (
          <Button key="earlier" plain hotkey={isTerminal ? 'h' : undefined} onPress={scrollTo(first - 1)}>
            <Text color={color('text-2')}>{`‹ ${first} PREV`}</Text>
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
            <Text color={color('text-2')}>{`${later} NEXT ›`}</Text>
          </Button>
        ) : (
          <Text> </Text>
        )}
      </Box>
    )

    return (
      <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
        {panel(
          {
            title: 'Sprints',
            code: sprintList.length === 0 ? undefined : `${sprintList.length} sprint${sprintList.length === 1 ? '' : 's'}`,
            width: cols,
            bracketed: true,
            resize: { key: SPRINTS_HANDLE, rows: bodyRows, held, min: MINS[SPRINTS_HANDLE] },
          },
          <Box flexDirection="column" flexGrow={1}>
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

            <Box key="sprint-columns" flexDirection="row" flexGrow={1} {...(held !== undefined ? { flexShrink: 1, overflow: 'hidden' as const } : {})}>
              {columns}
            </Box>
            {/* The status legend belongs to the board: inside its frame, wrapped to the frame's inner width. */}
            <Box marginTop={1} flexDirection="row" flexWrap="wrap" columnGap={2}>
              {STATUSES.map(status => (
                <Box flexDirection="row">
                  <Text color={color(STATUS[status].color)} size="caption">{STATUS[status].glyph}</Text>
                  <Text color={color('text-3')} size="caption">{` ${STATUS[status].label.toUpperCase()}`}</Text>
                </Box>
              ))}
              {!isTerminal && (
                <Box flexGrow={1} justifyContent="flex-end">
                  <Text key="compass-version" color={color('text-3')} size="caption">{`COMPASS ${VERSION}`}</Text>
                </Box>
              )}
            </Box>
          </Box>,
        )}

        {contributed as never}
      </Box>
    )
  })
}
