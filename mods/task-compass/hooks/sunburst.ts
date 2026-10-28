// The Sessions tree as a status sunburst (TASK-0199): pure geometry and drawing,
// no `$`. `arcs` lays the tree out in turns (0..1), each node splitting its span
// equally among its children, and rolls steps, tokens and time up the tree;
// `sunburstSvg` draws it for the surfaces that carry `Svg`; `sunburstCells`
// rasterises it into braille cells for the terminal's `Raster`.
import { isActive, tokensText } from './sessions'
import type { Member, SessionNode } from './sessions'
import { TOKENS, hms } from './sigma'
import type { ThemeId, Token } from './sigma'

export type Arc = {
  key: string
  /** The ring: 0 is the centre disc (this session), 1 the first ring out. */
  depth: number
  /** Turns from the top, clockwise: 0 to 1. */
  start: number
  end: number
  /** The state's token (`stateTone`); ownership is shown by containment, never by colour. */
  tone: Token
  status: string
  label: string
  /** The bare name, without the state word. */
  name: string
  /** The short code the graph shows in its sector: a ledger task's id (`T1`), an agent `A01`, a sub-session `S01`, a "+N" arc `+N`; empty for the centre. */
  code: string
  /** The glyph of its state (`stateGlyph`). */
  glyph: string
  kind: 'session' | 'member'
  /** The arc it sits in; none for the centre. */
  parent?: string
  badge?: { status: string; word: string }
  /** Steps done of steps in all, rolled up from its children. */
  progress: { done: number; total: number }
  tokens: number
  /** Milliseconds: its own span, or the longest of its children when it has no start. */
  duration: number
  /** The arc a row press selected: outlined in `white`. */
  selected?: boolean
  /** A session arc that is itself a delegating agent: it counts among the agents like a member. */
  agent?: boolean
  /** The "+N" arc of a capped session: how many members it stands for, and how many of them run or failed. */
  hidden?: { count: number; running: number; failed: number }
}

/** What `arcs` and the drawings take beyond the tree: the selected arc's key, and the clock a running span ends at. */
export type Opts = { selected?: string; now?: number }

/** Members drawn in all; past it each session's rest is one "+N" arc. */
const MEMBER_CAP = 160
const LABEL_MAX = 90

type Kind = 'running' | 'done' | 'failed' | 'blocked' | 'queued' | 'idle' | 'stopped'

/** The state a status and badge stand for: a critical badge fails, caution blocks, offline stops. */
export const stateKind = (status: string, badge?: { status: string }): Kind =>
  badge?.status === 'critical' ? 'failed'
  : badge?.status === 'caution' ? 'blocked'
  : badge?.status === 'offline' ? 'stopped'
  : status === 'running' ? 'running'
  : status === 'failed' ? 'failed'
  : status === 'blocked' || status === 'partial' ? 'blocked'
  : status === 'killed' || status === 'stopped' || status === 'cancelled' ? 'stopped'
  : status === 'idle' ? 'idle'
  : status === 'queued' || isActive(status) ? 'queued'
  : 'done'

const TONE: Record<Kind, Token> = { running: 'cyan', done: 'text-1', failed: 'red', blocked: 'amber', queued: 'text-3', idle: 'text-3', stopped: 'text-3' }
const GLYPH: Record<Kind, string> = { running: '●', done: '■', failed: '◆', blocked: '▲', queued: '□', idle: '□', stopped: '○' }

const WORDS: Record<Kind, string> = { running: 'RUNNING', done: 'DONE', failed: 'FAILED', blocked: 'BLOCKED', queued: 'QUEUED', idle: 'IDLE', stopped: 'STOPPED' }
/** The word of a state, one vocabulary for the chart, the table and the legend: its badge's when it has one (PARTIAL, CANCELLED), else its kind's. */
export const stateWord = (status: string, badge?: { status?: string; word?: string }): string =>
  (badge?.word ?? WORDS[stateKind(status, badge as { status: string } | undefined)]).toUpperCase()
const wordOf = stateWord

