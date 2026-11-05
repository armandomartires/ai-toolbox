// SIGMAorbital for mods: the design system's tokens, status vocabulary and
// drawing primitives, as the engine's Box/Text trees can carry them (ADR-0043).
//
// ONE OWNER: mods/_template/claude/hooks/sigma.tsx. Every other mods/*/claude/hooks/sigma.tsx
// is a byte-identical copy, because the sandbox cannot share a module between
// mods; tests/validate.sh (scripts/check-mods.py, rule 7) fails on a copy that
// differs. Change it here, then copy it to every mod.
//
// Source: the SIGMAorbital Design System artifact, project/tokens.json v2
// (themes Night ops and Daylight), its README and components/bundle.css.
//
// The rules every mod's surfaces follow:
// - Monochrome by default. Brightness is the hierarchy: text-3 (labels,
//   units, times) → text-2 (body) → text-1 (titles, values) → white (the
//   one peak on a screen). Never `dimColor`; name the token.
// - Colour is for state only: cyan nominal or running, amber caution, red
//   critical. Always beside its glyph or word. Green only for a signed
//   positive delta. Violet is a data series, never a state.
// - Line, not fill: rules and frames in `line`, controls in `line-strong`.
//   A fill (`raised`) marks only the active or selected element.
// - Square: a desktop rounds every Box border, so frames and rules are drawn
//   as edges clipped from a bordered Box (`rule`, `frame`, a bracketed panel).
// - Titles, labels, buttons and tags uppercase; body text sentence case.
//   Numbers `tabular`, with a unit in text-3. Identifiers uppercase with
//   hyphens. `weight`, never the deprecated `bold`.
//
// What the host cannot carry, so this file does not try: the four type
// families (Orbitron, Rajdhani, Share Tech Mono, JetBrains Mono), radius,
// shadows and the background grid. A bracketed panel draws its corner brackets
// as the border's own edges clipped to a 2-cell and a 1-row arm (`┌ ┐ └ ┘` on a
// terminal), so each arm lies on the line it sits on. Motion is a glyph pulse
// only, and only while something runs.
//
// Every panel in a pane is resizable (ADR-0053): `panel({ ..., resize })` draws
// the handle on its bottom edge (`handle.tsx`, a surface module every mod
// carries) and holds its body at the rows dragged to; the mod's `ui.message`
// hook answers with `resizeAnswer` into one `panelRows` value, read back with
// `heldOf`. A part more than one mod can use is built here, or beside this file
// in the template, never inside one mod.
import type { ConfigValue, ElementTable, EngineInterface, On, RenderChildren, RenderSurface } from 'claude-code'

import { BAR_PX, barSvg, heldRows, hintText } from './handle'

export const SIGMA = 'SIGMAorbital tokens v2'

export type ThemeId = 'dark' | 'light'

/** The base tokens, Night ops (dark, the brand) then Daylight, as tokens.json gives them. */
const BASE = {
  void: ['#07080a', '#dfe2dc'],
  bg: ['#0e1013', '#eceee9'],
  surface: ['#15181c', '#f6f7f4'],
  raised: ['#1c2026', '#ffffff'],
  grid: ['#1f242a', '#d5d8d2'],
  line: ['#3a4048', '#b4b8b1'],
  'line-strong': ['#6b737d', '#7a808a'],
  'text-3': ['#7e8790', '#5c626b'],
  'text-2': ['#b4bbc2', '#3d434b'],
  'text-1': ['#e8ecef', '#101215'],
  white: ['#ffffff', '#000000'],
  disabled: ['#4a4f57', '#9da29b'],
  cyan: ['#7fe7ff', '#00708a'],
  green: ['#7cffb2', '#007a5a'],
  amber: ['#ffc857', '#8a5a00'],
  red: ['#ff5a5f', '#b8360a'],
  violet: ['#b8a9ff', '#6a52c9'],
} as const

