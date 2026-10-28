import { expect, test } from 'claude-code/testing'

import { agentKey, runKey, sessionTree } from './sessions'
import type { AgentRow, OrchTask } from './sessions'
import { TOKENS } from './sigma'
import { arcs, chartAgents, chartFailed, chartRunning, inkOn, rollupOf, stateGlyph, stateTone, stateWord, sunburstCells, sunburstSvg } from './sunburst'
import type { Arc } from './sunburst'

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

const by = (list: Arc[], key: string) => list.find(arc => arc.key === key)!
const share = (arc: Arc) => arc.end - arc.start

const threeRuns = (more: Partial<AgentRow> = {}) => {
  const rows = [row('a1', 'running', more), row('b1', 'running', { runId: 'r1' }), ...[1, 2].map(i => row(`c${i}`, 'running', { runId: 'r2' })), ...[1, 2, 3, 4].map(i => row(`d${i}`, 'running', { runId: 'r3' }))]
  const runs = [{ id: 'r1', name: 'one', startedAt: 10 }, { id: 'r2', name: 'two', startedAt: 20 }, { id: 'r3', name: 'three', startedAt: 30 }]
  return build(rows, [], runs).list
}

test('a node splits its span equally among its children, whatever sits below them', () => {
  const list = threeRuns()
  // The centre has four children: its own agent a1 and the three sub-sessions.
  near(share(by(list, 'a1')), 1 / 4)
  for (const id of ['r1', 'r2', 'r3']) near(share(by(list, runKey(id))), 1 / 4)
  // Each session splits its own span among its own agents: 1, 2 and 4 of them.
  near(share(by(list, 'b1')), 1 / 4)
  near(share(by(list, 'c1')), 1 / 8)
  near(share(by(list, 'd1')), 1 / 16)
  // Members tile their parent's span exactly.
  const r3 = by(list, runKey('r3'))
  near(by(list, 'd1').start, r3.start)
  near(by(list, 'd4').end, r3.end)
  expect(by(list, 'main')).toMatchObject({ depth: 0, start: 0, end: 1 })
  expect(by(list, 'a1').start).toBe(0)
  near(by(list, runKey('r3')).end, 1)
})

test('three sub-sessions each take a third of the turn however many agents they hold', () => {
  const rows = [row('b1', 'running', { runId: 'r1' }), ...[1, 2].map(i => row(`c${i}`, 'running', { runId: 'r2' })), ...[1, 2, 3, 4].map(i => row(`d${i}`, 'running', { runId: 'r3' }))]
  const list = build(rows, [], [{ id: 'r1', name: 'one', startedAt: 10 }, { id: 'r2', name: 'two', startedAt: 20 }, { id: 'r3', name: 'three', startedAt: 30 }]).list
  for (const id of ['r1', 'r2', 'r3']) near(share(by(list, runKey(id))), 1 / 3)
  near(share(by(list, 'c1')), 1 / 6)
  near(share(by(list, 'd1')), 1 / 12)
})

