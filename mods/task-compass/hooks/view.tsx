import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderInput } from 'claude-code'

import type { Sprint, Status } from '../types'
import { elapsed, fit, headCaption, isActive, STATUS, STATUSES, shownRows, subagentRows, trimTree } from './model'
import type { SubagentRow } from './model'
import { boardTitle, cardHeight, carousel, columnRows, COLUMN_MIN, focusOf, isRailRow, RAIL_GUTTER, sprintLabel } from './rails'
import type { Row } from './rails'
import { memberCaption, sessionTree, tokensText } from './sessions'
import type { Member, SessionNode } from './sessions'
import { IDENTITY, agentState, color, hms, kit, recall, theme } from './sigma'
import type { Token } from './sigma'
import { arcs, chartAgents, chartFailed, chartRunning, rollupOf, stateGlyph, stateTone, stateWord, sunburstCells, sunburstSvg } from './sunburst'

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
// The key of the Sessions row a press selected (ADR-0046); null selects none, and the panel shows this session.
const selected = atom({ plugin: 'task-compass', key: 'selected' } as const, null)
// Collapse state (all expanded by default): the Sessions hierarchy list under this session, and the sprints folded to their header and progress.
const listCollapsed = atom({ plugin: 'task-compass', key: 'listCollapsed' } as const, false)
const foldedSprints = atom({ plugin: 'task-compass', key: 'foldedSprints' } as const, [])
// agent-watch's tracking, read and never written (types/index.d.ts, the mirror):
// the Sessions tree draws from it (ADR-0045).
const watchAgents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const watchNow = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
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
/** The hierarchy table's columns, in cells: STATE, STEPS, TIME, TOK. */
const COL = { state: 11, steps: 7, time: 6, tok: 6 }
/** The rows the KPI row and the selected-element panel take, margin included. */
const KPI_ROWS = 5
const PANEL_ROWS = 9
/** The compact strip's rows: its margin and its line. */
const STRIP_ROWS = 2
const KPI_HEIGHT = 4
/** The lines the Sessions tree may take beyond its session heads and the ledger's tasks. */
const TREE_LINES = 16
/** The fewest pane rows the sunburst is drawn in (it is hidden below them), and the room left for the board below which it stops growing. */
const CHART_MIN_ROWS = 9
const CHART_FLOOR = 6
/** The tight tier, which keeps the chart on a default-height pane: its least rows (terminal), its least pixels (desktop) and the board's floor. */
const CHART_TIGHT_ROWS = 8
const CHART_TIGHT_PX = 160
const TIGHT_FLOOR = 3
/** The board's rows when every sprint shown is folded: its header, its progress and its toggle. */
const FOLDED_BOARD_ROWS = 3
/** The Sessions list's lines when folded: this session's margin and row, and the toggle under it. */
const FOLDED_LIST_LINES = 3
/** The chart's share of the pane's width. */
const CHART_SHARE = 0.8
/** Estimates, not measurements: the pixels a pane column and a pane row take on a desktop, to turn the chart's width into rows. */
const CELL_PX = 7
const ROW_PX = 20
/** The `Svg`'s size in pixels is derived from the pane's width, between these. */
const CHART_PX_MIN = 220
const CHART_PX_MAX = 1000
/** The legend's width in cells, glyphs and gaps included, to estimate how many rows it wraps to. */
const LEGEND_CELLS = 59
/** The code to show before a name: none for the centre, or when the name already begins with it (a ledger task's id). */
const shownCode = (code: string, name: string) => (name.startsWith(`${code} ·`) ? '' : code)
/** The rows a panel's title bar and its rule take. */
const BOARD_HEAD_ROWS = 2

/**
 * A subagent's glyph, as agent-watch draws it: its identity by the order it
 * was first seen, hollow while it waits and solid otherwise. Its colour is
 * its state (`agentState`).
 */
