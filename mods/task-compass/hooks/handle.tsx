import type { ClientModule, ClientPointerEvent } from 'claude-code'

/**
 * A panel's resize handle (ADR-0052): a `Client` laid over the panel's bottom
 * edge (`handleSlot`), so a drag reaches it (`surface.onPointer`), and posted
 * to the drawing mod's own `ui.message` hooks, which store the rows and draw
 * again. A terminal draws the whole bottom edge, its corners and the grip in
 * it. On a desktop a text glyph cannot be placed to the pixel (a `▁` fell
 * below the line, seen live), so the hooks module draws the bar as an `Svg`
 * (`barSvg`) on the frame's bottom line and the region here draws only a hint.
 *
 * Shared, one owner (`mods/_template/hooks/handle.tsx`); each mod that sizes a
 * panel carries a byte-identical copy (`scripts/check-mods.py` rule 7).
 *
 * Posts `{ kind: 'move' | 'nudge', rows }` (the rows the panel should take) and
 * `{ kind: 'reset' }` (back to automatic): a double press, or `r` once a click
 * gave the handle the focus; `up` and `down` nudge a row at a time.
 */
export type HandleProps = {
  /** The rows the panel takes as drawn now, what a drag starts from. */
  rows: number
  /** The fewest rows a drag asks for. */
  min: number
  /** No height is stored: the panel sizes itself. */
  isAuto: boolean
  /** `terminal` or `desktop`: how a drag's rows are measured (below). */
  surface: string
  /** Hex colours: the grip at rest, while hovered or dragged, the hint, the panel's edge and its corner brackets. */
  line: string
  hot: string
  text: string
  edge: string
  bracket: string
}

/** The cells the grip takes in the middle of the edge. */
const GRIP_CELLS = 8

/** The most rows a handle may ask a panel to take. */
export const HELD_MAX = 400

/**
 * What a handle's post asks, read by the drawing mod's `ui.message` hook: rows to hold, clamped to
 * `[min, HELD_MAX]`; `null` for back to automatic; `undefined` for nothing,
 * since a post is code's data, not a fact.
 */
export const heldRows = (data: unknown, min: number): number | null | undefined => {
  if (typeof data !== 'object' || data === null) return undefined
  const { kind, rows } = data as { kind?: unknown; rows?: unknown }
  if (kind === 'reset') return null
  if ((kind === 'move' || kind === 'nudge') && typeof rows === 'number' && Number.isFinite(rows)) return Math.max(min, Math.min(HELD_MAX, Math.round(rows)))
  return undefined
}

/** What a press starts: the drag's own values, per instance. */
type Drag = { y0: number | null; rows0: number; lastDown: number; props: HandleProps }

/** What the handle shows: hovered, dragged. */
type Look = { isHover: boolean; isDragging: boolean }

/** Two presses within this many milliseconds are a double press. */
const DOUBLE_MS = 400

// `surface` is the one object every call of an instance is handed, and its `state` is a copy taken at `setState`, so a drag in flight lives here.
const drags = new WeakMap<object, Drag>()

