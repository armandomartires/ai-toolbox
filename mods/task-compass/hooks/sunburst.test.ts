import { expect, test } from 'claude-code/testing'

import { agentKey, runKey, sessionTree } from './sessions'
import type { AgentRow, OrchTask } from './sessions'
import { TOKENS } from './sigma'
import { arcs, chartAgents, chartRunning, sunburstCells, sunburstSvg } from './sunburst'

const near = (a: number, b: number) => expect(Math.abs(a - b) < 1e-9).toBe(true)

const row = (id: string, status: string, more: Partial<AgentRow> = {}): AgentRow => ({
  id,
  type: 'Explore',
  description: id,
  status,
  startedAt: Number(id.replace(/\D/g, '')) || 0,
  calls: 0,
  tokens: 0,
  ...more,
})
const task = (id: string, status: OrchTask['status'], more: Partial<OrchTask> = {}): OrchTask => ({
  id,
  role: 'builder',
  objective: `do ${id}`,
  deps: [],
  status,
  requested: { model: 'sonnet', effort: 'medium' },
  createdAt: 0,
  ...more,
})

const build = (rows: AgentRow[], ledger: OrchTask[] = [], runs: { id: string; name: string; startedAt: number }[] = []) => {
  const tones: Record<string, number> = {}
  ledger.length > 0 && (tones.orch = 1)
  runs.forEach((run, i) => (tones[runKey(run.id)] = i + 2))
  const tree = sessionTree({ rows, runs, tones, tasks: [], ledger })
  return { tree, tones, list: arcs(tree, tones) }
}

// this session: a1, a2 (members); ORCH with T1, T2, T3; a run with b1 (running)
const sample = () =>
  build(
    [row('a1', 'running'), row('a2', 'completed'), row('b1', 'running', { runId: 'r1' })],
    [task('T1', 'completed'), task('T2', 'running', { agentId: 'w2' }), task('T3', 'queued', { deps: ['T2'] })],
    [{ id: 'r1', name: 'review', startedAt: 10 }],
  )

test('every leaf takes one equal share and the shares sum to a full turn', () => {
  const { list } = sample()
  const members = list.filter(arc => arc.kind === 'member')
  expect(members).toHaveLength(6)
  const share = 1 / 6
  for (const arc of members) near(arc.end - arc.start, share)
  const sorted = members.slice().sort((a, b) => a.start - b.start)
  expect(sorted[0]!.start).toBe(0)
  near(sorted[sorted.length - 1]!.end, 1)
  sorted.slice(1).forEach((arc, i) => near(arc.start, sorted[i]!.end))
})

test('a session\'s arc spans exactly its leaves, and sits one ring in from its members', () => {
  const { list } = sample()
  const by = (key: string) => list.find(arc => arc.key === key)!
  const orch = by('orch')
  const orchMembers = list.filter(arc => arc.key.startsWith('task-'))
  expect(orch.depth).toBe(1)
  expect(orchMembers.every(arc => arc.depth === 2)).toBe(true)
  near(orch.start, Math.min(...orchMembers.map(arc => arc.start)))
  near(orch.end, Math.max(...orchMembers.map(arc => arc.end)))
  const run = by(runKey('r1'))
  expect([run.depth, by('b1').depth]).toEqual([1, 2])
  near(run.end - run.start, 1 / 6)
  // The centre is this session, a full disc; its own members are on ring 1.
  expect(by('main')).toMatchObject({ depth: 0, start: 0, end: 1 })
  expect(by('a1').depth).toBe(1)
  // Sessions keep their own tone, members take their session's.
  expect(by('task-T1').tone).toBe(orch.tone)
  expect(by('a1').tone).toBe('cyan')
  expect(orch.tone).toBe('violet')
})

test('a nested session sits on the next ring and its members beyond it', () => {
  const rows = [row('d1', 'running', { parentId: undefined }), row('d2', 'running', { parentId: 'd1' }), row('d3', 'running', { parentId: 'd2' })]
  const tones = { [agentKey('d1')]: 1, [agentKey('d2')]: 2 }
  const tree = sessionTree({ rows, runs: [], tones, tasks: [], ledger: [] })
  const list = arcs(tree, tones)
  const depth = (key: string) => list.find(arc => arc.key === key)!.depth
  expect([depth('main'), depth(agentKey('d1')), depth(agentKey('d2')), depth('d3')]).toEqual([0, 1, 2, 3])
  const d1 = list.find(arc => arc.key === agentKey('d1'))!
  expect([d1.start, d1.end]).toEqual([0, 1])
})