/** The SIGMAorbital token a state is drawn in: never green (a positive change) nor violet. */
export const stateTone = (status: string, badge?: { status: string }): Token => TONE[stateKind(status, badge)]
/** The glyph a state carries beside its word. */
export const stateGlyph = (status: string, badge?: { status: string }): string => GLYPH[stateKind(status, badge)]

type Struct = { node: SessionNode; members: Member[]; hidden: Member[]; kids: Struct[]; moreRunning: number; moreFailed: number }
type Roll = { done: number; total: number; tokens: number; duration: number }

/** A stable order: ledger tasks by id, then agents by start; a status change moves none. */
const stable = (members: Member[]) =>
  members.slice().sort((a, b) => {
    if ((a.taskId !== undefined) !== (b.taskId !== undefined)) return a.taskId !== undefined ? -1 : 1
    if (a.taskId !== undefined && b.taskId !== undefined) return a.taskId.localeCompare(b.taskId, undefined, { numeric: true })
    return (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity) || a.key.localeCompare(b.key)
  })

/** A label as text: XML-illegal control characters out, cut by code points so a surrogate pair is never split. */
const clip = (text: string) => Array.from(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')).slice(0, LABEL_MAX).join('')


/** The tree's flat, depth-first list as a hierarchy. */
const nest = (tree: readonly SessionNode[]): Struct | undefined => {
  if (tree.length === 0) return undefined
  let at = 0
  const take = (): Struct => {
    const node = tree[at++]!
    const out: Struct = { node, members: stable([...node.running, ...node.completed]), hidden: [], kids: [], moreRunning: 0, moreFailed: 0 }
    while (at < tree.length && tree[at]!.depth > node.depth) out.kids.push(take())
    // Sub-sessions by start then key, so one ending or another starting moves no arc.
    out.kids.sort((a, b) => (a.node.startedAt ?? Infinity) - (b.node.startedAt ?? Infinity) || a.node.key.localeCompare(b.node.key))
    return out
  }
  return take()
}

const flatten = (s: Struct): Struct[] => [s, ...s.kids.flatMap(flatten)]

const two = (n: number) => String(n).padStart(2, '0')

/**
 * The graph's short codes, fixed before any cap hides a member so that a
 * status or token change, or an agent ending, moves none: a ledger task keeps
 * its id; any other member is `A01`, `A02`… by start (then key) within its own
 * session; a sub-session is `S01`, `S02`… by start (then key) across the tree.
 */
const codesOf = (all: Struct[]): Map<string, string> => {
  const codes = new Map<string, string>()
  const byStart = (a: { startedAt?: number; key: string }, b: { startedAt?: number; key: string }) =>
    (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity) || a.key.localeCompare(b.key)
  for (const s of all) {
    let at = 0
    for (const m of s.members.filter(m => m.taskId === undefined).sort(byStart)) codes.set(m.key, `A${two(++at)}`)
    for (const m of s.members) if (m.taskId !== undefined) codes.set(m.key, m.taskId)
  }
  let at = 0
  for (const s of all.filter(s => s.node.kind !== 'main').sort((a, b) => byStart(a.node, b.node))) codes.set(s.node.key, `S${two(++at)}`)
  return codes
}

const span = (start: number | undefined, end: number | undefined, now: number | undefined) =>
  start === undefined ? 0 : Math.max(0, (end ?? now ?? start) - start)

/** A member's steps: its task list, else 0/1 while it runs or waits and 1/1 once ended. */
const memberRoll = (m: Member, now: number | undefined): Roll => {
  const tasks = m.row?.tasks
  const own = tasks !== undefined && tasks.length > 0
  const ended = stateKind(m.status, m.badge) !== 'running' && !m.isActive && !isActive(m.status)
  return {
    done: own ? tasks.filter(t => t.status === 'completed').length : ended ? 1 : 0,
    total: own ? tasks.length : 1,
    tokens: m.row?.tokens ?? 0,
    duration: span(m.startedAt ?? m.row?.startedAt, m.endedAt ?? m.row?.endedAt, now),
  }
}

const sum = (rolls: Roll[]): Roll => ({
  done: rolls.reduce((a, r) => a + r.done, 0),
  total: rolls.reduce((a, r) => a + r.total, 0),
  tokens: rolls.reduce((a, r) => a + r.tokens, 0),
  duration: Math.max(0, ...rolls.map(r => r.duration)),
})

/**
 * The sunburst's arcs, in the tree's order. The centre disc is this session
 * and spans the turn; a node splits its span equally among its children (its
 * members, a capped session's "+N", then its sub-sessions), so an arc's size
 * never depends on how much sits below it. A session at tree depth d is an arc
 * on ring d, its members on ring d+1. `tones` is kept for old call sites: the
 * colour is the state's.
 */
export const arcs = (tree: readonly SessionNode[], _tones?: Record<string, number>, opts: Opts = {}): Arc[] => {
  const root = nest(tree)
  if (root === undefined) return [{ key: 'main', depth: 0, start: 0, end: 1, tone: stateTone('idle'), status: 'idle', label: 'THIS SESSION', name: 'THIS SESSION', glyph: stateGlyph('idle'), code: '', kind: 'session', progress: { done: 0, total: 0 }, tokens: 0, duration: 0, selected: opts.selected === 'main' }]
  const all = flatten(root)
  const codes = codesOf(all)
  const total = all.reduce((n, s) => n + s.members.length, 0)
  if (total > MEMBER_CAP) {
    const each = Math.max(1, Math.floor(MEMBER_CAP / all.length))
    for (const s of all) if (s.members.length > each) {
      // Running members are kept first, then the rest in the stable order; drawn in it.
      const keep = new Set([...s.members.filter(m => m.status === 'running'), ...s.members.filter(m => m.status !== 'running')].slice(0, each - 1))
      s.hidden = s.members.filter(m => !keep.has(m))
      s.moreRunning = s.hidden.filter(m => m.status === 'running').length
      s.moreFailed = s.hidden.filter(m => stateKind(m.status, m.badge) === 'failed').length
      s.members = s.members.filter(m => keep.has(m))
    }
  }

  const rolled = new Map<Struct, Roll>()
  const roll = (s: Struct): Roll => {
    const known = rolled.get(s)
    if (known !== undefined) return known
    const parts = [...s.members, ...s.hidden].map(m => memberRoll(m, opts.now)).concat(s.kids.map(roll))
    let out: Roll
    if (parts.length > 0) {
      const added = sum(parts)
      out = { ...added, tokens: added.tokens + (s.node.kind === 'agent' ? s.node.row?.tokens ?? 0 : 0) }
    } else if (s.node.kind === 'main') {
      out = { done: s.node.progress.done, total: s.node.progress.total, tokens: 0, duration: 0 }
    } else {
      const own = memberRoll({ key: s.node.key, label: s.node.name, status: s.node.status, isActive: s.node.isActive, startedAt: s.node.startedAt, endedAt: s.node.endedAt, row: s.node.row }, opts.now)
      out = own
    }
    if (s.node.startedAt !== undefined) out.duration = span(s.node.startedAt, s.node.endedAt, opts.now)
    rolled.set(s, out)
    return out
  }

  const out: Arc[] = []
  const place = (s: Struct, from: number, to: number, parent: string | undefined) => {
    const r = roll(s)
    const key = s.node.key
    out.push({
      key,
      depth: s.node.depth,
      start: from,
      end: to,
      tone: stateTone(s.node.status, s.node.badge),
      status: s.node.status,
      label: clip(`${s.node.name} — ${wordOf(s.node.status, s.node.badge)}`),
      name: clip(s.node.name),
      code: clip(codes.get(key) ?? ''),
      glyph: stateGlyph(s.node.status, s.node.badge),
      kind: 'session',
      parent,
      badge: s.node.badge,
      ...(s.node.kind === 'agent' ? { agent: true } : {}),
      progress: { done: r.done, total: r.total },
      tokens: r.tokens,
      duration: r.duration,
      selected: opts.selected === key,
    })
    const count = s.members.length + (s.hidden.length > 0 ? 1 : 0) + s.kids.length
    if (count === 0) return
    const share = (to - from) / count
    let at = 0
    for (const member of s.members) {
      const m = memberRoll(member, opts.now)
      out.push({
        key: member.key,
        depth: s.node.depth + 1,
        start: from + at * share,
        end: from + (at + 1) * share,
        tone: stateTone(member.status, member.badge),
        status: member.status,
        label: clip(`${member.label} — ${wordOf(member.status, member.badge)}`),
        name: clip(member.label),
        code: clip(codes.get(member.key) ?? ''),
        glyph: stateGlyph(member.status, member.badge),
        kind: 'member',
        parent: key,
        badge: member.badge,
        progress: { done: m.done, total: m.total },
        tokens: m.tokens,
        duration: m.duration,
        selected: opts.selected === member.key,
      })
      at++
    }
    if (s.hidden.length > 0) {
      const h = sum(s.hidden.map(m => memberRoll(m, opts.now)))
      const status = s.moreFailed > 0 ? 'failed' : s.moreRunning > 0 ? 'running' : 'completed'
      const moreKey = `${key}+more`
      out.push({ key: moreKey, depth: s.node.depth + 1, start: from + at * share, end: from + (at + 1) * share, tone: stateTone(status), status, label: `+${s.hidden.length} more`, name: `+${s.hidden.length} MORE`, code: `+${s.hidden.length}`, glyph: stateGlyph(status), kind: 'member', parent: key, progress: { done: h.done, total: h.total }, tokens: h.tokens, duration: h.duration, selected: opts.selected === moreKey, hidden: { count: s.hidden.length, running: s.moreRunning, failed: s.moreFailed } })
      at++
    }
    for (const kid of s.kids) {
      place(kid, from + at * share, from + (at + 1) * share, key)
      at++
    }
  }
  place(root, 0, 1, undefined)

  return out
}

/** An arc's roll-up and place for the KPI row and the selected-element panel: steps, tokens, time, direct children (a "+N" counts N), state, label, name, code, glyph, tone and its path of names from the centre. */
export const rollupOf = (list: readonly Arc[], key: string) => {
  const arc = list.find(a => a.key === key)
  if (arc === undefined) return undefined
  const path: string[] = []
  for (let at: Arc | undefined = arc; at !== undefined; at = at.parent === undefined ? undefined : list.find(a => a.key === at!.parent)) path.unshift(at.name)
  const children = list.reduce((n, a) => n + (a.parent !== key ? 0 : a.hidden ? a.hidden.count : 1), 0)
  return { done: arc.progress.done, total: arc.progress.total, tokens: arc.tokens, duration: arc.duration, children, status: arc.status, label: arc.label, name: arc.name, code: arc.code, glyph: arc.glyph, tone: arc.tone, path: path.join(' / ') }
}

const TAU = Math.PI * 2
/** The most an SVG source may be. */
const SVG_MAX = 131072
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (value: number) => (Math.round(value * 100) / 100).toString()

const rings = (list: readonly Arc[]) => Math.max(0, ...list.map(arc => arc.depth))

/** The agents the arcs stand for, a capped session's "+N" arc counting its hidden members and not itself. */
export const chartAgents = (list: readonly Arc[]) => list.reduce((sum, arc) => sum + (arc.kind !== 'member' ? (arc.agent ? 1 : 0) : arc.hidden ? arc.hidden.count : 1), 0)
/** How many of them run now, hidden ones included. */
export const chartRunning = (list: readonly Arc[]) => list.reduce((sum, arc) => sum + (arc.kind !== 'member' ? 0 : arc.hidden ? arc.hidden.running : arc.status === 'running' ? 1 : 0), 0)

/** How many of them failed, hidden ones included. */
export const chartFailed = (list: readonly Arc[]) => list.reduce((sum, arc) => sum + (arc.kind !== 'member' ? (arc.agent && stateKind(arc.status, arc.badge) === 'failed' ? 1 : 0) : arc.hidden ? arc.hidden.failed : stateKind(arc.status, arc.badge) === 'failed' ? 1 : 0), 0)

const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const luminance = (hex: string) => { const v = parseInt(hex.slice(1), 16); return 0.2126 * channel((v >> 16) & 255) + 0.7152 * channel((v >> 8) & 255) + 0.0722 * channel(v & 255) }
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
const mix = (top: string, under: string, alpha: number) => {
  const a = parseInt(top.slice(1), 16)
  const b = parseInt(under.slice(1), 16)
  const at = (shift: number) => Math.round(((a >> shift) & 255) * alpha + ((b >> shift) & 255) * (1 - alpha))
  return `#${((at(16) << 16) | (at(8) << 8) | at(0)).toString(16).padStart(6, '0')}`
}
/** The ink for text on a sector filled `fill` at `opacity` over the page's `bg`: whichever of `bg` and `text-1` reads better against the composited fill. */
export const inkOn = (theme: ThemeId, fill: Token, opacity: number): string => {
  const colors = TOKENS[theme]
  const under = luminance(mix(colors[fill], colors.bg, opacity))
  return contrast(luminance(colors.bg), under) >= contrast(luminance(colors['text-1']), under) ? colors.bg : colors['text-1']
}

/** An arc's state as drawn: running solid, waiting outlined, ended dimmed; the centre disc is never dimmed. */
const stateOf = (arc: Arc) => {
  if (arc.depth === 0) return 'run'
  const kind = stateKind(arc.status, arc.badge)
  return kind === 'running' ? 'run' : kind === 'queued' ? 'wait' : 'end'
}

const isSelected = (arc: Arc, opts: Opts) => arc.selected === true || opts.selected === arc.key

/** An annular sector's path; a full turn is two halves, a ring with a hole. */
const sector = (cx: number, cy: number, inner: number, outer: number, start: number, end: number) => {
  const point = (radius: number, turn: number) => `${n(cx + radius * Math.cos(turn * TAU - Math.PI / 2))} ${n(cy + radius * Math.sin(turn * TAU - Math.PI / 2))}`
  const circle = (radius: number) => `M${n(cx + radius)} ${n(cy)}A${n(radius)} ${n(radius)} 0 1 1 ${n(cx - radius)} ${n(cy)}A${n(radius)} ${n(radius)} 0 1 1 ${n(cx + radius)} ${n(cy)}Z`
  if (end - start >= 0.9999) return inner > 0 ? `${circle(outer)}${circle(inner)}` : circle(outer)
  const large = end - start > 0.5 ? 1 : 0
  const head = `M${point(outer, start)}A${n(outer)} ${n(outer)} 0 ${large} 1 ${point(outer, end)}`
  return inner > 0 ? `${head}L${point(inner, end)}A${n(inner)} ${n(inner)} 0 ${large} 0 ${point(inner, start)}Z` : `${head}L${n(cx)} ${n(cy)}Z`
}

/** An open arc line at one radius, for a track or a progress arc; a full turn is two halves. */
const line = (cx: number, cy: number, radius: number, start: number, end: number) => {
  const point = (turn: number) => `${n(cx + radius * Math.cos(turn * TAU - Math.PI / 2))} ${n(cy + radius * Math.sin(turn * TAU - Math.PI / 2))}`
  if (end - start >= 0.9999) return `M${n(cx + radius)} ${n(cy)}A${n(radius)} ${n(radius)} 0 1 1 ${n(cx - radius)} ${n(cy)}A${n(radius)} ${n(radius)} 0 1 1 ${n(cx + radius)} ${n(cy)}`
  return `M${point(start)}A${n(radius)} ${n(radius)} 0 ${end - start > 0.5 ? 1 : 0} 1 ${point(end)}`
}

/** The text that fits `room` pixels at `charWidth` each, cut with an ellipsis; none when fewer than three characters fit. */
const fit = (text: string, room: number, charWidth: number) => {
  const chars = Array.from(text)
  const fits = Math.floor(room / charWidth)
  return fits < 3 ? '' : chars.length <= fits ? text : `${chars.slice(0, fits - 1).join('')}…`
}

const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const text = (x: number, y: number, size: number, fill: string, body: string, extra = '') =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" font-size="${n(size)}" fill="${fill}"${extra}>${body}</text>`

/**
 * The sunburst as an `<svg>`: the centre disc says this session's state,
 * steps and time; each ring sector is filled by state, with a progress arc on
 * a track just outside it, its name and steps inside when they fit, and a
 * pulsing glyph outside a failed or blocked one; a `<title>` each.
 */
export const sunburstSvg = (list: readonly Arc[], size: number, theme: ThemeId, opts: Opts = {}): string => {
  const colors = TOKENS[theme]
  const half = size / 2
  // Every length below scales with the chart (300 is the size the numbers were tuned at); a font keeps a floor in real pixels.
  const k = size / 300
  const count = rings(list)
  const outer = half - 2 * k - (count === 0 ? 0 : 12 * k)
  const core = count === 0 ? outer * 0.6 : outer * 0.38
  const width = count === 0 ? 0 : (outer - core) / count
  const room = Math.max(5 * k, Math.min(12 * k, width * 0.3))
  const gap = 1.5 * k
  const fontPx = Math.max(7, 7.5 * k)
  const charW = fontPx * 0.64
  const glyphPx = Math.max(7, 8 * k)
  const draw = (rich: boolean) => {
    const parts: string[] = []
    const extras: string[] = []
    for (const arc of list) {
      const tone = colors[arc.tone]
      const state = stateOf(arc)
      const kind = stateKind(arc.status, arc.badge)
      const chosen = isSelected(arc, opts)
      // The selection and a waiting outline keep a visible floor on a small chart; the selection stays the widest stroke.
      const stroke = chosen ? ` stroke="${colors.white}" stroke-width="${n(Math.max(1.5, 2 * k))}"` : state === 'wait' ? ` stroke="${tone}" stroke-width="${n(Math.max(1, 1.5 * k))}"` : arc.depth === 0 ? ` stroke="${tone}" stroke-width="${n(1.5 * k)}"` : ''
      const title = `<title>${esc(`${arc.code === '' || arc.name.startsWith(`${arc.code} ·`) ? '' : `${arc.code} · `}${arc.name.toUpperCase()} — ${wordOf(arc.status, arc.badge)} · ${arc.progress.done}/${arc.progress.total} STEPS · ${hms(arc.duration)} · ${tokensText(arc.tokens)} TOK`)}</title>`
      const inner = arc.depth === 0 ? 0 : core + (arc.depth - 1) * width + (arc.depth === 1 ? 3 * k : 0)
      const out = arc.depth === 0 ? core : core + arc.depth * width - room
      const pad = arc.depth === 0 || arc.end - arc.start >= 0.9999 ? 0 : Math.min((gap / 2 / Math.max(1, (inner + out) / 2)) / TAU, (arc.end - arc.start) / 4)
      const from = arc.start + pad
      const to = arc.end - pad
      const fill = arc.depth === 0 ? colors.raised : tone
      const opacity = arc.depth === 0 ? '' : state === 'wait' ? ' fill-opacity="0"' : state === 'run' ? ' fill-opacity="0.85"' : ' fill-opacity="0.5"'
      parts.push(`<path d="${sector(half, half, inner, out, from, to)}" fill="${fill}"${opacity}${stroke} fill-rule="evenodd">${rich ? title : ''}</path>`)
      if (arc.depth === 0) continue

      // The track and the progress arc, just outside the sector.
      const track = out + 2.5 * k
      extras.push(`<path d="${line(half, half, track, from, to)}" fill="none" stroke="${colors.line}" stroke-width="${n(3 * k)}"/>`)
      const fraction = arc.progress.total > 0 ? Math.min(1, arc.progress.done / arc.progress.total) : 0
      if (fraction > 0) extras.push(`<path d="${line(half, half, track, from, from + (to - from) * fraction)}" fill="none" stroke="${tone}" stroke-width="${n(3 * k)}"/>`)
      if (!rich) continue

      // The name and steps inside, when the sector has room at its middle.
      const mid = (arc.start + arc.end) / 2
      const phi = mid * TAU
      const radius = (inner + out) / 2
      const thick = out - inner
      const arcLen = (arc.end - arc.start) * TAU * radius
      const across = Math.abs(Math.cos(phi)) * arcLen + Math.abs(Math.sin(phi)) * thick
      const high = Math.abs(Math.sin(phi)) * arcLen + Math.abs(Math.cos(phi)) * thick
      if (high >= 20 * k && across >= 22 * k) {
        const label = arc.code === '' ? fit(arc.name.toUpperCase(), across - 6 * k, charW) : arc.code.length * charW <= across - 6 * k ? arc.code : ''
        if (label !== '') {
          const ink = state === 'wait' ? colors['text-2'] : inkOn(theme, arc.tone, state === 'run' ? 0.85 : 0.5)
          const cx = half + radius * Math.sin(phi)
          const cy = half - radius * Math.cos(phi)
          extras.push(text(cx, cy - fontPx * 0.6, fontPx, ink, esc(label)) + text(cx, cy + fontPx * 0.6, fontPx, ink, `${arc.progress.done}/${arc.progress.total}`))
        }
      }
      // A failed or blocked sector gets a static glyph outside it; a running one a ● that pulses, the only motion there is.
      if (kind === 'failed' || kind === 'blocked' || kind === 'running') {
        const glyphAt = out + room * 0.75
        const pulse = kind === 'running' ? '<animate attributeName="opacity" values="1;0.35;1" dur="1.5s" repeatCount="indefinite"/>' : ''
        extras.push(`<text x="${n(half + glyphAt * Math.sin(phi))}" y="${n(half - glyphAt * Math.cos(phi))}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" font-size="${n(glyphPx)}" fill="${tone}" stroke="${colors.bg}" stroke-width="${n(2 * k)}" paint-order="stroke">${arc.glyph}${pulse}</text>`)
      }
    }

    // The centre: this session's state, steps and time.
    const centre = list.find(arc => arc.depth === 0)
    if (centre !== undefined) {
      // Never smaller than 7px (the count 9px); under 40px of core the THIS SESSION line goes.
      const fs = core * 0.15
      const small = Math.max(7, fs * 1.1)
      const tone = colors[centre.tone]
      const steps = `${centre.progress.done}/${centre.progress.total}`
      const titled = core >= 40
      const lines = [
        titled ? text(half, half - core * 0.42, Math.max(7, fs * 0.85), colors['text-3'], 'THIS SESSION', ' letter-spacing="1"') : '',
        text(half, half - core * (titled ? 0.14 : 0.36), small, tone, `${centre.glyph} ${esc(wordOf(centre.status, centre.badge))}`),
        text(half, half + core * (titled ? 0.17 : 0.02), Math.max(9, fs * 1.8), colors['text-1'], `${steps}<tspan font-size="${n(Math.max(7, fs * 0.85))}" fill="${colors['text-3']}"> STEPS</tspan>`),
        text(half, half + core * (titled ? 0.46 : 0.4), small, colors['text-2'], hms(centre.duration)),
      ]
      extras.push(...lines)
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" width="${n(size)}" height="${n(size)}">${parts.join('')}${extras.join('')}</svg>`
  }
  const full = draw(true)
  if (full.length <= SVG_MAX) return full
  const bare = draw(false)
  if (bare.length <= SVG_MAX) return bare

  // Still too long: a summary, the centre disc and the running count.
  const summary = `<circle cx="${n(half)}" cy="${n(half)}" r="${n(core)}" fill="${colors[list[0]?.tone ?? 'cyan']}"/><text x="${n(half)}" y="${n(half)}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="${n(core * 0.9)}" fill="${colors['text-1']}">${chartRunning(list)}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" width="${n(size)}" height="${n(size)}">${summary}</svg>`
}

const BRAILLE = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
] as const

const rgb = (hex: string) => parseInt(hex.slice(1), 16)

/**
 * The sunburst as a `Raster`'s `cells`: `columns * rows` little-endian u32
 * triplets `[code point, foreground, background]`, in braille (2×4 dots a
 * cell; a cell is about twice as tall as wide, so a dot is square and the
 * chart round). Each ring sector keeps a dot row outside it for its progress,
 * set only over the done fraction; a waiting arc is its boundary only, an
 * ended one a sparser checker of dots, the selected one at full density; a
 * cell takes the colour of the arc most of its dots belong to (its state's
 * token); an empty cell is a space, default colours.
 */
export const sunburstCells = (list: readonly Arc[], columns: number, rows: number, theme: ThemeId, opts: Opts = {}): string => {
  const colors = TOKENS[theme]
  const wide = columns * 2
  const tall = rows * 4
  const radius = Math.min(wide, tall) / 2
  const count = rings(list)
  const core = count === 0 ? radius * 0.6 : radius * 0.3
  const step = count === 0 ? 1 : (radius - core) / count
  // A dot row for progress outside each sector, when a ring is wide enough to spare it.
  const band = step >= 3 ? 1.2 : 0
  const byRing: Arc[][] = Array.from({ length: count + 1 }, () => [])
  list.forEach(arc => byRing[arc.depth]?.push(arc))

  // The arc a point of the dot grid lies in (its body, or its progress row), or undefined outside the chart.
  const at = (x: number, y: number): { arc: Arc; band: boolean } | undefined => {
    const dx = x - wide / 2
    const dy = y - tall / 2
    const r = Math.hypot(dx, dy)
    if (r >= radius || (count === 0 && r >= core)) return undefined
    const ring = r < core ? 0 : Math.min(count, 1 + Math.floor((r - core) / step))
    const turn = (((Math.atan2(dy, dx) + Math.PI / 2) / TAU) % 1 + 1) % 1
    const arc = byRing[ring]?.find(a => turn >= a.start && (turn < a.end || a.end >= 1))
    if (arc === undefined) return undefined
    if (ring === 0 || band === 0 || r - core - (ring - 1) * step < step - band) return { arc, band: false }
    const fraction = arc.progress.total > 0 ? Math.min(1, arc.progress.done / arc.progress.total) : 0

    return turn < arc.start + (arc.end - arc.start) * fraction ? { arc, band: true } : undefined
  }

  const words = new Uint32Array(columns * rows * 3)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let bits = 0
      const votes = new Map<Arc, number>()
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
          const x = column * 2 + i + 0.5
          const y = row * 4 + j + 0.5
          const hit = at(x, y)
          if (hit === undefined) continue
          const arc = hit.arc
          if (!hit.band && !isSelected(arc, opts)) {
            // A waiting arc is outlined: a dot with the same arc on all four sides is inside it.
            if (stateOf(arc) === 'wait' && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => { const o = at(x + a!, y + b!); return o !== undefined && o.arc === arc && !o.band })) continue
            // An ended arc is a checker of its dots, so it reads dimmed.
            if (stateOf(arc) === 'end' && (i + j) % 2 === 1) continue
          }
          bits |= BRAILLE[i]![j]!
          votes.set(arc, (votes.get(arc) ?? 0) + 1)
        }
      }
      const cell = (row * columns + column) * 3
      let best: Arc | undefined
      for (const [arc, v] of votes) if (best === undefined || v > votes.get(best)!) best = arc
      words[cell] = bits === 0 ? 0x20 : 0x2800 + bits
      words[cell + 1] = best === undefined ? 0x01000000 : rgb(colors[best.tone])
      words[cell + 2] = 0x01000000
    }
  }

  // Little-endian whatever the host's order, then standard padded base64.
  const bytes = new Uint8Array(words.length * 4)
  const view = new DataView(bytes.buffer)
  words.forEach((word, index) => view.setUint32(index * 4, word, true))
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))

  return btoa(binary)
}
