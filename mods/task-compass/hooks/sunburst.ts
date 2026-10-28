// The Sessions tree as a sunburst (TASK-0198): pure geometry and drawing, no
// `$`. `arcs` lays the tree out in turns (0..1) with one equal share per leaf;
// `sunburstSvg` draws it for the surfaces that carry `Svg`; `sunburstCells`
// rasterises it into braille cells for the terminal's `Raster`.
import { isActive, toneToken } from './sessions'
import type { Member, SessionNode } from './sessions'
import { TOKENS } from './sigma'
import type { ThemeId, Token } from './sigma'

export type Arc = {
  key: string
  /** The ring: 0 is the centre disc (this session), 1 the first ring out. */
  depth: number
  /** Turns from the top, clockwise: 0 to 1. */
  start: number
  end: number
  tone: Token
  status: string
  label: string
  kind: 'session' | 'member'
  badge?: { status: string; word: string }
  /** The "+N" arc of a capped session: how many members it stands for, and how many of them run. */
  hidden?: { count: number; running: number }
}

/** Members drawn in all; past it each session's rest is one "+N" arc. */
const MEMBER_CAP = 160
const LABEL_MAX = 90

type Struct = { node: SessionNode; members: Member[]; kids: Struct[]; more: number; moreRunning: number }

/** A stable order: ledger tasks by id, then agents by start; a status change moves none. */
const stable = (members: Member[]) =>
  members.slice().sort((a, b) => {
    if ((a.taskId !== undefined) !== (b.taskId !== undefined)) return a.taskId !== undefined ? -1 : 1
    if (a.taskId !== undefined && b.taskId !== undefined) return a.taskId.localeCompare(b.taskId, undefined, { numeric: true })
    return (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity) || a.key.localeCompare(b.key)
  })