test('arcs keep their places when a member changes status', () => {
  const before = build([row('a1', 'running'), row('a2', 'running'), row('a3', 'running')]).list
  const after = build([row('a1', 'running'), row('a2', 'completed'), row('a3', 'running')]).list
  expect(after.map(arc => arc.key)).toEqual(before.map(arc => arc.key))
  expect(after.map(arc => [arc.start, arc.end])).toEqual(before.map(arc => [arc.start, arc.end]))
  expect(after.find(arc => arc.key === 'a2')!.status).toBe('completed')
})

test('an empty tree and a lone empty session draw just the centre disc', () => {
  expect(arcs([], {})).toHaveLength(1)
  const { list } = build([])
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({ depth: 0, start: 0, end: 1 })
  const svg = sunburstSvg(list, 120, 'dark')
  expect(svg.match(/<path /g)).toHaveLength(1)
  const cells = decode(sunburstCells(list, 18, 9, 'dark'))
  expect(cells.some(c => c.code !== 0x20)).toBe(true)
  expect(new Set(cells.filter(c => c.code !== 0x20).map(c => c.fg))).toEqual(new Set([parseInt(TOKENS.dark.cyan.slice(1), 16)]))
})

test('the SVG has one titled path per arc, in the tone, stroked by state', () => {
  const { list } = build(
    [row('a1', 'running'), row('a2', 'failed'), row('a3', 'pending'), row('a4', 'completed', { description: 'say <b> & "hi"' })],
    [task('T1', 'blocked')],
  )
  const svg = sunburstSvg(list, 240, 'dark')
  expect(svg.startsWith('<svg ')).toBe(true)
  expect(svg).toContain('viewBox="0 0 240 240"')
  expect(svg.match(/<path /g)).toHaveLength(list.length)
  expect(svg.match(/<title>/g)).toHaveLength(list.length)
  const paths = svg.match(/<path [^>]*>.*?<\/path>/g)!
  const of = (key: string) => paths[list.findIndex(arc => arc.key === key)]!
  const dark = TOKENS.dark
  expect(of('a1')).toContain(`fill="${dark.cyan}"`)
  expect(of('a1')).not.toContain('stroke=')
  expect(of('a1')).toContain('— RUNNING</title>')
  expect(of('a2')).toContain(`stroke="${dark.red}"`)
  expect(of('a3')).toContain('fill-opacity="0"')
  expect(of('a3')).toContain(`stroke="${dark.cyan}"`)
  expect(of('a4')).toContain('fill-opacity="0.45"')
  expect(of('a4')).toContain('say &lt;b&gt; &amp; &quot;hi&quot;')
  expect(of('task-T1')).toContain(`stroke="${dark.amber}"`)
  // The light theme draws the light hexes; the centre says how many run.
  expect(sunburstSvg(list, 240, 'light')).toContain(`fill="${TOKENS.light.cyan}"`)
  expect(svg).toMatch(/<text [^>]*>1<\/text>/)
})

test('a very long tree stays under the SVG limit and merges the rest', () => {
  const rows = Array.from({ length: 600 }, (_, i) => row(`m${i + 1}`, 'completed', { description: 'x'.repeat(120) }))
  const { list } = build(rows)
  expect(list.length).toBeLessThan(300)
  expect(list.some(arc => /^\+\d+ more$/.test(arc.label))).toBe(true)
  expect(sunburstSvg(list, 240, 'dark').length).toBeLessThan(131072)
})

type Cell = { code: number; fg: number; bg: number }
const decode = (base64: string): Cell[] => {
  const raw = atob(base64)
  const view = new DataView(Uint8Array.from(raw, ch => ch.charCodeAt(0)).buffer)
  return Array.from({ length: raw.length / 12 }, (_, i) => ({ code: view.getUint32(i * 12, true), fg: view.getUint32(i * 12 + 4, true), bg: view.getUint32(i * 12 + 8, true) }))
}

