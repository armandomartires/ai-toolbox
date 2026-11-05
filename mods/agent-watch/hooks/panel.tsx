import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { AgentRow, BackgroundTask, OrchPolicy, OrchTask, Task, WorkflowRun } from '../types'
import { elapsed, fit, headCaption, trimTree } from './model'
import { memberCaption, sessionTree, tokensText } from './sessions'
import type { Member, SessionNode } from './sessions'
import { color, hms, kit, theme } from './sigma'
import type { Token } from './sigma'
import { arcs, chartAgents, chartFailed, chartRunning, rollupOf, stateGlyph, stateTone, stateWord, sunburstCells, sunburstSvg } from './sunburst'

// The Sessions panel (ADR-0046, ADR-0047): the KPI row, the sunburst, the
// selected element, the hierarchy table. One renderer draws it, for this mod's
// own pane and for any pane that has rows above it. The engine lists a
// module's reads and writes from atoms declared in that file, so the two the
// panel owns are declared here.

/** The key of the Sessions row a press selected (ADR-0046); null selects none, and the panel shows this session. */
const selected = atom({ plugin: 'agent-watch', key: 'selected' } as const, null)
/** The hierarchy list under this session is folded to this session's row and its toggle. */
const listCollapsed = atom({ plugin: 'agent-watch', key: 'listCollapsed' } as const, false)

/** The least width the panel is drawn for, in cells. */
const COLUMNS_MIN = 22
/** The hierarchy table's columns, in cells: STATE, STEPS, TIME, TOK. */
const COL = { state: 11, steps: 7, time: 6, tok: 6 }
/** The rows the KPI row (a label, a value and a caption, and the margin above) and the selected-element panel take. */
const KPI_ROWS = 4
/** This mod's version, bumped with plugin.json's (the test kit cannot read a .json): a desktop prints it under the table, so the person sees which copy draws the panel. */
export const VERSION = '0.11.0'
const PANEL_ROWS = 9
/** The compact strip's rows: its margin and its line. */
const STRIP_ROWS = 2
/** The rows a bracketed panel's frame takes: the padding or border above and below its head. */
const FRAME_ROWS = 2
/** The cells a bracketed panel's border and padding take across: two each side. */
const FRAME_COLS = 4
/** The rows the panel's title bar and its rule take. */
const HEAD_ROWS = 2
/** The table's head row. */
const TABLE_HEAD_ROWS = 1
/** Rows the accounting always left unclaimed below the frame and the table head; kept, so a pane never draws one row short. */
const SPARE_ROWS = 2
/** The lines the Sessions tree may take beyond its session heads and the ledger's tasks. */
const TREE_LINES = 16
/** The fewest rows a drag on the Sessions handle holds the panel's body at (ADR-0053): a 12-row panel less its frame and title. */
export const SESSIONS_MIN = 8
/** The fewest pane rows the sunburst is drawn in (it is hidden below them). */
const CHART_MIN_ROWS = 9
/** The tight tier, which keeps the chart on a default-height pane: its least rows (terminal). A desktop's chart is never shrunk. */
const CHART_TIGHT_ROWS = 7
/** The Sessions list's lines when folded: this session's margin and row, and the toggle under it. */
const FOLDED_LIST_LINES = 3
/** The chart's share of the pane's width. */
const CHART_SHARE = 0.85
/**
 * Estimates, not measurements: a desktop pane's column is its code font's advance (`RenderViewport`), about 7.2 px,
 * and a row about 20 px. The `Svg` is given its size in pixels from them: an interactive one is drawn in a frame that,
 * left without a size, keeps a browser's default 150 px height, so the chart came out a quarter of the pane wide.
 */
const CELL_PX = 7.2
const ROW_PX = 20
/** The `Svg`'s size in pixels is derived from the pane's width, between these. */
const CHART_PX_MIN = 220
const CHART_PX_MAX = 1600
/** The legend's width in cells, glyphs and gaps included, to estimate how many rows it wraps to. */
const LEGEND_CELLS = 59
/** The code to show before a name: none for the centre, or when the name already begins with it (a ledger task's id). */
const shownCode = (code: string, name: string) => (name.startsWith(`${code} ·`) ? '' : code)

/** The rows the Sessions panel's parts take, and which of them fit: the one place the panel's height is spent. */
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
  /** The `Svg`'s width and height in CSS pixels. */
  chartWidth: number
  /** The tree's lines, as drawn. */
  treeLines: number
  /** Every row the panel takes, the `reservedRows` above it included: never more than `rows`, except a desktop's chart with nothing left to fold. */
  used: number
}