/** The alias tokens; seq-0 … seq-4 hold the same values as the tokens named. */
const ALIAS = {
  ink: 'text-1',
  'ink-muted': 'text-3',
  'on-ink': 'bg',
  focus: 'white',
  'status-nominal': 'cyan',
  'status-info': 'text-2',
  'status-caution': 'amber',
  'status-critical': 'red',
  'series-1': 'text-1',
  'series-2': 'cyan',
  'series-3': 'violet',
  'series-rest': 'line-strong',
  'seq-0': 'grid',
  'seq-1': 'line',
  'seq-2': 'line-strong',
  'seq-3': 'text-2',
  'seq-4': 'white',
} as const satisfies Record<string, keyof typeof BASE>

export type Token = keyof typeof BASE | keyof typeof ALIAS

const build = (i: 0 | 1) => {
  const out = {} as Record<Token, string>
  for (const [name, values] of Object.entries(BASE)) out[name as Token] = values[i]
  for (const [name, base] of Object.entries(ALIAS)) out[name as Token] = BASE[base][i]
  return out
}

/** Every token's hex, per theme. */
export const TOKENS: Record<ThemeId, Record<Token, string>> = { dark: build(0), light: build(1) }

let current: ThemeId = 'dark'

/** The SIGMAorbital theme for the host's `theme` setting: any light family is Daylight, the rest Night ops. */
export const themeOf = (value: ConfigValue | undefined): ThemeId =>
  typeof value === 'string' && value.includes('light') ? 'light' : 'dark'

export const theme = () => current

/** A token's hex in the current theme. */
export const color = (token: Token) => TOKENS[current][token]

/** Reads the host's theme setting; a failed read keeps Night ops, the brand theme. */
// A function declaration, not an arrow: the engine follows `$` past an
// import only into one, which a bundle of the module keeps as written.
export async function syncTheme($: EngineInterface) {
  try {
    current = themeOf((await $.config.list()).find(row => row.key === 'theme')?.value)
  } catch {
    current = 'dark'
  }
  return current
}

/** Follows a change of the theme setting, observed and never denied, and redraws. */
export function watchTheme(on: On) {
  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const done = await next(e)
    if (done.deny === undefined) {
      current = themeOf(done.value)
      $.ui.invalidate('ui.render')
    }
    return done
  })
}

/** The four states of the design, and offline: a glyph, a colour, a default word. */
export type Status = 'nominal' | 'info' | 'caution' | 'critical' | 'offline'

export const STATUS: Record<Status, { glyph: string; token: Token; word: string }> = {
  nominal: { glyph: '●', token: 'status-nominal', word: 'NOMINAL' },
  info: { glyph: '○', token: 'status-info', word: 'INFO' },
  caution: { glyph: '▲', token: 'status-caution', word: 'CAUTION' },
  critical: { glyph: '◆', token: 'status-critical', word: 'CRITICAL' },
  offline: { glyph: '○', token: 'text-3', word: 'OFFLINE' },
}

/**
 * A subagent's identity: one glyph pair per agent, solid and hollow, fixed
 * when it is first seen. Monochrome, one cell wide, and none of the status
 * glyphs (● ○ ◌ ◐ ◑ ▲ ◆), so its colour is free to say its state.
 */
export const IDENTITY: readonly (readonly [string, string])[] = [
  ['■', '□'],
  ['⬢', '⬡'],
  ['✦', '✧'],
  ['★', '☆'],
  ['⬟', '⬠'],
  ['▮', '▯'],
  ['✚', '✛'],
]

/** A subagent's state: the colour of its glyph, and the word for it. */
export const agentState = (status: string): { token: Token; word: string } => {
  switch (status) {
    case 'running':
      return { token: 'cyan', word: 'RUNNING' }
    case 'pending':
    case 'waiting':
      return { token: 'text-2', word: 'WAITING' }
    case 'idle':
      return { token: 'text-2', word: 'IDLE' }
    case 'completed':
      return { token: 'text-1', word: 'DONE' }
    case 'failed':
      return { token: 'red', word: 'FAILED' }
    case 'killed':
      return { token: 'text-3', word: 'STOPPED' }
    default:
      return { token: 'text-3', word: status.toUpperCase() }
  }
}