test('the braille cells are columns x rows triplets of a space or a braille pattern', () => {
  const { list } = sample()
  const encoded = sunburstCells(list, 18, 9, 'dark')
  expect(atob(encoded).length).toBe(18 * 9 * 12)
  const cells = decode(encoded)
  expect(cells.every(c => c.code === 0x20 || (c.code >= 0x2800 && c.code <= 0x28ff))).toBe(true)
  expect(cells.every(c => c.bg === 0x01000000)).toBe(true)
  expect(cells.filter(c => c.code !== 0x20).length).toBeGreaterThan(40)
  // The corner is outside the circle: a space in the default colours.
  expect(cells[0]).toEqual({ code: 0x20, fg: 0x01000000, bg: 0x01000000 })
})

test('a cell takes the tone of the arc covering most of its dots', () => {
  const { list } = build([row('a1', 'running'), row('a2', 'running')], [task('T1', 'running'), task('T2', 'running')])
  const cells = decode(sunburstCells(list, 18, 9, 'dark'))
  const colors = new Set(cells.filter(c => c.code !== 0x20).map(c => c.fg))
  const hex = (token: 'cyan' | 'violet') => parseInt(TOKENS.dark[token].slice(1), 16)
  expect(colors.has(hex('cyan'))).toBe(true)
  expect(colors.has(hex('violet'))).toBe(true)
  // Left half is the orchestrator's ledger (violet) or this session's (cyan), by tree order: the first leaves, this session's, start at the top going clockwise.
  const at = (column: number, row: number) => cells[row * 18 + column]!
  expect(at(14, 3).fg).toBe(hex('cyan'))
  expect(at(3, 3).fg).toBe(hex('violet'))
})

test('a waiting arc is only its outline in braille', () => {
  const dots = (cell: number) => cell.toString(2).split('1').length - 1
  const filled = decode(sunburstCells(build([row('a1', 'running')]).list, 18, 9, 'dark'))
  const waiting = decode(sunburstCells(build([row('a1', 'pending')]).list, 18, 9, 'dark'))
  const count = (cells: Cell[]) => cells.reduce((sum, c) => sum + (c.code === 0x20 ? 0 : dots(c.code - 0x2800)), 0)
  expect(count(waiting)).toBeLessThan(count(filled))
})

const hex = (token: 'cyan' | 'violet' | 'red' | 'amber') => parseInt(TOKENS.dark[token].slice(1), 16)
const dotsOf = (cells: Cell[]) => cells.reduce((sum, c) => sum + (c.code === 0x20 ? 0 : (c.code - 0x2800).toString(2).split('1').length - 1), 0)

test('braille shows state: red for a critical badge, amber for caution, sparser dots once ended', () => {
  const failed = decode(sunburstCells(build([row('a1', 'failed')]).list, 18, 9, 'dark'))
  expect(new Set(failed.filter(c => c.code !== 0x20).map(c => c.fg)).has(hex('red'))).toBe(true)
  const blocked = decode(sunburstCells(build([row('a1', 'running')], [task('T1', 'blocked')]).list, 18, 9, 'dark'))
  expect(blocked.some(c => c.code !== 0x20 && c.fg === hex('amber'))).toBe(true)
  const running = decode(sunburstCells(build([row('a1', 'running')]).list, 18, 9, 'dark'))
  const ended = decode(sunburstCells(build([row('a1', 'completed')]).list, 18, 9, 'dark'))
  expect(dotsOf(ended)).toBeLessThan(dotsOf(running))
  expect(running.every(c => c.code === 0x20 || c.fg === hex('cyan'))).toBe(true)
})

test('the centre disc is never dimmed', () => {
  const { list } = build([row('a1', 'completed')])
  expect(list[0]!.status).toBe('completed')
  const svg = sunburstSvg(list, 240, 'dark')
  expect(svg.match(/<path [^>]*>/g)![0]).not.toContain('fill-opacity')
  const cells = decode(sunburstCells(build([]).list, 18, 9, 'dark'))
  const lone = decode(sunburstCells(build([row('a1', 'running')]).list, 18, 9, 'dark'))
  expect(dotsOf(cells)).toBeGreaterThan(0)
  expect(lone.length).toBe(cells.length)
})

test('a session ending or another starting moves no existing arc', () => {
  const runs = [{ id: 'r1', name: 'one', startedAt: 10 }]
  const before = build([row('a1', 'running'), row('b1', 'running', { runId: 'r1' })], [], runs).list
  const after = build([row('a1', 'running'), row('b1', 'completed', { runId: 'r1' })], [], runs).list
  expect(after.map(arc => [arc.key, arc.start, arc.end])).toEqual(before.map(arc => [arc.key, arc.start, arc.end]))
  // A later session sorts after the earlier one, so the first keeps its turn's start.
  const two = build([row('a1', 'running'), row('b1', 'running', { runId: 'r1' }), row('c1', 'running', { runId: 'r2' })], [], [...runs, { id: 'r2', name: 'two', startedAt: 20 }]).list
  const first = two.find(arc => arc.key === runKey('r1'))!
  const second = two.find(arc => arc.key === runKey('r2'))!
  expect(first.start).toBeLessThan(second.start)
})