export const sessionsLayout = (input: {
  rows: number
  cols: number
  isTerminal: boolean
  canChart: boolean
  lines: number
  shrink: (budget: number) => { lines: number; apply: () => void }
  /** The rows the pane spends above the panel (0 when the panel is the whole pane). */
  reservedRows: number
  /** The Sessions list has this session's toggle line, which the tight tier pays for with the blank line above this session's row. */
  hasFold?: boolean
  /** The Sessions hierarchy list is folded to this session's row and its toggle. */
  isListCollapsed?: boolean
}): SessionsLayout => {
  const { rows, cols, isTerminal } = input
  const isListCollapsed = input.isListCollapsed === true
  // A folded list is this session's row and the toggle under it, below the table head.
  const fold = input.hasFold === true ? 1 : 0
  let lines = isListCollapsed ? FOLDED_LIST_LINES : input.lines + fold
  // Everything inside the Sessions frame is `cols - FRAME_COLS` wide; the chart is its share of the pane, capped at that.
  const body = Math.max(1, cols - FRAME_COLS)
  const legendRows = Math.max(1, Math.ceil(LEGEND_CELLS / body))
  // Two tiers: the chart as it is meant to look, then a tight one (a smaller least size, no margin above it or above this session's row)
  // that keeps the chart on a default-height pane before it is hidden.
  // On a desktop the chart is 85% of the pane wide whatever the height: both tiers reserve its rows, the tight one only drops the margins.
  const shareCols = Math.min(CHART_SHARE * cols, body)
  const wantColumns = Math.max(4, Math.round(shareCols))
  const wantPx = Math.round(shareCols * CELL_PX)
  const wantRows = isTerminal ? Math.ceil(wantColumns / 2) : Math.max(Math.ceil(CHART_PX_MIN / ROW_PX), Math.ceil(wantPx / ROW_PX))
  const tiers = [
    { chartMin: isTerminal ? CHART_MIN_ROWS : wantRows, gap: 1, headGap: 1 },
    { chartMin: isTerminal ? CHART_TIGHT_ROWS : wantRows, gap: 0, headGap: 0 },
  ]
  let tier = tiers[0]!
  // What the panel spends beside its tree, KPI row, chart and selection: what the pane holds above it, the title bar and rule, the frame, the table's head.
  const fixed = Math.max(0, input.reservedRows) + HEAD_ROWS + FRAME_ROWS + TABLE_HEAD_ROWS + SPARE_ROWS
  // The chart's rows, the strip (the least the Selected part takes) and the tree are all paid for.
  const credit = (one: (typeof tiers)[number]) => (fold === 1 && one.headGap === 0 ? 1 : 0)
  const blockOf = (one: (typeof tiers)[number]) => one.chartMin + one.gap + legendRows
  const fits = (n: number, one: (typeof tiers)[number]) => rows - (n - credit(one) + fixed) - blockOf(one) - STRIP_ROWS >= 0
  let hasChart = false
  // The tree's member lines yield ("+N more") before the chart is hidden, down to the session heads alone; then the tight tier; the chart is hidden last.
  for (const one of input.canChart ? tiers : []) {
    if (fits(lines, one)) {
      hasChart = true
    } else {
      const smaller = input.shrink(Math.max(0, Math.min(TREE_LINES, rows - fixed + credit(one) - blockOf(one) - STRIP_ROWS) - fold))
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
  // A desktop never hides the chart for height: the tight tier, the tree folded to its heads, and the pane scrolls past what does not fit.
  if (!hasChart && !isTerminal && input.canChart) {
    tier = tiers[1]!
    if (!isListCollapsed) {
      const smallest = input.shrink(0)
      smallest.apply()
      lines = smallest.lines + fold
    }
    hasChart = true
  }
  const chartBlock = blockOf(tier)
  const headGap = 1 - credit(tier)
  const panelLines = lines - credit(tier)
  // The KPI row and the selected-element panel fold before the chart does.
  const spare = rows - (panelLines + fixed) - (hasChart ? chartBlock : 0)
  // The panel is funded before the KPI row; without room for it a two-row strip (margin and line) keeps the transcript reachable.
  // A desktop folds neither for height, as it keeps its chart: its pane scrolls, and Compass's pane hands it the whole pane's rows though its board took some.
  const hasSelected = !isTerminal || spare - PANEL_ROWS >= 0
  const stripRows = hasSelected ? 0 : STRIP_ROWS
  const taken = hasSelected ? PANEL_ROWS : stripRows
  const hasKpi = !isTerminal || spare - taken - KPI_ROWS >= 0
  const slack = Math.max(0, spare - (hasKpi ? KPI_ROWS : 0) - taken)
  // The chart grows from the slack only, so the table keeps its room; capped, it shrinks rather than push it out.
  const chartRows = hasChart ? Math.max(tier.chartMin, Math.min(wantRows, tier.chartMin + slack)) : 0
  // The `Svg`'s markup is never smaller than its slot, whatever the height: it is drawn from a generous pixels-per-cell and the host fits it to the slot.
  const chartPx = Math.max(CHART_PX_MIN, Math.min(CHART_PX_MAX, wantPx))
  const chartColumns = Math.min(wantColumns, chartRows * 2)
  const used = fixed + panelLines + (hasKpi ? KPI_ROWS : 0) + taken + (hasChart ? tier.gap + chartRows + legendRows : 0)
  return { hasChart, hasKpi, hasSelected, stripRows, legendRows, chartRows, chartGap: tier.gap, headGap, chartPx, chartColumns, chartWidth: chartPx, treeLines: panelLines, used }
}

/** What the panel draws: agent-watch's tracking and task-orchestrator's ledger, as the pane read them. */
export type SessionsState = {
  agents: AgentRow[]
  now: number
  tasks: Task[]
  runs: WorkflowRun[]
  tones: Record<string, number>
  ledger: OrchTask[]
  policy: OrchPolicy
  isOrchOn: boolean
  /** The background shells and monitors (ADR-0049); none when the pane did not read them. */
  background?: BackgroundTask[]
}

/**
 * The Sessions panel as one bracketed frame, from `state`: for the pane `e`
 * (its size, surface and viewed agent) with `reservedRows` of it spent above
 * the panel. A declaration: the engine follows `$` past an import only into one.
 * It draws colour by state (`stateTone`), never by session. With `resize`
 * the panel takes a handle on its bottom edge, keyed `resize.key`, and
 * `resize.held` is the rows a drag holds its body at (ADR-0053).
 */
export async function renderSessions(
  $: EngineInterface,
  e: RenderInput<'Pane'>,
  state: SessionsState,
  reservedRows: number,
  resize?: { key: string; held?: number },
) {
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  // `Raster` is the terminal's alone and `Svg` the remote surfaces'; each is drawn only on its own.
  const { Raster, Svg } = ui as unknown as Record<'Raster' | 'Svg', (props: Record<string, unknown>) => never>
  const { label, meter, panel, stats, value } = kit(ui, e.surface)
  const [picked, isListFolded] = await Promise.all([read($, selected), read($, listCollapsed)])
  const isTerminal = e.surface === 'terminal'
  const cols = Math.max(COLUMNS_MIN, e.props.bodyColumns)
  // The rows a drag on the handle holds the panel at, else the pane's.
  // A held body is the row budget, with what the frame, the title and the rows above take added back.
  const held = resize?.held === undefined ? undefined : Math.max(SESSIONS_MIN, resize.held)
  const rows = held === undefined ? Math.max(16, e.props.scroll.bodyRows) : held + Math.max(0, reservedRows) + HEAD_ROWS + FRAME_ROWS
  // The frame holds what is four cells narrower than the pane.
  const body = Math.max(1, cols - FRAME_COLS)
  const viewing = e.props.view.agentId
  const clock = state.now

  const tree = sessionTree({ rows: state.agents, runs: state.runs, tones: state.tones, tasks: state.tasks, ledger: state.ledger, policy: state.policy, isOrchOn: state.isOrchOn, background: state.background })
  // This session's toggle hangs under its row, one line, when anything sits below it to fold.
  const canFold = tree.length > 0 && (tree.length > 1 || tree[0]!.running.length + tree[0]!.completed.length > 0)
  const isListFoldedNow = canFold && isListFolded
  let trimmed = trimTree(tree, TREE_LINES, clock)
  // The sunburst above the tree draws the untrimmed tree. A selection that no longer exists (its agent left the tree) selects none.
  const rootKey = tree[0]?.key ?? 'main'
  const chart = arcs(tree, { selected: picked ?? undefined, now: clock })
  const byKey = new Map(chart.map(arc => [arc.key, arc] as const))
  const isPicked = picked !== null && byKey.has(picked)
  const current = isPicked ? picked : rootKey
  const chartOpts = { selected: isPicked ? picked : undefined, now: clock }
  const layout = sessionsLayout({
    rows,
    cols,
    isTerminal,
    canChart: chart.length > 1 && typeof (isTerminal ? Raster : Svg) === 'function',
    lines: trimmed.lines,
    shrink: budget => {
      const smaller = trimTree(tree, budget, clock)
      return { lines: smaller.lines, apply: () => void (trimmed = smaller) }
    },
    reservedRows,
    hasFold: canFold,
    isListCollapsed: isListFoldedNow,
  })
  const { hasChart, hasKpi, hasSelected, chartGap, headGap, chartPx, chartColumns, chartWidth } = layout

  // A fold toggle: a plain Button in `line-strong` (`▾ HIDE` open, `▸ SHOW …` folded), with its hotkey on the terminal only.
  const foldButton = (key: string, hotkey: string | undefined, text: string, flip: () => void) => (
    <Button key={key} plain hotkey={isTerminal ? hotkey : undefined} onPress={flip}>
      <Text color={color('line-strong')}>{text}</Text>
    </Button>
  )
  const flipList = () => void update($, listCollapsed, now => !now)

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
    const fixedCols = COL.state + COL.steps + COL.time + COL.tok + 4
    const code = shownCode(arc?.code ?? '', one.name)
    const name = fit(`${isViewed ? '▸' : ''}${one.name}`, Math.max(8, body - indent.length - 2 - fixedCols - 1 - (code === '' ? 0 : code.length + 3)))
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
  // Four stat blocks in one divided row across the frame: a value is coloured only when out of limits (a failure).
  const percent = main !== undefined && main.total > 0 ? Math.round((main.done / main.total) * 100) : 0
  const kpiRow = (
    <Box marginTop={1}>
      {stats(body, [
        { label: 'Progress', value: String(percent), unit: '%', caption: `${main?.done ?? 0}/${main?.total ?? 0} steps` },
        { label: 'Agents', value: String(chartAgents(chart)), caption: `${chartRunning(chart)} running` },
        // The unit under the value, as the other blocks' captions sit, not beside it.
        { label: 'Tokens', value: tokensText(main?.tokens ?? 0), caption: 'TOK' },
        { label: 'Failed', value: String(failed), status: failed > 0 ? 'red' : undefined },
      ])}
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
          { title: 'Selected', width: body },
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

  // What runs: the agents, and the background tasks (ADR-0049), so a long background command never reads as 0 RUNNING.
  const running = state.agents.filter(row => row.status === 'running').length + (state.background ?? []).filter(task => task.status === 'running').length

  // The body's rows as the accounting lays them out: where a drag starts while the panel sizes itself.
  const bodyRows = Math.max(SESSIONS_MIN, layout.used - Math.max(0, reservedRows) - HEAD_ROWS - FRAME_ROWS)
  const content = (
    <Box flexDirection="column">
      {hasKpi && kpiRow}
      {hasChart && (
        <Box flexDirection="column" marginTop={chartGap}>
          <Box flexDirection="row" justifyContent="center">
            {isTerminal ? (
              <Raster key="sunburst" columns={chartColumns} rows={Math.floor(chartColumns / 2)} cells={sunburstCells(chart, chartColumns, Math.floor(chartColumns / 2), theme(), chartOpts)} />
            ) : (
              <Box>
                <Svg
                  source={sunburstSvg(chart, chartPx, theme(), chartOpts)}
                  width={chartWidth}
                  height={chartWidth}
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
      {!isTerminal && (
        <Box marginTop={1} justifyContent="flex-end">
          <Text key="agent-watch-version" color={color('text-3')} size="caption">{`AGENT-WATCH ${VERSION}`}</Text>
        </Box>
      )}
    </Box>
  )

  // `panel` holds the body at the held rows and cuts what does not fit, since a desktop folds nothing for height (ADR-0053).
  return panel(
    {
      title: 'Sessions',
      code: `${running} running`,
      width: cols,
      bracketed: true,
      resize: resize === undefined ? undefined : { key: resize.key, rows: bodyRows, held, min: SESSIONS_MIN },
    },
    content,
  )
}