export const fit = (text: string, columns: number) =>
  text.length <= columns ? text : `${text.slice(0, Math.max(1, columns - 1))}…`

/** A compact duration: `12s`, `3m05s`, `1h04m`. */
export const elapsed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

/** A duration as the design prints a time: `HH:MM:SS`. */
export const hms = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`
}

/** A meter's segments: `▰` for each one on, `▱` for the rest. */
export const segments = (done: number, total: number, width: number) => {
  const cells = Math.max(1, width)
  const on = total > 0 ? Math.round((cells * Math.min(done, total)) / total) : 0
  return { on: '▰'.repeat(on), off: '▱'.repeat(cells - on) }
}

const OUTPUT_MAX = 50
const outputs = new Map<string, unknown>()

/**
 * Keeps a command's structured result under the exact text it answers, so
 * its `CommandOutput` hook can draw that text as a tree. The last 50 only.
 */
export const remember = <T,>(text: string, data: T) => {
  outputs.delete(text)
  outputs.set(text, data)
  while (outputs.size > OUTPUT_MAX) outputs.delete(outputs.keys().next().value as string)
  return text
}

/** The result kept for a row's text, with or without the `<plugin>: ` the row may lead with. */
export const recall = <T,>(text: string): T | undefined => {
  if (outputs.has(text)) return outputs.get(text) as T
  const cut = text.indexOf(': ')
  return cut === -1 ? undefined : (outputs.get(text.slice(cut + 2)) as T | undefined)
}

type Ui = ElementTable<RenderSurface>

/**
 * A panel the person sizes by dragging its bottom edge (ADR-0053). `key` is
 * the handle's `Client` key, unique in its pane; `rows` the rows the body
 * takes when it sizes itself, where a drag starts; `held` what `heldOf` read
 * (undefined: automatic); `min` the fewest rows a drag holds the body at.
 */
export type Resize = { key: string; rows: number; held?: number; min: number }

/** Every held body height of a mod, one `$.state` value, by pane, handle and surface (`heldKey`). */
export type PanelRows = Record<string, number>

/** The surfaces whose element table has `Client`: only there is a handle drawn and a height held. */
export const RESIZED = ['terminal', 'desktop'] as const

const heldKey = (requestId: string, key: string, surface: string) => `${requestId}/${key}@${surface}`

/** The rows the person held a panel's body at on this pane and surface; undefined while it sizes itself. */
export const heldOf = (rows: PanelRows, e: { requestId: string; surface: string }, key: string) =>
  (RESIZED as readonly string[]).includes(e.surface) ? rows[heldKey(e.requestId, key, e.surface)] : undefined

/**
 * A mod's `ui.message` hook for its panels' handles: `mins` names each handle
 * it draws in the pane with its floor; `write` is the mod's own update of its
 * `panelRows` atom (atoms are read off the file that declares them). Resolves
 * to the answer, or undefined for a post that is no handle's, to pass on:
 * `(await resizeAnswer(e, MINS, fn => update($, panelRows, fn))) ?? next(e)`.
 */
export const resizeAnswer = async (
  e: { requestId: string; element: string; surface: string; data: unknown },
  mins: Record<string, number>,
  write: (fn: (now: PanelRows) => PanelRows) => Promise<unknown>,
): Promise<{ props?: unknown } | undefined> => {
  const min = mins[e.element]
  if (min === undefined || !(RESIZED as readonly string[]).includes(e.surface)) return undefined
  const asked = heldRows(e.data, min)
  if (asked === undefined) return undefined
  const at = heldKey(e.requestId, e.element, e.surface)
  await write(now => {
    const { [at]: _, ...rest } = now
    return asked === null ? rest : { ...rest, [at]: asked }
  })
  // The instance's next rows at once, so a drag's next move does not wait on the redraw; automatic waits for it, which alone knows the rows drawn.
  return asked === null ? {} : { props: { rows: asked, isAuto: false } }
}

/** One stat block: `value` pre-formatted, `delta` with its sign, `status` the colour of a value out of limits. */
export type StatBlock = { label: string; value: string; unit?: string; delta?: string; caption?: string; size?: 'md' | 'lg' | 'xl'; status?: Token }

/**
 * The primitives for one drawing: `ui` is what `$.ui.resolve(e)` returned and
 * `surface` the input's, since a terminal and a desktop draw edges apart.
 */
export const kit = (ui: Ui, surface: RenderSurface) => {
  const { Box, Button, Text } = ui
  const isTerminal = surface === 'terminal'

  /** A straight horizontal line, `width` cells, in `line` unless told. */
  const rule = (width: number, token: Token = 'line') =>
    isTerminal ? (
      <Text color={color(token)}>{'─'.repeat(Math.max(1, width))}</Text>
    ) : (
      <Box width={width} height={1} overflow="hidden">
        <Box position="absolute" top={0} left={-1} width={width + 2} height={3} borderStyle="single" borderColor={color(token)} />
      </Box>
    )

  /** A square frame `width` × `height` cells, laid under what follows it (a desktop rounds a plain border). */
  const frame = (width: number, height: number, token: Token = 'line') => {
    const side = (clip: Record<'top' | 'left' | 'width' | 'height', number>, inner: Record<'top' | 'left' | 'width' | 'height', number>) => (
      <Box position="absolute" {...clip} overflow="hidden">
        <Box position="absolute" {...inner} borderStyle="single" borderColor={color(token)} />
      </Box>
    )
    return [
      side({ top: 0, left: 0, width, height: 1 }, { top: 0, left: -1, width: width + 2, height: 3 }),
      side({ top: height - 1, left: 0, width, height: 1 }, { top: -2, left: -1, width: width + 2, height: 3 }),
      side({ top: 0, left: 0, width: 1, height }, { top: -1, left: 0, width: 3, height: height + 2 }),
      side({ top: 0, left: width - 1, width: 1, height }, { top: -1, left: -2, width: 3, height: height + 2 }),
    ]
  }

  /** An uppercase field label, column head or group name, in text-3. */
  const label = (text: string) => (
    <Text color={color('text-3')} size="caption" wrap="truncate-end">
      {text.toUpperCase()}
    </Text>
  )

  /** A value in text-1, tabular, with its unit in text-3. */
  const value = (text: string, unit?: string, token: Token = 'text-1') => (
    <Box flexDirection="row" flexShrink={0}>
      <Text color={color(token)} tabular>
        {text}
      </Text>
      {unit !== undefined && (
        <Text color={color('text-3')} size="caption">
          {` ${unit.toUpperCase()}`}
        </Text>
      )}
    </Box>
  )

  /**
   * The design's stat block (Readout): a label in text-3 over a large
   * tabular value in text-1 with its unit in text-3 after it, an optional
   * delta under it (green from a `+`, amber from a `-`) and a caption. A
   * value is coloured only when it is out of limits: pass its `status` token.
   */
  const stat = (opts: StatBlock) => (
    <Box flexDirection="column" flexShrink={1}>
      {label(opts.label)}
      <Box flexDirection="row" flexShrink={0}>
        <Text color={color(opts.status ?? 'text-1')} size={opts.size === 'md' ? 'heading' : 'title'} weight={opts.size === 'xl' ? 'bold' : undefined} tabular>
          {opts.value}
        </Text>
        {opts.unit !== undefined && (
          <Text color={color('text-3')} size="caption">
            {` ${opts.unit.toUpperCase()}`}
          </Text>
        )}
      </Box>
      {opts.delta !== undefined && (
        <Text color={color(opts.delta.startsWith('+') ? 'green' : opts.delta.startsWith('-') ? 'amber' : 'text-3')} size="caption" tabular>
          {opts.delta}
        </Text>
      )}
      {opts.caption !== undefined && (
        <Text color={color('text-3')} size="caption" wrap="truncate-end">
          {opts.caption.toUpperCase()}
        </Text>
      )}
    </Box>
  )

  /** A row of equal-width stat blocks, `width` cells in all, a 1-cell vertical divider in `line` between them and none after the last (a row stretches it to the blocks' height). */
  const stats = (width: number, blocks: StatBlock[]) => {
    const count = Math.max(1, blocks.length)
    const each = Math.max(4, Math.floor((width - (count - 1)) / count))
    // A block's rows: its label and value, and the delta and caption it has.
    const rows = Math.max(2, ...blocks.map(one => 2 + (one.delta !== undefined ? 1 : 0) + (one.caption !== undefined ? 1 : 0)))
    const divider = isTerminal ? (
      <Box flexDirection="column" width={1} flexShrink={0}>
        {Array.from({ length: rows }, () => (
          <Text color={color('line')}>│</Text>
        ))}
      </Box>
    ) : (
      <Box width={1} flexShrink={0} overflow="hidden">
        <Box position="absolute" top={-1} bottom={-1} left={0} width={3} borderStyle="single" borderColor={color('line')} />
      </Box>
    )
    return (
      <Box flexDirection="row" width={width}>
        {blocks.map((one, i) => [
          i > 0 && divider,
          <Box width={each} flexShrink={0} paddingLeft={i > 0 ? 1 : 0}>
            {stat(one)}
          </Box>,
        ])}
      </Box>
    )
  }

  /** A state: its glyph and word, in its colour. */
  const badge = (status: Status, word = STATUS[status].word) => (
    <Box flexDirection="row" flexShrink={0}>
      <Text color={color(STATUS[status].token)}>{STATUS[status].glyph}</Text>
      <Text color={color(STATUS[status].token)} size="caption">
        {` ${word.toUpperCase()}`}
      </Text>
    </Box>
  )

  /** `done/total` as segments: on in text-1 (or the token given), off in `line`. */
  const meter = (done: number, total: number, width: number, token: Token = 'text-1') => {
    const { on, off } = segments(done, total, width)
    return (
      <Box flexDirection="row" flexShrink={0}>
        {on !== '' && <Text color={color(token)}>{on}</Text>}
        {off !== '' && <Text color={color('line')}>{off}</Text>}
      </Box>
    )
  }

  /**
   * A straight edge `size` cells long, clipped from a bordered Box. It is
   * anchored to the panel's `top`/`bottom` and `left`/`right`, so it needs no
   * height: a Box with both `top` and `bottom` spans them.
   */
  const edge = (clip: Record<string, number>, inner: Record<string, number>, token: Token) => (
    <Box position="absolute" {...clip} overflow="hidden">
      <Box position="absolute" {...inner} borderStyle="single" borderColor={color(token)} />
    </Box>
  )

  /**
   * The geometry of a panel's border, shared by its edges and its brackets so
   * an arm lies exactly on the line it sits on: a horizontal line at `v`
   * (top or bottom), `len` cells long from `side`, and a vertical line on
   * `side`, over `rows` (the whole height, or the corner's one row at `v`).
   */
  const hLine = (v: 'top' | 'bottom', side: 'left' | 'right', width: number, len: number, token: Token) =>
    edge({ [v]: 0, [side]: 0, width: len, height: 1 }, { [v]: 0, [side]: -1, width: width + 2, height: 3 }, token)
  const vLine = (side: 'left' | 'right', v: 'top' | 'bottom' | null, token: Token) =>
    edge(
      { ...(v === null ? { top: 0, bottom: 0 } : { [v]: 0, height: 1 }), [side]: 0, width: 1 },
      { top: -1, bottom: -1, [side]: 0, width: 3 },
      token,
    )

  /** The four straight edges of a bracketed panel `width` wide, in `line`, whatever its height. */
  const edges = (width: number) => [
    hLine('top', 'left', width, width, 'line'),
    hLine('bottom', 'left', width, width, 'line'),
    vLine('left', null, 'line'),
    vLine('right', null, 'line'),
  ]

  /** The four corner brackets in text-1: the border's own edges clipped to a 2-cell horizontal and a 1-row vertical arm at each corner. */
  const brackets = (width: number) =>
    (['top', 'bottom'] as const).flatMap(v =>
      (['left', 'right'] as const).flatMap(side => [hLine(v, side, width, 2, 'text-1'), vLine(side, v, 'text-1')]),
    )

  /** A panel's inner width: its border and padding take two cells each side. */
  const innerWidth = (width: number) => Math.max(1, width - 4)

  /**
   * A panel: an uppercase title in text-1 with an optional code in text-3 at
   * the right, a rule in `line` under it, then the body. `bracketed` is the
   * design's frame, one per region: the `surface` fill, a square 1px border
   * in `line` and text-1 corner brackets, drawn without the panel's height.
   * Without it a panel draws no border; `card` frames it square, which needs its height.
   */
  /**
   * A panel, sized by a drag on its bottom edge when `opts.resize` is given and
   * the surface draws a `Client` (ADR-0053): the body held at `resize.held`
   * rows, what does not fit cut; the handle laid over the frame's last row (a
   * bracketed panel) or drawn in the row under it (a plain one). On a desktop
   * the handle's region shows nothing: a 3px bar on the edge and, on hover, a
   * framed hint on a solid fill above it. Elsewhere, the panel alone.
   */
  const panel = (
    opts: { title: string; code?: string; width: number; bracketed?: boolean; card?: { height: number; fill?: Token }; resize?: Resize },
    body: RenderChildren,
  ) => {
    const { Client, Svg } = ui as unknown as Record<'Client' | 'Svg', ((props: Record<string, unknown>) => never) | undefined>
    const r = opts.resize
    if (r === undefined || typeof Client !== 'function' || !(RESIZED as readonly string[]).includes(surface)) return drawPanel(opts, body)
    const held = r.held === undefined ? undefined : Math.max(r.min, r.held)
    const isFramed = opts.bracketed === true
    const sized = (
      <Box key={`${r.key}-body`} flexDirection="column" {...(held === undefined ? {} : { height: held, overflow: 'hidden' as const })}>
        {body}
      </Box>
    )
    const handle = (
      <Client
        key={r.key}
        module="./handle.tsx"
        width="100%"
        height={1}
        props={{
          rows: held ?? r.rows,
          min: r.min,
          isAuto: held === undefined,
          surface,
          isFramed,
          line: color('line-strong'),
          hot: color('cyan'),
          text: color('text-3'),
          edge: color('line'),
          bracket: color('text-1'),
        }}
      />
    )
    // Absolute over a bracketed frame's last row (its border row on a terminal, the padding row whose foot is the edge on a desktop); a plain panel's in the row under it.
    const slot = (
      <Box key={`${r.key}-slot`} width={opts.width} height={1} {...(isFramed ? { position: 'absolute' as const, bottom: 0, left: 0 } : {})}>
        {!isTerminal && typeof Svg === 'function' && (
          <Box key={`${r.key}-bar`} position="absolute" bottom={0} left={0} width="100%" flexDirection="row" justifyContent="center">
            <Svg source={barSvg(color('line-strong'))} width={BAR_PX.width} height={BAR_PX.height} alt="Resize handle" />
          </Box>
        )}
        {/* No key: keyed, the reveal's hover would be its own, which the engine refuses; the keyed slot is what it answers to. */}
        {!isTerminal && (
          <Box position="absolute" bottom={1} left={0} width="100%" flexDirection="row" justifyContent="center" display="none" hover={{ display: 'flex' }}>
            <Box borderStyle="single" borderColor={color('line')} backgroundColor={color('raised')} paddingX={1}>
              <Text color={color('text-1')} backgroundColor={color('raised')} size="caption">{hintText(held === undefined)}</Text>
            </Box>
          </Box>
        )}
        {handle}
      </Box>
    )
    return (
      <Box key={`${r.key}-frame`} flexDirection="column" width={opts.width}>
        {drawPanel(opts, sized)}
        {slot}
      </Box>
    )
  }

  const drawPanel = (
    opts: { title: string; code?: string; width: number; bracketed?: boolean; card?: { height: number; fill?: Token } },
    body: RenderChildren,
  ) => {
    const head = (
      <Box flexDirection="row" justifyContent="space-between" width={opts.card || opts.bracketed ? innerWidth(opts.width) : opts.width}>
        <Text color={color('text-1')} weight="bold" wrap="truncate-end">
          {opts.title.toUpperCase()}
        </Text>
        {opts.code !== undefined && (
          <Box flexShrink={0} marginLeft={1}>
            <Text color={color('text-3')} size="caption" tabular>
              {opts.code.toUpperCase()}
            </Text>
          </Box>
        )}
      </Box>
    )
    if (opts.bracketed) {
      // The terminal draws `single` with square corners and the glyphs sit on them (an absolute child is placed inside the border); a desktop rounds it, so there the edges are clipped.
      const corner = (glyph: string, pos: Record<string, number>) => (
        <Box position="absolute" {...pos}>
          <Text color={color('text-1')}>{glyph}</Text>
        </Box>
      )
      return (
        <Box
          width={opts.width}
          flexDirection="column"
          {...(isTerminal
            ? { borderStyle: 'single' as const, borderColor: color('line'), paddingX: 1 }
            : { backgroundColor: color('surface'), paddingX: 2, paddingY: 1 })}
        >
          {isTerminal
            ? [
                corner('┌', { top: -1, left: -1 }),
                corner('┐', { top: -1, right: -1 }),
                corner('└', { bottom: -1, left: -1 }),
                corner('┘', { bottom: -1, right: -1 }),
              ]
            : [...edges(opts.width), ...brackets(opts.width)]}
          {head}
          {rule(innerWidth(opts.width))}
          {body}
        </Box>
      )
    }
    if (!opts.card) {
      return (
        <Box flexDirection="column" width={opts.width}>
          {head}
          {rule(opts.width)}
          {body}
        </Box>
      )
    }
    // The terminal draws `single` with square corners; a desktop rounds it,
    // so there the card is padded and framed by four straight edges.
    const fill = !isTerminal && opts.card.fill ? color(opts.card.fill) : undefined
    return (
      <Box
        width={opts.width}
        flexDirection="column"
        backgroundColor={fill}
        {...(isTerminal ? { borderStyle: 'single' as const, borderColor: color('line'), paddingX: 1 } : { paddingX: 2, paddingY: 1 })}
      >
        {!isTerminal && frame(opts.width, opts.card.height)}
        {head}
        {body}
      </Box>
    )
  }

  /**
   * The design's Toggle, a square on/off switch: its track with the knob at
   * the end it stands at, the label uppercase, then the state word (ON or
   * OFF) in text-3. On: track and knob in text-1. Off: in line-strong. With
   * no `onPress` it is disabled: all of it in text-3, and not pressable.
   *
   * A `plain` Button holding Text, since only a Button takes a press and it
   * holds only strings and Text; the track is drawn in glyphs, so it stays
   * square on a desktop, which rounds a bordered Box. One press anywhere on
   * it flips it. Its `label` names the control and its state for a reader.
   */
  const toggle = (opts: { key: string; label: string; isOn: boolean; onPress?: () => void; onText?: string; offText?: string }) => {
    const isDisabled = opts.onPress === undefined
    const word = (opts.isOn ? (opts.onText ?? 'on') : (opts.offText ?? 'off')).toUpperCase()
    const track = color(isDisabled ? 'text-3' : opts.isOn ? 'text-1' : 'line-strong')
    const knob = (
      <Text color={track} mono>
        {opts.isOn ? '[ ■]' : '[■ ]'}
      </Text>
    )
    const name = (
      <Text color={color(isDisabled ? 'text-3' : 'text-1')} weight="semibold" wrap="truncate-end">
        {` ${opts.label.toUpperCase()}`}
      </Text>
    )
    const state = (
      <Text color={color('text-3')} size="caption">
        {`  ${word}`}
      </Text>
    )
    if (isDisabled) {
      return (
        <Box flexDirection="row">
          {knob}
          {name}
          {state}
        </Box>
      )
    }
    return (
      <Button key={opts.key} label={`${opts.label.toUpperCase()} ${word}`} plain onPress={opts.onPress}>
        {knob}
        {name}
        {state}
      </Button>
    )
  }

  return { rule, frame, label, value, stat, stats, badge, meter, panel, toggle, innerWidth }
}