test('rings follow the tree depth, and a session with no children keeps its span', () => {
  const { list } = sample()
  const orch = by(list, 'orch')
  expect(orch.depth).toBe(1)
  expect(list.filter(arc => arc.key.startsWith('task-')).every(arc => arc.depth === 2 && arc.parent === 'orch')).toBe(true)
  expect([by(list, runKey('r1')).depth, by(list, 'b1').depth]).toEqual([1, 2])
  expect(by(list, 'a1').depth).toBe(1)
  // main has a1, a2, orch, run: a quarter each; orch splits it over three tasks.
  near(share(orch), 1 / 4)
  near(share(by(list, 'task-T1')), 1 / 12)
  // A sub-session that holds nothing still occupies its span.
  const lone = build([row('a1', 'running')], [], [{ id: 'r9', name: 'empty', startedAt: 5 }]).list
  const empty = lone.find(arc => arc.key === runKey('r9'))
  expect(empty).toBeDefined()
  near(share(empty!), 1 / 2)
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

test('stateTone is the SIGMAorbital state table, never green or violet', () => {
  expect(stateTone('running')).toBe('cyan')
  expect(stateTone('completed')).toBe('text-1')
  expect(stateTone('failed', { status: 'critical' })).toBe('red')
  expect(stateTone('failed')).toBe('red')
  expect(stateTone('blocked', { status: 'caution' })).toBe('amber')
  expect(stateTone('partial')).toBe('amber')
  expect(stateTone('pending')).toBe('text-3')
  expect(stateTone('waiting')).toBe('text-3')
  expect(stateTone('killed', { status: 'offline' })).toBe('text-3')
  expect(stateTone('cancelled')).toBe('text-3')
  const glyphs = [['running', '●'], ['completed', '■'], ['failed', '◆'], ['blocked', '▲'], ['partial', '▲'], ['pending', '□'], ['killed', '○'], ['cancelled', '○']] as const
  for (const [status, glyph] of glyphs) expect(stateGlyph(status)).toBe(glyph)
  for (const status of ['running', 'completed', 'failed', 'blocked', 'partial', 'pending', 'idle', 'killed', 'cancelled', 'whatever']) {
    expect(['green', 'violet'].includes(stateTone(status))).toBe(false)
  }
  // Every arc's tone is its state's, whoever owns it.
  const { list } = sample()
  for (const arc of list) expect(arc.tone).toBe(stateTone(arc.status, arc.badge))
  expect(by(list, 'task-T1').tone).toBe('text-1')
  expect(by(list, 'a1').tone).toBe('cyan')
  expect(by(list, 'task-T3').tone).toBe('text-3')
})

test('steps, tokens and time roll up the tree', () => {
  const rows = [
    row('a1', 'running', { tasks: [{ id: '1', text: 'x', status: 'completed' }, { id: '2', text: 'y', status: 'in_progress' }, { id: '3', text: 'z', status: 'pending' }], tokens: 1000, startedAt: 100 }),
    row('a2', 'completed', { tokens: 500, startedAt: 100, endedAt: 400 }),
    row('b1', 'running', { runId: 'r1', tokens: 250, startedAt: 200 }),
    row('b2', 'completed', { runId: 'r1', tokens: 50, startedAt: 210, endedAt: 300 }),
  ]
  const list = arcs(sessionTree({ rows, runs: [{ id: 'r1', name: 'rev', startedAt: 150 }], tones: {}, tasks: [], ledger: [] }), {}, { now: 1000 })
  expect(by(list, 'a1')).toMatchObject({ progress: { done: 1, total: 3 }, tokens: 1000, duration: 900 })
  // No task list: 1/1 once ended, 0/1 while running.
  expect(by(list, 'a2')).toMatchObject({ progress: { done: 1, total: 1 }, tokens: 500, duration: 300 })
  expect(by(list, 'b1').progress).toEqual({ done: 0, total: 1 })
  const run = by(list, runKey('r1'))
  expect(run).toMatchObject({ progress: { done: 1, total: 2 }, tokens: 300, duration: 850 })
  // The centre carries the whole: 1+1+1 of 3+1+2.
  const main = by(list, 'main')
  expect(main.progress).toEqual({ done: 3, total: 6 })
  expect(main.tokens).toBe(1800)
  const r = rollupOf(list, 'b2')!
  expect(r).toMatchObject({ done: 1, total: 1, tokens: 50, children: 0, path: 'THIS SESSION / WF rev / Explore · b2' })
  expect(rollupOf(list, 'main')!.children).toBe(3)
  expect(rollupOf(list, 'nope')).toBeUndefined()
})

test('a delegating agent adds its own tokens to its children\'s', () => {
  const rows = [row('d1', 'running', { tokens: 700 }), row('d2', 'completed', { parentId: 'd1', tokens: 30 })]
  const tones = { [agentKey('d1')]: 1 }
  const list = arcs(sessionTree({ rows, runs: [], tones, tasks: [], ledger: [] }), tones)
  expect(by(list, agentKey('d1')).tokens).toBe(730)
  expect(by(list, 'main').tokens).toBe(730)
})

test('arcs keep their places when a status or a token count changes', () => {
  const before = threeRuns()
  const rows = [row('a1', 'completed', { tokens: 9999 }), row('b1', 'failed', { runId: 'r1', tokens: 5 }), ...[1, 2].map(i => row(`c${i}`, 'running', { runId: 'r2' })), ...[1, 2, 3, 4].map(i => row(`d${i}`, 'completed', { runId: 'r3', tokens: 77 }))]
  const after = build(rows, [], [{ id: 'r1', name: 'one', startedAt: 10 }, { id: 'r2', name: 'two', startedAt: 20 }, { id: 'r3', name: 'three', startedAt: 30 }]).list
  expect(after.map(arc => [arc.key, arc.start, arc.end])).toEqual(before.map(arc => [arc.key, arc.start, arc.end]))
  expect(by(after, 'a1').tokens).not.toBe(by(before, 'a1').tokens)
})

test('arcs keep their places when a member changes status', () => {
  const before = build([row('a1', 'running'), row('a2', 'running'), row('a3', 'running')]).list
  const after = build([row('a1', 'running'), row('a2', 'completed'), row('a3', 'running')]).list
  expect(after.map(arc => arc.key)).toEqual(before.map(arc => arc.key))
  expect(after.map(arc => [arc.start, arc.end])).toEqual(before.map(arc => [arc.start, arc.end]))
  expect(after.find(arc => arc.key === 'a2')!.status).toBe('completed')
})

const mk = (key: string, depth: number, start: number, end: number, more: Partial<Arc> = {}): Arc => ({ key, depth, start, end, tone: 'cyan', status: 'running', label: key, name: key, code: '', glyph: '●', kind: depth === 0 ? 'session' : 'member', progress: { done: 0, total: 1 }, tokens: 0, duration: 0, ...more })
const sectors = (svg: string) => svg.match(/<path [^>]*>(?:<title>.*?<\/title>)?<\/path>/g)!.filter(p => p.includes('<title>'))
const strips = (svg: string, token: string) => (svg.match(new RegExp(`<path d="[^"]*" fill="none" stroke="${token}" stroke-width="3"/>`, 'g')) ?? [])

test('an empty tree and a lone empty session draw just the centre disc', () => {
  expect(arcs([], {})).toHaveLength(1)
  const { list } = build([])
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({ depth: 0, start: 0, end: 1 })
  const svg = sunburstSvg(list, 120, 'dark')
  expect(sectors(svg)).toHaveLength(1)
  const cells = decode(sunburstCells(list, 18, 9, 'dark'))
  expect(cells.some(c => c.code !== 0x20)).toBe(true)
  expect(new Set(cells.filter(c => c.code !== 0x20).map(c => c.fg))).toEqual(new Set([parseInt(TOKENS.dark['text-3'].slice(1), 16)]))
})

test('the SVG has one titled sector per arc, filled by state, with its title rolled up', () => {
  const { list } = build(
    [row('a1', 'running', { tokens: 12345, startedAt: 1000 }), row('a2', 'failed'), row('a3', 'pending'), row('a4', 'completed', { description: 'say <b> & "hi"' })],
    [task('T1', 'blocked')],
  )
  const svg = sunburstSvg(list, 300, 'dark')
  const dark = TOKENS.dark
  expect(svg.startsWith('<svg ')).toBe(true)
  expect(svg).toContain('viewBox="0 0 300 300"')
  expect(sectors(svg)).toHaveLength(list.length)
  const of = (key: string) => sectors(svg)[list.findIndex(arc => arc.key === key)]!
  expect(of('a1')).toContain(`fill="${dark.cyan}" fill-opacity="0.85"`)
  expect(of('a1')).not.toContain('stroke=')
  expect(of('a1')).toContain('<title>A04 · EXPLORE · A1 — RUNNING · 0/1 STEPS · 00:00:00 · 12.3k TOK</title>')
  expect(of('a2')).toContain(`fill="${dark.red}" fill-opacity="0.5"`)
  expect(of('a3')).toContain('fill-opacity="0"')
  expect(of('a3')).toContain(`stroke="${dark['text-3']}"`)
  expect(of('a4')).toContain(`fill="${dark['text-1']}" fill-opacity="0.5"`)
  expect(of('a4')).toContain('SAY &lt;B&gt; &amp; &quot;HI&quot;')
  expect(of('task-T1')).toContain(`fill="${dark.amber}"`)
  // Never green, never violet; the light theme draws the light hexes.
  expect(svg).not.toContain(dark.green)
  expect(svg).not.toContain(dark.violet)
  expect(sunburstSvg(list, 300, 'light')).toContain(`fill="${TOKENS.light.red}"`)
})

test('the centre disc says this session: raised fill, state ring, four lines of text', () => {
  const { list } = build([row('a1', 'running'), row('a2', 'completed', { startedAt: 0, endedAt: 3725_000 })], [], [])
  const svg = sunburstSvg(list, 300, 'dark', {})
  const dark = TOKENS.dark
  const centre = sectors(svg)[0]!
  const main = by(list, 'main')
  expect(centre).toContain(`fill="${dark.raised}"`)
  expect(centre).toContain(`stroke="${TOKENS.dark[main.tone]}" stroke-width="1.5"`)
  expect(svg).toContain('>THIS SESSION</text>')
  expect(svg).toContain(`${main.glyph} ${stateWord(main.status, main.badge)}</text>`)
  expect(stateWord(main.status, main.badge)).toBe('RUNNING')
  expect(svg).toContain(`${main.progress.done}/${main.progress.total}<tspan`)
  expect(svg).toContain('> STEPS</tspan>')
  expect(svg).toContain('>01:02:05</text>')
  // The core is 0.38 of the outer radius (150 - 2 - 12), and the first ring starts outside it.
  const core = Number(centre.match(/M[\d.]+ [\d.]+A([\d.]+) /)![1])
  expect(Math.abs(core - 136 * 0.38)).toBeLessThan(0.5)
  expect(Number(sectors(svg)[1]!.match(/M[\d.]+ [\d.]+A([\d.]+) /)![1])).toBeGreaterThan(core)
})

test('each ring sector has a track and a progress arc proportional to done over total', () => {
  const list = [
    mk('c', 0, 0, 1, { tone: 'text-1', status: 'completed' }),
    mk('half', 1, 0, 0.5, { progress: { done: 1, total: 2 } }),
    mk('none', 1, 0.5, 0.75, { progress: { done: 0, total: 4 } }),
    mk('all', 1, 0.75, 1, { tone: 'text-1', status: 'completed', progress: { done: 3, total: 3 } }),
  ]
  const svg = sunburstSvg(list, 300, 'dark')
  // A track under every non-centre sector, in `line`.
  expect(strips(svg, TOKENS.dark.line)).toHaveLength(3)
  const cyan = strips(svg, TOKENS.dark.cyan)
  const white = strips(svg, TOKENS.dark['text-1'])
  expect(cyan).toHaveLength(1)
  expect(white).toHaveLength(1)
  // Chord angle: the progress arc of the half-done sector covers half its track.
  const sweep = (d: string) => {
    const [, x1, y1, r, x2, y2] = d.match(/M([\d.-]+) ([\d.-]+)A([\d.]+) [\d.]+ 0 [01] 1 ([\d.-]+) ([\d.-]+)/)!.map(Number) as [number, number, number, number, number, number]
    const a = Math.atan2(y1 - 150, x1 - 150)
    const b = Math.atan2(y2 - 150, x2 - 150)
    return (((b - a) / (Math.PI * 2)) % 1 + 1) % 1 || 1
  }
  const track = strips(svg, TOKENS.dark.line)
  const half = sweep(cyan[0]!)
  const full = sweep(track[0]!)
  // The track of 'half' spans 0.5 of a turn less its pad; the progress arc is half of that.
  near(Math.round(half * 1000) / 1000, Math.round((full / 2) * 1000) / 1000)
  // A third arc complete: its progress arc is as long as its track.
  near(Math.round(sweep(white[0]!) * 1000), Math.round(sweep(track[2]!) * 1000))
})

test('the selected arc gets a 2px white outline, and only it', () => {
  const { list } = build([row('a1', 'running'), row('a2', 'running')])
  const white = TOKENS.dark.white
  const outline = `stroke="${white}" stroke-width="2"`
  expect(sunburstSvg(list, 300, 'dark').includes(outline)).toBe(false)
  const picked = sunburstSvg(list, 300, 'dark', { selected: 'a2' })
  const hit = sectors(picked).filter(p => p.includes(outline))
  expect(hit).toHaveLength(1)
  expect(hit[0]).toContain('<title>A02 · EXPLORE · A2 —')
  const centre = sectors(sunburstSvg(list, 300, 'dark', { selected: 'main' }))[0]!
  expect(centre).toContain(outline)
  const viaArcs = arcs(sessionTree({ rows: [row('a1', 'running')], runs: [], tones: {}, tasks: [], ledger: [] }), {}, { selected: 'a1' })
  expect(by(viaArcs, 'a1').selected).toBe(true)
  expect(sectors(sunburstSvg(viaArcs, 300, 'dark')).filter(p => p.includes(outline))).toHaveLength(1)
})

test('only a running sector pulses; a failed or blocked marker outside its sector is a static glyph', () => {
  const pulses = (svg: string) => svg.match(/<animate attributeName="opacity" values="1;0.35;1" dur="1.5s" repeatCount="indefinite"\/>/g) ?? []
  // Nothing runs: no animation at all.
  const calm = build([row('a1', 'completed'), row('a2', 'pending'), row('a3', 'killed')]).list
  expect(sunburstSvg(calm, 300, 'dark')).not.toContain('<animate')
  const still = build([row('a2', 'failed')], [task('T1', 'blocked')]).list
  const quiet = sunburstSvg(still, 300, 'dark')
  expect(quiet).not.toContain('<animate')
  expect(quiet).toContain('◆</text>')
  expect(quiet).toContain('▲</text>')
  // Each running sector's ● marker pulses, the failed and blocked ones do not.
  const bad = build([row('a1', 'running'), row('a2', 'failed')], [task('T1', 'blocked')]).list
  const svg = sunburstSvg(bad, 300, 'dark')
  expect(pulses(svg)).toHaveLength(1)
  expect(svg).toContain('●<animate')
  expect(svg).not.toContain('◆<animate')
  expect(svg).not.toContain('▲<animate')
  expect(svg).not.toContain('<script')
})

test('the centre text never goes under 7px (the count 9px), and a small core drops THIS SESSION', () => {
  const { list } = build([row('a1', 'running'), row('a2', 'completed')])
  const sizes = (svg: string) => [...svg.matchAll(/font-size="([\d.]+)"/g)].map(m => Number(m[1]))
  const small = sunburstSvg(list, 180, 'dark')
  expect(Math.min(...sizes(small))).toBeGreaterThanOrEqual(7)
  // The count keeps 9px at least.
  expect(small).toMatch(/font-size="9"[^>]*>\d+\/\d+<tspan/)
  expect(small).not.toContain('>THIS SESSION</text>')
  expect(small).toContain('> STEPS</tspan>')
  // Room enough: the title stays.
  const big = sunburstSvg(list, 400, 'dark')
  expect(big).toContain('>THIS SESSION</text>')
  expect(Math.min(...sizes(big))).toBeGreaterThanOrEqual(7)
})

test('stateWord is one vocabulary: the centre, titles and labels use it', () => {
  expect(stateWord('running')).toBe('RUNNING')
  expect(stateWord('completed')).toBe('DONE')
  expect(stateWord('failed')).toBe('FAILED')
  expect(stateWord('blocked')).toBe('BLOCKED')
  expect(stateWord('pending')).toBe('QUEUED')
  expect(stateWord('stopped')).toBe('STOPPED')
  expect(stateWord('killed', { status: 'offline' })).toBe('STOPPED')
  // The badge's word wins.
  expect(stateWord('partial', { status: 'caution', word: 'partial' })).toBe('PARTIAL')
  expect(stateWord('cancelled', { status: 'offline', word: 'cancelled' })).toBe('CANCELLED')
  const { list } = build([row('a1', 'completed'), row('a2', 'pending')])
  expect(by(list, 'a1').label).toBe('Explore · a1 — DONE')
  expect(by(list, 'a2').label).toBe('Explore · a2 — QUEUED')
  const svg = sunburstSvg(list, 300, 'dark')
  expect(svg).toContain('— DONE ·')
  expect(svg).toContain('— QUEUED ·')
  expect(svg).not.toContain('— COMPLETED')
  expect(svg).not.toContain('— PENDING')
})

test('the FAILED count includes failed members behind a +N more arc', () => {
  const rows = Array.from({ length: 300 }, (_, i) => row(`m${i + 1}`, i >= 295 ? 'failed' : 'completed'))
  const { list } = build(rows)
  const more = list.find(arc => arc.hidden !== undefined)!
  // The five failed ones are the last in the stable order, so they are all hidden.
  expect(list.some(arc => arc.status === 'failed' && arc.hidden === undefined)).toBe(false)
  expect(more.hidden!.failed).toBe(5)
  expect(chartFailed(list)).toBe(5)
  expect(chartFailed(build([row('a1', 'failed'), row('a2', 'running')]).list)).toBe(1)
})

test('in-sector label text is escaped', () => {
  const svg = sunburstSvg([mk('c', 0, 0, 1), mk('x', 1, 0, 1, { name: 'A<B>&"C"', progress: { done: 1, total: 2 } })], 400, 'dark')
  expect(svg).toContain('>A&lt;B&gt;&amp;&quot;C&quot;</text>')
  expect(svg).not.toContain('>A<B>')
})

test('label ink is whichever of bg and text-1 reads better on the composited fill, per theme', () => {
  const colors = (theme: 'dark' | 'light') => TOKENS[theme]
  for (const theme of ['dark', 'light'] as const) {
    for (const tone of ['cyan', 'red', 'amber', 'text-1'] as const) {
      for (const opacity of [0.85, 0.5]) {
        const ink = inkOn(theme, tone, opacity)
        expect([colors(theme).bg, colors(theme)['text-1']]).toContain(ink)
      }
    }
  }
  // A failed (red) sector ended at 0.5 over a dark page takes the light ink, running at 0.85 the page colour.
  expect(inkOn('dark', 'red', 0.5)).toBe(TOKENS.dark['text-1'])
  expect(inkOn('dark', 'red', 0.85)).toBe(TOKENS.dark.bg)
  expect(inkOn('dark', 'cyan', 0.85)).toBe(TOKENS.dark.bg)
  // The light theme flips a running cyan.
  expect(inkOn('light', 'cyan', 0.85)).toBe(TOKENS.light['text-1'])
})

test('a sector with room carries its name and steps, clipped to fit', () => {
  const big = [mk('c', 0, 0, 1), mk('one', 1, 0, 1, { name: 'REVIEWER', progress: { done: 2, total: 5 } }), mk('deep', 2, 0, 0.5, { name: 'A-VERY-LONG-NAME-INDEED', progress: { done: 1, total: 1 } })]
  const svg = sunburstSvg(big, 400, 'dark')
  expect(svg).toContain('>2/5</text>')
  expect(svg).toMatch(/>A-V[^<]*…<\/text>/)
  expect(svg).not.toContain('A-VERY-LONG-NAME-INDEED</text>')
  // A thin sliver has no room for a label.
  const sliver = sunburstSvg([mk('c', 0, 0, 1), mk('s', 1, 0, 0.01, { name: 'SLIVER' })], 400, 'dark')
  expect(sliver).not.toContain('>SLIVER</text>')
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

test('a cell takes the state tone of the arc covering most of its dots', () => {
  const { list } = build([row('a1', 'running'), row('a2', 'running'), row('a3', 'failed')], [task('T1', 'blocked'), task('T2', 'running')])
  const cells = decode(sunburstCells(list, 18, 9, 'dark'))
  const colors = new Set(cells.filter(c => c.code !== 0x20).map(c => c.fg))
  const hex = (token: 'cyan' | 'violet' | 'red' | 'amber' | 'text-1') => parseInt(TOKENS.dark[token].slice(1), 16)
  for (const token of ['cyan', 'red', 'amber'] as const) expect(colors.has(hex(token))).toBe(true)
  expect(colors.has(hex('violet'))).toBe(false)
  expect(colors.has(parseInt(TOKENS.dark.green.slice(1), 16))).toBe(false)
})

test('braille draws the progress as a dot row outside a sector, only over the done fraction', () => {
  const dots = (cells: Cell[]) => dotsOf(cells)
  const with_ = (done: number) => decode(sunburstCells([mk('c', 0, 0, 1, { tone: 'text-1', status: 'completed' }), mk('a', 1, 0, 1, { progress: { done, total: 4 } })], 30, 15, 'dark'))
  expect(dots(with_(0))).toBeLessThan(dots(with_(2)))
  expect(dots(with_(2))).toBeLessThan(dots(with_(4)))
})

test('braille draws the selected arc at full density', () => {
  const ended = (selected?: string) => decode(sunburstCells(build([row('a1', 'completed'), row('a2', 'completed')]).list, 18, 9, 'dark', { selected }))
  expect(dotsOf(ended('a1'))).toBeGreaterThan(dotsOf(ended()))
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
  expect(list[0]!.status).toBe('idle')
  expect(stateWord('idle')).toBe('IDLE')
  const svg = sunburstSvg(list, 240, 'dark')
  expect(sectors(svg)[0]!).not.toContain('fill-opacity')
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
  const svg = sunburstSvg([mk('c', 0, 0, 1), mk('big', 1, 0, 0.75), mk('small', 1, 0.75, 0.9), mk('full', 2, 0, 1)], 200, 'dark')
  const d = (key: string) => svg.match(new RegExp(`<path d="([^"]*)"[^>]*><title>[^<]*${key.toUpperCase()}[^<]*</title>`, 'i'))![1]!
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
  const many = Array.from({ length: 6000 }, (_, i) => mk(`k${i}`, 1, i / 6000, (i + 1) / 6000, { label: 'x' }))
  const svg = sunburstSvg([mk('main', 0, 0, 1, { status: 'completed', label: 'THIS SESSION' }), ...many], 240, 'dark')
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

test('the graph shows a short code: T-id for a ledger task, A01 by start within its session, S01 by start across the tree, +N for the rest', () => {
  const { list } = build(
    [row('a1', 'running', { startedAt: 300 }), row('a2', 'completed', { startedAt: 100 }), row('b1', 'running', { runId: 'r1', startedAt: 50 }), row('c1', 'running', { runId: 'r2', startedAt: 60 })],
    [task('T1', 'completed'), task('T2', 'running', { agentId: 'w2' })],
    [{ id: 'r1', name: 'one', startedAt: 20 }, { id: 'r2', name: 'two', startedAt: 10 }],
  )
  expect(by(list, 'main').code).toBe('')
  expect(by(list, 'a2').code).toBe('A01')
  expect(by(list, 'a1').code).toBe('A02')
  expect(by(list, 'b1').code).toBe('A01')
  expect(by(list, 'task-T1').code).toBe('T1')
  expect(by(list, 'task-T2').code).toBe('T2')
  // The orchestrator's session starts with its first task (0), then the runs by start.
  expect(by(list, 'orch').code).toBe('S01')
  expect(by(list, runKey('r2')).code).toBe('S02')
  expect(by(list, runKey('r1')).code).toBe('S03')
  const many = build(Array.from({ length: 300 }, (_, i) => row(`m${i + 1}`, 'completed'))).list
  expect(many.find(a => a.hidden !== undefined)!.code).toMatch(/^\+\d+$/)
})

test('a code is stable across a status change and an agent ending; a later agent takes the next number', () => {
  const rows = [row('a1', 'running', { startedAt: 1 }), row('a2', 'running', { startedAt: 2 })]
  const before = build(rows).list
  const after = build([row('a1', 'completed', { startedAt: 1, tokens: 99 }), row('a2', 'running', { startedAt: 2 })]).list
  expect(after.map(a => [a.key, a.code])).toEqual(before.map(a => [a.key, a.code]))
  const ended = build([row('a2', 'running', { startedAt: 2 })]).list
  expect(by(ended, 'a2').code).toBe('A01')
  const later = build([...rows, row('a3', 'running', { startedAt: 3 })]).list
  expect(by(later, 'a1').code).toBe('A01')
  expect(by(later, 'a3').code).toBe('A03')
})

test('the in-sector label is the code, not the name; the title carries both', () => {
  const { list } = build([row('a1', 'running', { description: 'a long descriptive name' })])
  const svg = sunburstSvg(list, 1000, 'dark')
  expect(svg).toContain('>A01</text>')
  expect(svg).not.toContain('>EXPLORE · A LONG')
  expect(svg).toContain('<title>A01 · EXPLORE · A LONG DESCRIPTIVE NAME — RUNNING')
})

const fontsOf = (svg: string) => Array.from(svg.matchAll(/font-size="([\d.]+)"/g), m => Number(m[1]))

test('fonts, strokes, tracks and glyphs scale with the size, and no font is under 7px', () => {
  const list = (selected: boolean) => [mk('c', 0, 0, 1), mk('one', 1, 0, 1, { name: 'REVIEWER', progress: { done: 2, total: 5 }, selected })]
  const sized = (size: number) => {
    const svg = sunburstSvg(list(true), size, 'dark')
    const label = Number(new RegExp('font-size="([\\d.]+)" fill="#[0-9a-f]+">REVIEWER</text>').exec(svg)![1])
    const stroke = Number(/<path d="[^"]*" fill="#7fe7ff" fill-opacity="0.85" stroke="#ffffff" stroke-width="([\d.]+)"/.exec(svg)?.[1] ?? /stroke="#[0-9a-f]+" stroke-width="([\d.]+)" fill-rule/.exec(svg.split('fill-opacity="0.85"')[1]!)![1])
    const track = Number(new RegExp(`stroke="${TOKENS.dark.line}" stroke-width="([\\d.]+)"`).exec(svg)![1])
    return { svg, label, stroke, track }
  }
  const a = sized(300)
  const b = sized(600)
  const c = sized(900)
  expect([a.label, b.label, c.label]).toEqual([7.5, 15, 22.5])
  expect([a.stroke, b.stroke, c.stroke]).toEqual([2, 4, 6])
  expect([a.track, b.track, c.track]).toEqual([3, 6, 9])
  for (const size of [150, 300, 600, 900]) expect(Math.min(...fontsOf(sunburstSvg(list(false), size, 'dark')))).toBeGreaterThanOrEqual(7)
  // Small, the font keeps its 7px floor in real pixels.
  expect(sized(150).label).toBe(7)
})

test('the SVG title does not repeat a ledger task\'s id', () => {
  const { list } = build([], [task('T1', 'running')])
  const t1 = by(list, 'task-T1')
  expect(t1.name.startsWith('T1 ·')).toBe(true)
  const title = /<title>(T1[^<]*)<\/title>/.exec(sunburstSvg(list, 300, 'dark'))![1]!
  expect(title.startsWith('T1 · BUILDER')).toBe(true)
  expect(title).not.toContain('T1 · T1')
})

test('the +N more arc takes the failed state when a hidden member failed, else running, else done', () => {
  const more = (statuses: (i: number) => string) => build(Array.from({ length: 300 }, (_, i) => row(`m${i + 1}`, statuses(i)))).list.find(arc => arc.hidden !== undefined)!
  const failed = more(i => (i >= 295 ? 'failed' : 'completed'))
  expect(failed.status).toBe('failed')
  expect(failed.tone).toBe('red')
  expect(failed.glyph).toBe(stateGlyph('failed'))
  expect(sunburstSvg([mk('c', 0, 0, 1), { ...failed, depth: 1 }], 300, 'dark')).toContain('MORE — FAILED')
  const mixed = more(i => (i === 297 ? 'failed' : i === 298 ? 'running' : 'completed'))
  expect(mixed.status).toBe('failed')
  // Running members are kept first, so a hidden one runs only when there are more of them than the cap keeps.
  expect(more(() => 'running').status).toBe('running')
  expect(more(() => 'completed').status).toBe('completed')
})

test('a delegating agent counts among the AGENTS and, failed, among the FAILED', () => {
  const rows = [row('d1', 'failed'), row('d2', 'running', { parentId: 'd1' })]
  const tones = { [agentKey('d1')]: 1 }
  const list = arcs(sessionTree({ rows, runs: [], tones, tasks: [], ledger: [] }), tones)
  expect(by(list, agentKey('d1')).kind).toBe('session')
  // d1 (a session arc) and its member d2.
  expect(chartAgents(list)).toBe(2)
  expect(chartFailed(list)).toBe(1)
  expect(chartRunning(list)).toBe(1)
  // A sub-session that is not an agent (a run) is not one.
  expect(chartAgents(build([row('b1', 'running', { runId: 'r1' })], [], [{ id: 'r1', name: 'x', startedAt: 10 }]).list)).toBe(1)
})

test('a control character in a task id never reaches the SVG or the arc code', () => {
  const { list } = build([], [task('T\u00011', 'running')])
  expect(list.every(arc => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(arc.code))).toBe(true)
  expect(by(list, 'task-T\u00011').code).toBe('T1')
  expect(sunburstSvg(list, 300, 'dark')).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/)
})

test('on a small chart the selection and a waiting outline keep a visible stroke', () => {
  const tree = [
    { key: 'main', kind: 'main', name: 'THIS SESSION', depth: 0, isActive: true, status: 'running', running: [], completed: [] },
    { key: 'run:r', kind: 'run', name: 'WF r', depth: 1, isActive: true, status: 'running', startedAt: 1, running: [], completed: [] },
  ] as unknown as Parameters<typeof arcs>[0]
  const list = arcs(tree, {}, { selected: 'run:r' })
  const small = sunburstSvg(list, 160, 'dark', { selected: 'run:r' })
  const widths = [...small.matchAll(/stroke="#ffffff" stroke-width="([\d.]+)"/g)].map(m => Number(m[1]))
  expect(widths.length).toBeGreaterThan(0)
  for (const w of widths) expect(w >= 1.5).toBe(true)
})