const agentGlyph = (index: number, status: string) => {
  const pair = IDENTITY[index % IDENTITY.length] ?? IDENTITY[0]!
  return isActive(status) && status !== 'running' ? pair[1] : pair[0]
}

/** The rows the Sessions panel's parts take, and which of them fit: the one place the pane's height is spent. */
export type SessionsLayout = {
  hasChart: boolean
  hasKpi: boolean
  hasSelected: boolean
  /** The compact strip's rows when it is drawn instead of the panel. */
  stripRows: number
  legendRows: number
  chartRows: number
  /** The margin above the chart: one row, none in the tight tier. */
  chartGap: number
  /** The blank line above this session's row: one, none in the tight tier. */
  headGap: number
  chartPx: number
  chartColumns: number
  chartWidth: number | string
  /** The rows left to the board's columns. */
  room: number
  /** The tree's lines, as drawn. */
  treeLines: number
  /** Every row the parts above take, the board at `room` included: never more than `rows`. */
  used: number
}
export const sessionsLayout = (input: {
  rows: number
  cols: number
  isTerminal: boolean
  hasTree: boolean
  canChart: boolean
  lines: number
  shrink: (budget: number) => { lines: number; apply: () => void }
  flatLines: number
  /** The Sessions list has this session's toggle line, which the tight tier pays for with the blank line above this session's row. */
  hasFold?: boolean
  /** The Sessions hierarchy list is folded to this session's row and its toggle. */
  isListCollapsed?: boolean
  /** Every sprint the board shows is folded to its header, progress and toggle. */
  isBoardFolded?: boolean
}): SessionsLayout => {
  const { rows, cols, isTerminal, hasTree } = input
  const isListCollapsed = hasTree && input.isListCollapsed === true
  const isBoardFolded = input.isBoardFolded === true
  // The rows the board's columns need at the least; fewer when every sprint is folded.
  const floor = isBoardFolded ? FOLDED_BOARD_ROWS : CHART_FLOOR
  // A folded list is this session's row and the toggle under it, below the table head.
  const fold = input.hasFold === true ? 1 : 0
  let lines = isListCollapsed ? FOLDED_LIST_LINES : input.lines + fold
  // The chart's margin and the legend under it (it wraps in a narrow pane),
  // and the rows it is drawn in at the least; it grows to its share of the
  // width from what is left over.
  const legendRows = Math.max(1, Math.ceil(LEGEND_CELLS / Math.max(1, cols)))
  // Two tiers: the chart as it is meant to look, then a tight one (a smaller least size, no margin above it or above this session's row, a board of its header and counts)
  // that keeps the chart on a default-height pane before it is hidden.
  const tiers = [
    { chartMin: isTerminal ? CHART_MIN_ROWS : Math.ceil(CHART_PX_MIN / ROW_PX), minPx: CHART_PX_MIN, gap: 1, headGap: 1, floor },
    { chartMin: isTerminal ? CHART_TIGHT_ROWS : Math.ceil(CHART_TIGHT_PX / ROW_PX), minPx: CHART_TIGHT_PX, gap: 0, headGap: 0, floor: Math.min(floor, TIGHT_FLOOR) },
  ]
  let tier = tiers[0]!
  let chartMin = tier.chartMin
  let chartBlock = chartMin + tier.gap + legendRows
  const wantColumns = Math.max(4, Math.round(CHART_SHARE * cols))
  const wantPx = Math.round(CHART_SHARE * cols * CELL_PX)
  // A braille cell is 2x4 dots and about twice as tall as wide: rows are half the columns for a round chart.
  const wantRows = isTerminal ? Math.floor(wantColumns / 2) : Math.round(wantPx / ROW_PX)
  const headRows = hasTree ? 1 : 0
  // The Sprints panel's title bar and rule, the legend and margin above the Sessions panel, and the Sessions panel's own head.
  const fixedRows = 5 + BOARD_HEAD_ROWS
  // The chart's rows, the strip (the least the Selected part takes) and the board's floor are all paid for.
  const credit = (one: (typeof tiers)[number]) => (fold === 1 && one.headGap === 0 ? 1 : 0)
  const fits = (n: number, one: (typeof tiers)[number]) => rows - (n - credit(one) + 3 + headRows) - fixedRows - (one.chartMin + one.gap + legendRows) - STRIP_ROWS >= one.floor
  let hasChart = false
  // The tree's member lines yield ("+N more") before the chart is hidden, down to the session heads alone; then the tight tier; the chart is hidden last.
  for (const one of input.canChart ? tiers : []) {
    if (fits(lines, one)) {
      hasChart = true
    } else {
      const smaller = input.shrink(Math.max(0, Math.min(TREE_LINES, rows - 3 - headRows + credit(one) - fixedRows - (one.chartMin + one.gap + legendRows) - STRIP_ROWS - one.floor) - fold))
      if (fits(smaller.lines + fold, one)) {
        smaller.apply()
        lines = smaller.lines + fold
        hasChart = true
      }
    }
    if (hasChart) {
      tier = one
      break
    }
  }
  chartMin = tier.chartMin
  chartBlock = chartMin + tier.gap + legendRows
  const chartGap = tier.gap
  const floorRows = tier.floor
  const headGap = 1 - credit(tier)
  const panelLines = hasTree ? lines - credit(tier) : input.flatLines
  // The KPI row and the selected-element panel fold before the chart does.
  const spare = rows - (panelLines + 3 + headRows) - fixedRows - (hasChart ? chartBlock : 0)
  // The panel is funded before the KPI row; without room for it a two-row strip (margin and line) keeps the transcript reachable.
  const hasSelected = hasTree && spare - PANEL_ROWS >= floorRows
  const stripRows = hasTree && !hasSelected ? STRIP_ROWS : 0
  const taken = (hasSelected ? PANEL_ROWS : stripRows)
  const hasKpi = hasTree && spare - taken - KPI_ROWS >= floorRows
  const slack = Math.max(0, spare - (hasKpi ? KPI_ROWS : 0) - taken - floorRows)
  // The chart grows from the slack only, so the table and the board keep their room; capped, it shrinks rather than push them out.
  const cappedRows = hasChart ? Math.max(chartMin, Math.min(wantRows, chartMin + slack)) : 0
  // The `Svg`'s pixels: its share of the pane, or as tall as the rows it may take, and the rows that many pixels fill.
  const chartPx = Math.max(tier.minPx, Math.min(CHART_PX_MAX, Math.min(wantPx, cappedRows * ROW_PX)))
  const chartRows = isTerminal ? cappedRows : hasChart ? Math.ceil(chartPx / ROW_PX) : 0
  const room = isBoardFolded ? floor : Math.max(floorRows, spare - (hasKpi ? KPI_ROWS : 0) - taken - (chartRows - (hasChart ? chartMin : 0)))
  const chartColumns = Math.min(wantColumns, chartRows * 2)
  // The `Svg` fills its slot: 80% of the pane, or, when the room is short, as wide as that many rows are tall.
  const chartWidth = chartPx < wantPx ? Math.max(8, Math.floor(chartPx / CELL_PX)) : `${CHART_SHARE * 100}%`
  const used = fixedRows + panelLines + 3 + headRows + (hasKpi ? KPI_ROWS : 0) + taken + (hasChart ? chartGap + chartRows + legendRows : 0) + room
  return { hasChart, hasKpi, hasSelected, stripRows, legendRows, chartRows, chartGap, headGap, chartPx, chartColumns, chartWidth, room, treeLines: panelLines, used }
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
    // `Raster` is the terminal's alone and `Svg` the remote surfaces'; each is drawn only on its own.
    const { Raster, Svg } = ui as unknown as Record<'Raster' | 'Svg', (props: Record<string, unknown>) => never>
    const { badge, frame, label, meter, panel, rule, value } = kit(ui, e.surface)
    const [sprintList, declared, taskList, agentRows, at, where, opened, scrolled, from, orchTasks, orchPolicy, orchOn, watched, watchClock, watchList, watchRunList, watchTone, picked, isListFolded, foldedList] = await Promise.all([
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
      read($, watchTasks),
      read($, watchRuns),
      read($, watchTones),
      read($, selected),
      read($, listCollapsed),
      read($, foldedSprints),
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
    const folds = new Set(foldedList)
    // Every sprint on view is folded: the board needs no more than their three rows.
    const isBoardFolded = shown.length > 0 && shown.every(one => folds.has(one.n))
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
    // The main session's toggle hangs under its row, one line, when anything sits below it to fold.
    const canFold = hasTree && tree.length > 0 && (tree.length > 1 || tree[0]!.running.length + tree[0]!.completed.length > 0)
    const isListFoldedNow = canFold && isListFolded
    let trimmed = trimTree(tree, TREE_LINES, clock)
    // The sunburst above the tree: it draws the untrimmed tree, and is hidden
    // when the pane would be left under its floor. A selection that no longer
    // exists (its agent left the tree) selects none.
    const rootKey = tree[0]?.key ?? 'main'
    const chart = hasTree ? arcs(tree, watchTone, { selected: picked ?? undefined, now: clock }) : []
    const byKey = new Map(chart.map(arc => [arc.key, arc] as const))
    const isPicked = picked !== null && byKey.has(picked)
    const current = isPicked ? picked : rootKey
    const chartOpts = { selected: isPicked ? picked : undefined, now: clock }
    const layout = sessionsLayout({
      rows,
      cols,
      isTerminal,
      hasTree,
      canChart: chart.length > 1 && typeof (isTerminal ? Raster : Svg) === 'function',
      lines: trimmed.lines,
      shrink: budget => {
        const smaller = trimTree(tree, budget, clock)
        return { lines: smaller.lines, apply: () => void (trimmed = smaller) }
      },
      hasFold: canFold,
      flatLines: shownAgents.length,
      isListCollapsed: isListFoldedNow,
      isBoardFolded,
    })
    const { hasChart, hasKpi, hasSelected, chartGap, headGap, chartPx, chartRows, chartColumns, chartWidth, room } = layout
    // A fold toggle: a plain Button in `line-strong` (`▾ HIDE` open, `▸ SHOW …` folded), with its hotkey on the terminal only.
    const foldButton = (key: string, hotkey: string | undefined, text: string, flip: () => void) => (
      <Button key={key} plain hotkey={isTerminal ? hotkey : undefined} onPress={flip}>
        <Text color={color('line-strong')}>{text}</Text>
      </Button>
    )
    const flipList = () => void update($, listCollapsed, now => !now)
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
          isFolded: folds.has(one.n),
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

    // The Sessions tree as the hierarchy table (ADR-0046): one row per session
    // and member, indented by depth and coloured by its state. Pressing a row
    // selects it; pressing the selected row clears it.
    const lookup = new Map<string, string | undefined>()
    for (const node of tree) {
      lookup.set(node.key, node.agentId)
      for (const member of [...node.running, ...node.completed]) lookup.set(member.key, member.agentId)
    }
    const column = (width: number, children: unknown) => (
      <Box width={width} flexShrink={0} flexDirection="row" justifyContent="flex-end">
        {children as never}
      </Box>
    )
    const tableRow = (one: { key: string; depth: number; kind: 'session' | 'member'; name: string; agentId?: string; status: string; badge?: { status: string; word: string }; isActive: boolean }) => {
      const arc = byKey.get(one.key)
      const tone = stateTone(one.status, one.badge)
      const isSelected = isPicked && picked === one.key
      const isViewed = one.agentId !== undefined && one.agentId === viewing
      const indent = '  '.repeat(Math.min(4, one.depth))
      const fixed = COL.state + COL.steps + COL.time + COL.tok + 4
      const code = shownCode(arc?.code ?? '', one.name)
      const name = fit(`${isViewed ? '▸' : ''}${one.name}`, Math.max(8, cols - indent.length - 2 - fixed - 1 - (code === '' ? 0 : code.length + 3)))
      const fill = isSelected ? { backgroundColor: color('raised') } : {}
      const press = () => void update($, selected, now => (now === one.key ? null : one.key))
      const steps = arc !== undefined && arc.progress.total > 0 ? `${arc.progress.done}/${arc.progress.total}` : ''
      const time = arc !== undefined && arc.duration > 0 ? elapsed(arc.duration) : ''
      const tokens = arc !== undefined && arc.tokens > 0 ? tokensText(arc.tokens) : ''
      return (
        <Box flexDirection="row" columnGap={1} {...fill}>
          <Box flexShrink={0}>
            <Text color={color(tone)} {...fill}>{`${indent}${one.kind === 'session' ? '⬢' : stateGlyph(one.status, one.badge)} `}</Text>
          </Box>
          {code !== '' && (
            <Box flexShrink={0}>
              <Text color={color('text-3')} {...fill}>{`${code} ·`}</Text>
            </Box>
          )}
          <Box flexGrow={1} flexShrink={1}>
            <Button key={`row-${one.key}`} plain onPress={press}>
              <Text color={color(one.isActive || isViewed || isSelected ? 'text-1' : 'text-2')} weight={one.kind === 'session' ? 'bold' : undefined} wrap="truncate-end" {...fill}>{name}</Text>
            </Button>
          </Box>
          {column(
            COL.state,
            <>
              <Text color={color(tone)} {...fill}>{stateGlyph(one.status, one.badge)}</Text>
              <Text color={color(tone)} size="caption" {...fill}>{` ${stateWord(one.status, one.badge)}`}</Text>
            </>,
          )}
          {column(COL.steps, <Text color={color('text-1')} tabular {...fill}>{steps}</Text>)}
          {column(COL.time, <Text color={color('text-3')} tabular size="caption" {...fill}>{time}</Text>)}
          {column(COL.tok, <Text color={color('text-3')} tabular size="caption" {...fill}>{tokens}</Text>)}
        </Box>
      )
    }

    const treeMember = (member: Member, depth: number) => {
      const caption = memberCaption(member, clock)
      const indent = '  '.repeat(Math.min(4, depth))
      return (
        <Box key={`member-${member.key}`} flexDirection="column">
          {tableRow({ key: member.key, depth, kind: 'member', name: member.label, agentId: member.agentId, status: member.status, badge: member.badge, isActive: member.isActive })}
          {caption !== '' && <Text color={color('text-3')} size="caption" wrap="truncate-end">{`${indent}  ${caption}`}</Text>}
        </Box>
      )
    }

    const sessionHead = (node: SessionNode) => {
      const indent = '  '.repeat(Math.min(4, node.depth))
      const caption = headCaption(node, clock)
      const cut = trimmed.shown.get(node.key)
      // This session's toggle, directly under its row and indented like its members; folded, it is all that stays under it.
      const fold = node === tree[0] && canFold && (
        <Box marginLeft={2 * Math.min(4, node.depth + 1)}>
          {foldButton('toggle-list', 's', isListFoldedNow ? `▸ SHOW ${tree.length} SESSIONS · ${chartAgents(chart)} AGENTS` : '▾ HIDE', flipList)}
        </Box>
      )

      return (
        <Box key={`head-${node.key}`} flexDirection="column" marginTop={node === tree[0] ? headGap : 1}>
          {tableRow({ key: node.key, depth: node.depth, kind: 'session', name: node.name, agentId: node.agentId, status: node.status, badge: node.badge, isActive: node.isActive })}
          {fold}
          {!isListFoldedNow && caption !== '' && <Text color={color('text-3')} size="caption" wrap="truncate-end">{`${indent}  ${caption}`}</Text>}
          {!isListFoldedNow && (cut?.members ?? []).map(member => treeMember(member, node.depth + 1))}
          {!isListFoldedNow && cut !== undefined && cut.hidden > 0 && (
            <Text color={color('text-3')} size="caption">{`${indent}  +${cut.hidden} more`}</Text>
          )}
          {node.kind === 'main' && node.running.length + node.completed.length === 0 && tree.length === 1 && (
            <Text color={color('text-3')}>{`${indent}  No subagent yet.`}</Text>
          )}
        </Box>
      )
    }

    // The KPI row: this session's progress, the agents, its tokens, the failed.
    const main = rollupOf(chart, rootKey)
    const failed = chartFailed(chart)
    const kw = Math.max(8, Math.floor((cols - 3) / 4))
    const kpi = (title: string, body: unknown) => (
      <Box
        width={kw}
        flexDirection="column"
        {...(isTerminal ? { borderStyle: 'single' as const, borderColor: color('line'), paddingX: 1 } : { paddingX: 2, paddingY: 1 })}
      >
        {!isTerminal && frame(kw, KPI_HEIGHT)}
        {label(title)}
        {body as never}
      </Box>
    )
    const percent = main !== undefined && main.total > 0 ? Math.round((main.done / main.total) * 100) : 0
    const kpiRow = (
      <Box flexDirection="row" columnGap={1} marginTop={1}>
        {kpi('Progress', value(String(percent), '%'))}
        {kpi('Agents', value(String(chartAgents(chart))))}
        {kpi('Tokens', value(tokensText(main?.tokens ?? 0), 'TOK'))}
        {kpi(
          'Failed',
          <Box flexDirection="row">
            {failed > 0 && <Text color={color('red')}>{'◆ '}</Text>}
            {value(String(failed), undefined, failed > 0 ? 'red' : 'text-1')}
          </Box>,
        )}
      </Box>
    )

    // The legend under the chart: each state's glyph and word.
    const legend = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} justifyContent="center">
        {(['running', 'completed', 'failed', 'blocked', 'queued', 'stopped'] as const).map(status => (
          <Box flexDirection="row">
            <Text color={color(stateTone(status))} size="caption">{stateGlyph(status)}</Text>
            <Text color={color('text-3')} size="caption">{` ${stateWord(status)}`}</Text>
          </Box>
        ))}
      </Box>
    )

    // The selected element, or this session: the row pressed. Only an agent
    // that has a transcript can open it.
    const one = rollupOf(chart, current)
    const oneArc = byKey.get(current)
    const oneAgent = lookup.get(current)
    const isOneViewed = oneAgent !== undefined && oneAgent === viewing
    const openOne = () => void $.ui.view(isOneViewed ? {} : { agentId: oneAgent })
    const selectedPanel =
      one === undefined || oneArc === undefined
        ? null
        : panel(
            { title: 'Selected', width: cols },
            <Box flexDirection="column">
              <Box flexDirection="row" columnGap={1}>
                <Text color={color(one.tone)}>{oneArc.kind === 'session' ? '⬢' : one.glyph}</Text>
                {shownCode(one.code, one.name) !== '' && <Text color={color('text-3')}>{`${one.code} ·`}</Text>}
                <Text color={color('text-1')} weight="semibold" wrap="truncate-end">{one.name}</Text>
              </Box>
              <Text color={color('text-3')} size="caption" wrap="truncate-end">{one.path}</Text>
              <Box flexDirection="row" columnGap={1}>
                {label('State')}
                <Text color={color(one.tone)}>{one.glyph}</Text>
                <Text color={color(one.tone)} size="caption">{` ${stateWord(one.status, oneArc.badge)}`}</Text>
              </Box>
              <Box flexDirection="row" columnGap={1}>
                {label('Progress')}
                {meter(one.done, one.total, 12, one.tone as Token)}
                {value(`${one.done}/${one.total}`, 'STEPS')}
                <Text color={color('text-3')} size="caption" tabular>{`· ${one.total > 0 ? Math.round((one.done / one.total) * 100) : 0}%`}</Text>
              </Box>
              <Box flexDirection="row" columnGap={2}>
                <Box flexDirection="row" columnGap={1}>{label('Duration')}{value(hms(one.duration))}</Box>
                <Box flexDirection="row" columnGap={1}>{label('Tokens')}{value(one.tokens.toLocaleString('en-US'), 'TOK')}</Box>
                <Box flexDirection="row" columnGap={1}>{label('Children')}{value(one.children > 0 ? String(one.children) : '—')}</Box>
              </Box>
              {oneAgent !== undefined && (
                <Button key="transcript" plain onPress={openOne}>
                  <Text color={color('text-1')} weight="semibold">{isOneViewed ? 'CLOSE TRANSCRIPT' : 'OPEN TRANSCRIPT'}</Text>
                </Button>
              )}
            </Box>,
          )

    // The compact strip when the full panel does not fit: the selection in one line, and its transcript.
    const selectedStrip =
      one === undefined || oneArc === undefined
        ? null
        : (
            <Box flexDirection="row" columnGap={1} marginTop={1}>
              <Text color={color(one.tone)}>{oneArc.kind === 'session' ? '⬢' : one.glyph}</Text>
              {shownCode(one.code, one.name) !== '' && <Text color={color('text-3')}>{`${one.code} ·`}</Text>}
              <Box flexShrink={1}>
                <Text color={color('text-1')} weight="semibold" wrap="truncate-end">{one.name}</Text>
              </Box>
              <Box flexShrink={0} flexDirection="row">
                <Text color={color(one.tone)} size="caption">{`· ${one.glyph} ${stateWord(one.status, oneArc.badge)}`}</Text>
                <Text color={color('text-3')} size="caption" tabular>{` · ${one.done}/${one.total} · ${tokensText(one.tokens)} TOK`}</Text>
              </Box>
              {oneAgent !== undefined && (
                <Button key="transcript" plain onPress={openOne}>
                  <Text color={color('text-1')} weight="semibold">{isOneViewed ? 'CLOSE TRANSCRIPT' : 'OPEN TRANSCRIPT'}</Text>
                </Button>
              )}
            </Box>
          )

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
        {panel(
          { title: 'Sprints', code: sprintList.length === 0 ? undefined : `${sprintList.length} sprint${sprintList.length === 1 ? '' : 's'}`, width: cols },
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

            <Box flexDirection="row" flexGrow={1}>
              {columns}
            </Box>
          </Box>,
        )}

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
              <Box flexDirection="column">
                {hasKpi && kpiRow}
                {hasChart && (
                  <Box flexDirection="column" marginTop={chartGap}>
                    <Box flexDirection="row" justifyContent="center">
                      {isTerminal ? (
                        <Raster key="sunburst" columns={chartColumns} rows={Math.floor(chartColumns / 2)} cells={sunburstCells(chart, chartColumns, Math.floor(chartColumns / 2), theme(), chartOpts)} />
                      ) : (
                        <Box width={chartWidth as never}>
                          <Svg
                            source={sunburstSvg(chart, chartPx, theme(), chartOpts)}
                            alt={`Sessions: ${tree.length} sessions, ${chartAgents(chart)} agents, ${chartRunning(chart)} running`}
                            isInteractive
                          />
                        </Box>
                      )}
                    </Box>
                    {legend}
                  </Box>
                )}
                {hasSelected ? selectedPanel !== null && <Box flexDirection="column" marginTop={1}>{selectedPanel}</Box> : selectedStrip}
                <Box flexDirection="row" columnGap={1}>
                  <Box flexGrow={1} flexShrink={1}>{label('Session')}</Box>
                  {column(COL.state, label('State'))}
                  {column(COL.steps, label('Steps'))}
                  {column(COL.time, label('Time'))}
                  {column(COL.tok, label('Tok'))}
                </Box>
                {(isListFoldedNow ? tree.slice(0, 1) : tree).map(sessionHead)}
              </Box>
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