test('capping keeps running members, counts hidden ones, and the shares still sum to one', () => {
  const rows = Array.from({ length: 300 }, (_, i) => row(`m${i + 1}`, i === 299 ? 'running' : 'completed'))
  const { list } = build(rows)
  const more = list.find(arc => arc.hidden !== undefined)!
  expect(list.find(arc => arc.key === 'm300')).toBeDefined()
  expect(more.label).toBe(`+${more.hidden!.count} more`)
  expect(chartAgents(list)).toBe(300)
  expect(chartRunning(list)).toBe(1)
  const leaves = list.filter(arc => arc.kind === 'member')
  near(leaves.reduce((sum, arc) => sum + arc.end - arc.start, 0), 1)
  // A running member hidden makes the "+N" arc running and still counts.
  const many = build(Array.from({ length: 300 }, (_, i) => row(`m${i + 1}`, 'running'))).list
  expect(many.find(arc => arc.hidden !== undefined)!.status).toBe('running')
  expect(chartRunning(many)).toBe(300)
  expect(chartAgents(many)).toBe(300)
})

test('path data: a large arc flag over half a turn, a full turn as two halves, ring radii by depth', () => {
  const arc = (key: string, depth: number, start: number, end: number) => ({ key, depth, start, end, tone: 'cyan' as const, status: 'running', label: key, kind: 'member' as const })
  const svg = sunburstSvg([arc('c', 0, 0, 1), arc('big', 1, 0, 0.75), arc('small', 1, 0.75, 0.9), arc('full', 2, 0, 1)], 200, 'dark')
  const d = (key: string) => svg.match(new RegExp(`<path d="([^"]*)"[^>]*><title>${key}</title>`))![1]!
  expect(d('big')).toMatch(/A[\d.]+ [\d.]+ 0 1 1 /)
  expect(d('small')).toMatch(/A[\d.]+ [\d.]+ 0 0 1 /)
  expect(d('full').match(/A/g)).toHaveLength(4)
  const outer = (key: string) => Number(d(key).match(/A([\d.]+) /)![1])
  expect(outer('full')).toBeGreaterThan(outer('big'))
  expect(outer('big')).toBeGreaterThan(0)
})

test('labels lose control characters and keep surrogate pairs whole', () => {
  const { list } = build([row('a1', 'running', { description: `a\u0001b${'\u{1F600}'.repeat(100)}` })])
  const label = list.find(arc => arc.key === 'a1')!.label
  expect(label.includes('\u0001')).toBe(false)
  expect(Array.from(label).length).toBeLessThanOrEqual(90)
  expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(label)).toBe(false)
})

test('an SVG too long even without titles falls back to a summary', () => {
  const many = Array.from({ length: 6000 }, (_, i) => ({ key: `k${i}`, depth: 1, start: i / 6000, end: (i + 1) / 6000, tone: 'cyan' as const, status: 'running', label: 'x', kind: 'member' as const }))
  const svg = sunburstSvg([{ key: 'main', depth: 0, start: 0, end: 1, tone: 'cyan', status: 'completed', label: 'THIS SESSION', kind: 'session' }, ...many], 240, 'dark')
  expect(svg.length).toBeLessThan(131072)
  expect(svg).toContain('<circle ')
  expect(svg).toMatch(/>6000<\/text>/)
})

test('a lone session disc matches the SVG\'s 0.6 of the chart in braille', () => {
  const cells = decode(sunburstCells(build([]).list, 20, 10, 'dark'))
  const filled = cells.map((c, i) => [c.code !== 0x20, i] as const).filter(([on]) => on).map(([, i]) => i)
  const columns = filled.map(i => i % 20)
  const span = Math.max(...columns) - Math.min(...columns) + 1
  // The disc is 0.6 of 20 columns wide, 12, not the full 20.
  expect(span).toBeLessThanOrEqual(13)
  expect(span).toBeGreaterThanOrEqual(11)
})