const Handle: ClientModule<HandleProps, Look> = (props, surface) => {
  const { Box, Text } = surface.elements
  let drag = drags.get(surface)
  if (drag === undefined) {
    // `performance.now()` starts near 0 in a fresh environment: a first press must never read as the second of a pair.
    drag = { y0: null, rows0: props.rows, lastDown: -Infinity, props }
    drags.set(surface, drag)
  }
  const held = drag
  // The listener reads the latest props: a desktop need not call the module again between pointer events.
  held.props = props
  const look = surface.state ?? { isHover: false, isDragging: false }
  const show = (next: Partial<Look>) => surface.setState({ ...look, ...next })
  const ask = (kind: 'move' | 'nudge', rows: number) => surface.post({ kind, rows: Math.max(held.props.min, Math.round(rows)) })

  surface.onPointer((event: ClientPointerEvent) => {
    if (event.type === 'enter' || event.type === 'leave') {
      show({ isHover: event.type === 'enter' })
      return
    }
    if (event.type === 'down') {
      const at = performance.now()
      if (at - held.lastDown < DOUBLE_MS) {
        held.lastDown = -Infinity
        held.y0 = null
        show({ isDragging: false })
        surface.post({ kind: 'reset' })
        return
      }
      held.lastDown = at
      held.y0 = event.y
      held.rows0 = held.props.rows
      show({ isDragging: true })
      return
    }
    if (event.type === 'move') {
      if (held.y0 === null) return
      // Rows are the region's own. A terminal measures them from the region where it now is, moved with the panel it sizes, so the rows drawn now
      // are the base; a desktop measures from where the region was at the press, so the rows drawn then are (seen live, TASK-0221).
      const base = held.props.surface === 'desktop' ? held.rows0 : held.props.rows
      ask('move', base + event.y - held.y0)
      return
    }
    if (event.type === 'up') {
      held.y0 = null
      show({ isDragging: false })
    }
  })

  surface.onKey(key => {
    if (key.key === 'up' || key.key === 'down') ask('nudge', held.props.rows + (key.key === 'up' ? -1 : 1))
    else if (key.key === 'r') surface.post({ kind: 'reset' })
  })

  const isHot = look.isDragging || look.isHover
  const hint = look.isDragging ? '' : look.isHover ? hintText(props.isAuto) : ''
  const grip = isHot ? props.hot : props.line
  if (props.surface === 'terminal') {
    // The panel's own bottom edge, redrawn whole with the grip in its middle: `└─` and `─┘` in the brackets' colour, `─` in the edge's.
    const middle = Math.max(GRIP_CELLS, surface.columns - 4)
    const label = hint === '' ? '' : ` ${hint} `
    const inner = Math.min(middle, GRIP_CELLS + label.length)
    const before = Math.floor((middle - inner) / 2)
    const after = middle - inner - before
    return (
      <Box flexDirection="row">
        <Text color={props.bracket}>└─</Text>
        <Text color={props.edge}>{'─'.repeat(before)}</Text>
        <Text color={grip}>{'━'.repeat(GRIP_CELLS)}</Text>
        {label !== '' && <Text color={props.text}>{label.slice(0, inner - GRIP_CELLS)}</Text>}
        <Text color={props.edge}>{'─'.repeat(after)}</Text>
        <Text color={props.bracket}>─┘</Text>
      </Box>
    )
  }
  // The bar is the hooks module's `Svg` under this region, and the hint its hover reveal above it (`hintText`); the region only takes the pointer.
  return <Text> </Text>
}

/** What a hover on the handle says: how to size, and how to go back to automatic. */
export const hintText = (isAuto: boolean) => (isAuto ? 'DRAG ↕ TO SIZE' : 'DRAG ↕ · DOUBLE-CLICK FOR AUTO')

/** The desktop's bar in CSS pixels: three times the frame's 1px line, its bottom on that line. */
export const BAR_PX = { width: 64, height: 3 } as const

/** The desktop's bar as `Svg` markup, in `fill`. */
export const barSvg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_PX.width}" height="${BAR_PX.height}" viewBox="0 0 ${BAR_PX.width} ${BAR_PX.height}"><rect width="${BAR_PX.width}" height="${BAR_PX.height}" fill="${fill}"/></svg>`

type El = (props: Record<string, unknown>) => unknown

/**
 * The handle as a mod draws it (ADR-0052): a one-row slot laid over the
 * panel's bottom edge, absolute in a column Box that holds the panel and
 * nothing else, so the slot's row is the frame's own last row on both
 * surfaces (a terminal's border row; a desktop's last padding row, whose foot
 * is the 1px edge). In it, on a desktop, the 3px bar and the hint, a framed
 * hover reveal on a solid fill just above the edge; then `client`, the
 * mod's own `Client` running this module, which takes the pointer.
 */
export const handleSlot = (
  els: { Box: El; Text: El; Svg?: El },
  o: { key: string; width: number; isTerminal: boolean; isAuto: boolean; bar: string; fill: string; edge: string; text: string; client: unknown },
) => {
  const { Box, Text, Svg } = els as unknown as Record<'Box' | 'Text' | 'Svg', (props: Record<string, unknown>) => never>
  return (
    <Box key={`${o.key}-slot`} position="absolute" bottom={0} left={0} width={o.width} height={1}>
      {!o.isTerminal && typeof Svg === 'function' && (
        <Box key={`${o.key}-bar`} position="absolute" bottom={0} left={0} width="100%" flexDirection="row" justifyContent="center">
          <Svg source={barSvg(o.bar)} width={BAR_PX.width} height={BAR_PX.height} alt="Resize handle" />
        </Box>
      )}
      {/* No key: keyed, the reveal's hover would be its own, which the engine refuses; the keyed slot is what it answers to. */}
      {!o.isTerminal && (
        <Box position="absolute" bottom={1} left={0} width="100%" flexDirection="row" justifyContent="center" display="none" hover={{ display: 'flex' }}>
          <Box borderStyle="single" borderColor={o.edge} backgroundColor={o.fill} paddingX={1}>
            <Text color={o.text} backgroundColor={o.fill} size="caption">{hintText(o.isAuto)}</Text>
          </Box>
        </Box>
      )}
      {o.client as never}
    </Box>
  )
}

export default Handle