/** A label as text: XML-illegal control characters out, cut by code points so a surrogate pair is never split. */
const clip = (text: string) => Array.from(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')).slice(0, LABEL_MAX).join('')

const wordOf = (status: string, badge?: { word: string }) => (badge?.word ?? status).toUpperCase()

/** The tree's flat, depth-first list as a hierarchy. */
const nest = (tree: readonly SessionNode[]): Struct | undefined => {
  if (tree.length === 0) return undefined
  let at = 0
  const take = (): Struct => {
    const node = tree[at++]!
    const out: Struct = { node, members: stable([...node.running, ...node.completed]), kids: [], more: 0, moreRunning: 0 }
    while (at < tree.length && tree[at]!.depth > node.depth) out.kids.push(take())
    // Sub-sessions by start then key, so one ending or another starting moves no arc.
    out.kids.sort((a, b) => (a.node.startedAt ?? Infinity) - (b.node.startedAt ?? Infinity) || a.node.key.localeCompare(b.node.key))
    return out
  }
  return take()
}

const flatten = (s: Struct): Struct[] => [s, ...s.kids.flatMap(flatten)]
const leavesOf = (s: Struct): number => {
  const n = s.members.length + (s.more > 0 ? 1 : 0) + s.kids.reduce((sum, kid) => sum + leavesOf(kid), 0)
  return n === 0 && s.node.kind !== 'main' ? 1 : n
}

/**
 * The sunburst's arcs, in the tree's order. The centre disc is this session;
 * a session at tree depth d is an arc on ring d, its members on ring d+1; each
 * leaf takes one equal share of the turn and a session spans its leaves.
 */
export const arcs = (tree: readonly SessionNode[], tones: Record<string, number>): Arc[] => {
  const root = nest(tree)
  if (root === undefined) return [{ key: 'main', depth: 0, start: 0, end: 1, tone: toneToken(tones, 'main'), status: 'completed', label: 'THIS SESSION', kind: 'session' }]
  const all = flatten(root)
  const total = all.reduce((sum, s) => sum + s.members.length, 0)
  if (total > MEMBER_CAP) {
    const each = Math.max(1, Math.floor(MEMBER_CAP / all.length))
    for (const s of all) if (s.members.length > each) {
      // Running members are kept first, then the rest in the stable order; drawn in it.
      const keep = new Set([...s.members.filter(m => m.status === 'running'), ...s.members.filter(m => m.status !== 'running')].slice(0, each - 1))
      const hidden = s.members.filter(m => !keep.has(m))
      s.more = hidden.length
      s.moreRunning = hidden.filter(m => m.status === 'running').length
      s.members = s.members.filter(m => keep.has(m))
    }
  }

  const out: Arc[] = []
  const count = leavesOf(root)
  const unit = count > 0 ? count : 1
  const place = (s: Struct, first: number) => {
    const span = leavesOf(s)
    const tone = toneToken(tones, s.node.key)
    const from = first / unit
    const to = count > 0 ? (first + span) / unit : 1
    out.push({
      key: s.node.key,
      depth: s.node.depth,
      start: s.node.kind === 'main' ? 0 : from,
      end: s.node.kind === 'main' ? 1 : to,
      tone,
      status: s.node.status,
      label: clip(`${s.node.name} — ${wordOf(s.node.status, s.node.badge)}`),
      kind: 'session',
      badge: s.node.badge,
    })
    let cursor = first
    for (const member of s.members) {
      out.push({
        key: member.key,
        depth: s.node.depth + 1,
        start: cursor / unit,
        end: (cursor + 1) / unit,
        tone,
        status: member.status,
        label: clip(`${member.label} — ${wordOf(member.status, member.badge)}`),
        kind: 'member',
        badge: member.badge,
      })
      cursor++
    }
    if (s.more > 0) {
      out.push({ key: `${s.node.key}+more`, depth: s.node.depth + 1, start: cursor / unit, end: (cursor + 1) / unit, tone, status: s.moreRunning > 0 ? 'running' : 'completed', label: `+${s.more} more`, kind: 'member', hidden: { count: s.more, running: s.moreRunning } })
      cursor++
    }
    for (const kid of s.kids) {
      place(kid, cursor)
      cursor += leavesOf(kid)
    }
  }
  place(root, 0)

  return out
}

const TAU = Math.PI * 2
/** The most an SVG source may be. */
const SVG_MAX = 131072
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (value: number) => (Math.round(value * 100) / 100).toString()

const rings = (list: readonly Arc[]) => Math.max(0, ...list.map(arc => arc.depth))

/** The agents the arcs stand for, a capped session's "+N" arc counting its hidden members and not itself. */
export const chartAgents = (list: readonly Arc[]) => list.reduce((sum, arc) => sum + (arc.kind !== 'member' ? 0 : arc.hidden ? arc.hidden.count : 1), 0)
/** How many of them run now, hidden ones included. */
export const chartRunning = (list: readonly Arc[]) => list.reduce((sum, arc) => sum + (arc.kind !== 'member' ? 0 : arc.hidden ? arc.hidden.running : arc.status === 'running' ? 1 : 0), 0)

/** An arc's state as drawn: running solid, waiting outlined, ended dimmed; the centre disc is never dimmed. */
const stateOf = (arc: Arc) => (arc.depth === 0 ? 'run' : arc.status === 'running' ? 'run' : isActive(arc.status) ? 'wait' : 'end')

/** An annular sector's path; a full turn is two halves, a ring with a hole. */
const sector = (cx: number, cy: number, inner: number, outer: number, start: number, end: number) => {
  const point = (radius: number, turn: number) => `${n(cx + radius * Math.cos(turn * TAU - Math.PI / 2))} ${n(cy + radius * Math.sin(turn * TAU - Math.PI / 2))}`
  const circle = (radius: number) => `M${n(cx + radius)} ${n(cy)}A${n(radius)} ${n(radius)} 0 1 1 ${n(cx - radius)} ${n(cy)}A${n(radius)} ${n(radius)} 0 1 1 ${n(cx + radius)} ${n(cy)}Z`
  if (end - start >= 0.9999) return inner > 0 ? `${circle(outer)}${circle(inner)}` : circle(outer)
  const large = end - start > 0.5 ? 1 : 0
  const head = `M${point(outer, start)}A${n(outer)} ${n(outer)} 0 ${large} 1 ${point(outer, end)}`
  return inner > 0 ? `${head}L${point(inner, end)}A${n(inner)} ${n(inner)} 0 ${large} 0 ${point(inner, start)}Z` : `${head}L${n(cx)} ${n(cy)}Z`
}

/** The sunburst as an `<svg>`: one path per arc, a `<title>` each, the running count at the centre. */
export const sunburstSvg = (list: readonly Arc[], size: number, theme: ThemeId): string => {
  const colors = TOKENS[theme]
  const half = size / 2
  const outer = half - 2
  const count = rings(list)
  const core = count === 0 ? outer * 0.6 : outer * 0.22
  const width = count === 0 ? 0 : (outer - core) / count
  const gap = 1.5
  const draw = (withTitles: boolean) => {
    const paths = list.map(arc => {
      const tone = colors[arc.tone]
      const state = stateOf(arc)
      const stroke = arc.badge?.status === 'critical' ? colors.red : arc.badge?.status === 'caution' ? colors.amber : state === 'wait' ? tone : undefined
      const inner = arc.depth === 0 ? 0 : core + (arc.depth - 1) * width + gap / 2
      const out = arc.depth === 0 ? core - gap / 2 : core + arc.depth * width - gap / 2
      const pad = arc.depth === 0 || arc.end - arc.start >= 0.9999 ? 0 : Math.min((gap / 2 / Math.max(1, (inner + out) / 2)) / TAU, (arc.end - arc.start) / 4)
      const d = sector(half, half, inner, out, arc.start + pad, arc.end - pad)
      // A waiting arc keeps a fill of no opacity, so its <title> is still hoverable.
      const opacity = state === 'end' ? ' fill-opacity="0.45"' : state === 'wait' ? ' fill-opacity="0"' : ''
      const line = stroke === undefined ? '' : ` stroke="${stroke}" stroke-width="1.5"`
      const title = withTitles ? `<title>${esc(arc.label)}</title>` : ''
      return `<path d="${d}" fill="${tone}"${opacity}${line} fill-rule="evenodd">${title}</path>`
    })
    const running = chartRunning(list)
    const label = `<text x="${n(half)}" y="${n(half)}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="${n(core * 0.9)}" fill="${colors['text-1']}">${running}</text>`

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" width="${n(size)}" height="${n(size)}">${paths.join('')}${label}</svg>`
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
 * chart round). A waiting arc is its boundary only, an ended one a sparser
 * checker of dots; a cell takes the colour of the arc most of its dots belong
 * to (red for a critical badge, amber for caution, else its tone); an empty cell is a space, default colours.
 */
export const sunburstCells = (list: readonly Arc[], columns: number, rows: number, theme: ThemeId): string => {
  const colors = TOKENS[theme]
  const wide = columns * 2
  const tall = rows * 4
  const radius = Math.min(wide, tall) / 2
  const count = rings(list)
  const core = count === 0 ? radius * 0.6 : radius * 0.22
  const step = count === 0 ? 1 : (radius - core) / count
  const byRing: Arc[][] = Array.from({ length: count + 1 }, () => [])
  list.forEach(arc => byRing[arc.depth]?.push(arc))

  // The arc a point of the dot grid lies in, or undefined outside the chart.
  const at = (x: number, y: number): Arc | undefined => {
    const dx = x - wide / 2
    const dy = y - tall / 2
    const r = Math.hypot(dx, dy)
    if (r >= radius || (count === 0 && r >= core)) return undefined
    const ring = r < core ? 0 : Math.min(count, 1 + Math.floor((r - core) / step))
    const turn = (((Math.atan2(dy, dx) + Math.PI / 2) / TAU) % 1 + 1) % 1
    return byRing[ring]?.find(arc => turn >= arc.start && (turn < arc.end || arc.end >= 1))
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
          const arc = at(x, y)
          if (arc === undefined) continue
          // A waiting arc is outlined: a dot with the same arc on all four sides is inside it.
          if (stateOf(arc) === 'wait' && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => at(x + a!, y + b!) === arc)) continue
          // An ended arc is a checker of its dots, so it reads dimmed.
          if (stateOf(arc) === 'end' && (i + j) % 2 === 1) continue
          bits |= BRAILLE[i]![j]!
          votes.set(arc, (votes.get(arc) ?? 0) + 1)
        }
      }
      const cell = (row * columns + column) * 3
      let best: Arc | undefined
      for (const [arc, v] of votes) if (best === undefined || v > votes.get(best)!) best = arc
      words[cell] = bits === 0 ? 0x20 : 0x2800 + bits
      words[cell + 1] = best === undefined ? 0x01000000 : rgb(colors[best.badge?.status === 'critical' ? 'red' : best.badge?.status === 'caution' ? 'amber' : best.tone])
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
