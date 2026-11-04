import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput, UiMessageArgument, UiMessageResult } from 'claude-code'

import type { WatchOutput } from './model'
import { drawMeter } from './band'
import { heldRows } from './handle'
import { renderSessions, SESSIONS_MIN } from './panel'
import { color, kit, recall } from './sigma'

// The same $.state values register.tsx writes: the engine lists a module's
// reads and writes from atoms declared in that file.
const agents = atom({ plugin: 'agent-watch', key: 'agents' } as const, [])
const now = atom({ plugin: 'agent-watch', key: 'now' } as const, 0)
const tasks = atom({ plugin: 'agent-watch', key: 'tasks' } as const, [])
const runs = atom({ plugin: 'agent-watch', key: 'runs' } as const, [])
const tones = atom({ plugin: 'agent-watch', key: 'tones' } as const, {})
const background = atom({ plugin: 'agent-watch', key: 'background' } as const, [])
// The rows the person dragged the Sessions panel in Compass's pane to, by surface; none there is automatic (ADR-0052).
const sessionsRows = atom({ plugin: 'agent-watch', key: 'sessionsRows' } as const, {})
// task-orchestrator's run, read and never written (types/index.d.ts, the mirror).
const ledger = atom({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
const policy = atom({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
const enabled = atom({ plugin: 'task-orchestrator', key: 'enabled' } as const, false)

/**
 * The pane Compass owns (ADR-0048): the one place agent-watch names it.
 * Renaming Compass's pane breaks the slot silently, so a test pins it.
 */
export const COMPASS_PANE = 'task-compass'

/** The resize handle's `Client` key under the Sessions panel in Compass's pane: what `ui.message` names when it posts. */
export const SESSIONS_HANDLE = 'sessions-handle'
/** The surfaces whose table has `Client`, where the handle is drawn and a held size applies; mobile and vscode keep the automatic layout. */
const SIZED = ['terminal', 'desktop']

/** The handle's props (`handle.tsx`, `HandleProps`): what the render draws and what a post answers, so a drag never waits on a redraw. */
const handleProps = (surface: string, rows: number, isAuto: boolean) => ({
  rows,
  min: SESSIONS_MIN,
  isAuto,
  surface,
  line: color('line-strong'),
  hot: color('cyan'),
  text: color('text-3'),
  edge: color('line'),
  bracket: color('text-1'),
})

// What the pane beneath the contribution last resolved to, so a live failure leaves one debug-log line (ADR-0048) and a redraw adds none.
let lastBelow = ''
const noteBelow = ($: EngineInterface, said: string) => {
  if (said === lastBelow) return
  lastBelow = said
  $.ui.log(`agent-watch: next(e) ${said}`, { to: 'debug' })
}

/** The state the Sessions panel is drawn from: the atoms this mod writes and the orchestrator's run it reads. */
const readState = async ($: EngineInterface) => {
  const [rows, at, list, all, held, orchTasks, orchPolicy, orchOn, bg] = await Promise.all([
    read($, agents),
    read($, now),
    read($, tasks),
    read($, runs),
    read($, tones),
    read($, ledger),
    read($, policy),
    read($, enabled),
    read($, background),
  ])

  return { agents: rows, now: at, tasks: list, runs: all, tones: held, ledger: orchTasks, policy: orchPolicy, isOrchOn: orchOn, background: bg }
}

/**
 * The Agents pane: the Sessions panel (`panel.tsx`, ADR-0047) and nothing
 * else, so no row of the pane is spent above it.
 */
export const renderPane = async ($: EngineInterface, e: RenderInput<'Pane'>) => {
  const state = await readState($)
  const { Box } = $.ui.resolve(e)
  const sessions = await renderSessions($, e, state, 0)

  return (
    <Box flexDirection="column" minHeight={e.props.scroll.bodyRows}>
      {sessions}
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

/**
 * Core's own drawing of a component, `{ type: 'engine', ref }`: what `next(e)` resolves to for the innermost hook when no plugin below drew the pane (the engine's types: core is the last hook). Embedded in a tree it nests the engine's frame in the pane's body or fails the tree whole, and the engine then draws its own pane over the board (ADR-0048, clause 3), so it is never embedded.
 */
const isEngineElement = (value: unknown) => typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'engine'

/**
 * agent-watch's part of Compass's pane (ADR-0048): what Compass draws, then
 * the progress meter, then the Sessions panel. The board's height is unknown
 * here, so no row is reserved and Compass's pane scrolls. An exported arrow,
 * passed by reference to `on(...)` in register.tsx as `renderPane` is: the
 * engine hands it `$` itself. The meter is `drawMeter`, the band's own.
 */
export const contributeSessions = async ($: EngineInterface, e: RenderInput<'Pane'>, next: (e: RenderInput<'Pane'>) => Promise<unknown>) => {
  const state = await readState($)
  // A rejected next(e) leaves the panel alone: the bottom of a pane's chain is unverified in the real engine, and a throw would cost Compass's board.
  // The same catch also hides an error thrown by Compass's own handler when
  // Compass is the hook beneath this one, so the panel draws without the
  // board; the debug log, not the screen, says so (`$.ui.log` to `debug`).
  let isRejected = false
  const resolved = await next(e).catch((error: unknown) => {
    isRejected = true
    noteBelow($, `rejected: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  })
  if (!isRejected) noteBelow($, resolved === undefined ? 'resolved nothing' : `resolved ${typeof resolved}${typeof resolved === 'object' && resolved !== null ? ` (type ${String((resolved as { type?: unknown }).type)})` : ''}`)
  // Core's own drawing is no part of the board (isEngineElement): it is left out, so the meter and the panel stand alone beneath a pane nobody else draws.
  const inner = isEngineElement(resolved) ? undefined : resolved
  const ui = $.ui.resolve(e)
  const { Box } = ui
  const meter = await drawMeter($, e)
  // A drag on the handle under the panel holds it at a height (ADR-0052), on a surface that draws the handle.
  const { Client } = ui as unknown as { Client?: (props: Record<string, unknown>) => never }
  const canSize = typeof Client === 'function' && SIZED.includes(e.surface)
  const held = canSize ? (await read($, sessionsRows))[e.surface] : undefined
  const sessions = await renderSessions(
    $,
    e,
    state,
    0,
    canSize && Client !== undefined
      ? { held, handle: rows => <Client key={SESSIONS_HANDLE} module="./handle.tsx" width="100%" height={1} props={handleProps(e.surface, rows, held === undefined)} /> }
      : undefined,
  )

  // One blank row above the meter and the panel, whichever mod drew first: without it the Sessions frame touches the Sprints frame whenever no meter stands between them.
  return (
    <Box flexDirection="column">
      {inner as never}
      <Box key="agent-watch-contribution" flexDirection="column" marginTop={1}>
        {meter}
        {sessions}
      </Box>
    </Box>
  )
}

/**
 * A drag on the handle under the Sessions panel: the rows it asks for are
 * held for this surface, or let go back to automatic (ADR-0052). An exported
 * arrow, passed by reference to `on(...)` in register.tsx.
 */
export const sizeSessions = async ($: EngineInterface, e: UiMessageArgument, next: (e: UiMessageArgument) => Promise<UiMessageResult>) => {
  const asked = SIZED.includes(e.surface) ? heldRows(e.data, SESSIONS_MIN) : undefined
  if (asked === undefined) return next(e)
  await update($, sessionsRows, now => {
    const { [e.surface]: _, ...rest } = now
    return asked === null ? rest : { ...rest, [e.surface]: asked }
  })
  await next(e)
  // The instance's next props at once: a drag's next move should not wait for the redraw. Automatic waits for that redraw, which alone knows the rows drawn.
  return asked === null ? {} : { props: handleProps(e.surface, asked, false) }
}
