// SIGMAorbital for mods: the design system's tokens, status vocabulary and
// drawing primitives, as the engine's Box/Text trees can carry them (ADR-0043).
//
// ONE OWNER: mods/_template/hooks/sigma.tsx. Every other mods/*/hooks/sigma.tsx
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
//   as edges clipped from a bordered Box (`rule`, `Panel` with a height).
// - Titles, labels, buttons and tags uppercase; body text sentence case.
//   Numbers `tabular`, with a unit in text-3. Identifiers uppercase with
//   hyphens. `weight`, never the deprecated `bold`.
//
// What the host cannot carry, so this file does not try: the four type
// families (Orbitron, Rajdhani, Share Tech Mono, JetBrains Mono), radius,
// shadows, the background grid and corner brackets. Motion is a glyph pulse
// only, and only while something runs.
import type { ConfigValue, ElementTable, EngineInterface, On, RenderChildren, RenderSurface } from 'claude-code'

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
 * The primitives for one drawing: `ui` is what `$.ui.resolve(e)` returned and
 * `surface` the input's, since a terminal and a desktop draw edges apart.
 */
export const kit = (ui: Ui, surface: RenderSurface) => {
  const { Box, Text } = ui
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
   * A panel: an uppercase title in text-1 with an optional code in text-3 at
   * the right, a rule in `line` under it, then the body. Full borders are
   * quiet in the design, so a panel draws none; `card` frames it square,
   * which needs its height.
   */
  const panel = (opts: { title: string; code?: string; width: number; card?: { height: number; fill?: Token } }, body: RenderChildren) => {
    const head = (
      <Box flexDirection="row" justifyContent="space-between" width={opts.card ? opts.width - 4 : opts.width}>
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

  return { rule, frame, label, value, badge, meter, panel }
}
