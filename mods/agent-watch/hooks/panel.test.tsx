import { expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, EngineInterface, On, Register } from 'claude-code'

import { sessionsLayout, VERSION } from './panel'
import { TOKENS } from './sigma'

// The Sessions panel (ADR-0047) in agent-watch's own pane: one fixture of a
// session, an orchestrator run and a Workflow run, tracked through the mod's
// own hooks (an inline plugin cannot write another plugin's state).

const DARK = TOKENS.dark

const PANE = {
  plugin: 'agent-watch',
  component: 'Pane',
  requestId: 'agent-watch',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const
const TALL = { ...PANE.props, scroll: { offset: 0, bodyRows: 90 } }
const SURFACES = ['terminal', 'desktop'] as const

type Said = { views: unknown[] }

/** The engine beneath the mod: a list of agents the test moves, and the views the mod asked for. */
const engine = (on: On, listed: { value: AgentInfo[] }): Said => {
  const said: Said = { views: [] }
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.view', (_, e) => {
    said.views.push(e)
    return { value: {} }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('classic.SubagentStop', () => ({}))
  on('agent.list', () => ({ value: listed.value }))
  on('agent.spawn', (_, e) => ({ model: 'm', agentId: `id-${e.description}` }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', () => ({ turnId: 't' }))
  on('tool.call', (_, e) => (e.tool === 'Workflow' ? { result: { status: 'async_launched', taskId: 't', runId: 'wf_1', workflowName: 'review' } } : { result: {} }))

  return said
}

// task-orchestrator as the engine holds it: an inline plugin that writes its
// ledger (the kit loads an inline register without its closure, so it is a
// literal inside it).
const orchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'running', agentId: 'id-T1 builder', startedAt: 1_000, observed: { model: 'claude-sonnet-5-5', effort: 'high', at: 1_100 } },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'blocked', startedAt: 600, endedAt: 900 },
      { ...task, id: 'T3', role: 'tester', objective: 'Test it', status: 'queued', deps: ['T1', 'T2'] },
    ])
    return next(e)
  })
}
const TREE = { plugins: [{ name: 'task-orchestrator', register: orchestrator }] }

const usage = (tokens: number) => ({ input_tokens: tokens, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })

/**
 * A session with a running agent of its own (2 calls), an orchestrator run (a
 * running worker, a blocked task, a queued one) and a Workflow run (one agent
 * running, one failed with 1.2k tokens): six agents, two of them ended.
 */
const populate = async ($: EngineInterface, on: On) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  const said = engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'p', description: 'Scan docs', subagentType: 'Explore' } as AgentSpawnInput)
  for (let i = 0; i < 2; i++) await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'id-Scan docs' })
  await $.agent.spawn({ prompt: 'p', description: 'T1 builder', subagentType: 'task-orchestrator:builder' } as AgentSpawnInput)
  await $.tool.call({ tool: 'Workflow', script: 'export const meta = {}' } as never)
  await $.agent.spawn({ prompt: 'p', description: 'review:code', subagentType: 'Explore', workflow: { runId: 'wf_1', agentIndex: 1 } } as AgentSpawnInput)
  await $.agent.spawn({ prompt: 'p', description: 'review:tests', subagentType: 'Explore', workflow: { runId: 'wf_1', agentIndex: 2 } } as AgentSpawnInput)
  listed.value = [
    { id: 'id-Scan docs', type: 'Explore', description: 'Scan docs', status: 'running' },
    { id: 'id-T1 builder', type: 'task-orchestrator:builder', description: 'T1 builder', status: 'running', name: 'T1', spawnedBy: 'task-orchestrator' },
  ]
  await clock.advance(1_000)
  await $.turn.complete({ agentId: 'id-review:tests', reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't1', usage: usage(1_200) })
  await clock.advance(3_000)

  return { clock, said }
}

const mount = (
  $: EngineInterface,
  surface: (typeof SURFACES)[number],
  props: Record<string, unknown> = TALL,
  columns?: number,
) => $.ui.mount({ ...PANE, surface, props: { ...PANE.props, ...props, ...(columns === undefined ? {} : { bodyColumns: columns }) } })

test('the pane is the Sessions panel: this session, the ORCH run, a Workflow run, their members with captions', TREE, async ($, on) => {
  await populate($, on)
  for (const surface of SURFACES) {
    const ui = await mount($, surface)
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^SESSIONS$/)).toBeDefined()
    expect(await text(/^3 RUNNING$/)).toBeDefined()
    expect(await text(/^THIS SESSION$/)).toBeDefined()
    expect(await text(/^ORCH BALANCED$/)).toBeDefined()
    expect(await text(/^WF review$/)).toBeDefined()
    // The orchestrator's tasks are its members; the worker's agent is not drawn twice.
    expect(await text(/T1 · builder · Write the model/)).toBeDefined()
    expect(await text(/WAITS ON T1, T2/)).toBeDefined()
    expect((await ui.findAll({ text: /T1 builder/ })).length).toBe(0)
    // A member's caption and a failed member's word.
    expect(await text(/2 CALLS/)).toBeDefined()
    expect(await text(/Explore · review:tests/)).toBeDefined()
    // A row is pressed to select it, so its key is the row's.
    expect((await ui.find({ type: 'Button', text: /Explore · Scan docs/ }))?.key).toBe('row-id-Scan docs')
    expect((await ui.find({ type: 'Button', text: /T2 · reviewer/ }))?.key).toBe('row-task-T2')
    // Heads are bold.
    expect((await ui.findAll({ type: 'Text', text: /^THIS SESSION$/ })).map(one => one.props.weight)).toContain('bold')
    await ui.unmount()
  }
})

test('rows are coloured by state, never by session: running cyan, failed red, blocked amber, queued text-3', TREE, async ($, on) => {
  await populate($, on)
  const ui = await mount($, 'terminal')
  const colour = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).map(one => one.props.color)
  expect(await colour(/^ BLOCKED$/)).toContain(DARK.amber)
  expect(await colour(/^ FAILED$/)).toContain(DARK.red)
  expect(await colour(/^ QUEUED$/)).toContain(DARK['text-3'])
  expect(await colour(/^ RUNNING$/)).toContain(DARK.cyan)
  const glyphs = (await ui.findAll({ type: 'Text', text: /[⬢●◆▲□○■] $/ })).map(one => one.props.color)
  for (const tone of [DARK.cyan, DARK.red, DARK.amber]) expect(glyphs).toContain(tone)
  expect(glyphs).not.toContain(DARK.violet)
  // A member row carries its state's glyph, so the fixed square is only a done one.
  const squares = (await ui.findAll({ type: 'Text', text: /■ $/ })).map(one => one.props.color)
  for (const tone of [DARK.red, DARK.amber, DARK.cyan]) expect(squares).not.toContain(tone)
  // No Text in the pane is a session tone.
  expect((await ui.findAll({ type: 'Text' })).map(one => one.props.color)).not.toContain(DARK.violet)
  await ui.unmount()
})

test('the tree is a sunburst: an Svg on the desktop, a Raster of braille on the terminal, filled by state', TREE, async ($, on) => {
  await populate($, on)
  const desktop = await mount($, 'desktop')
  const svg = await desktop.find({ type: 'Svg' })
  expect(svg?.props.source).toMatch(/^<svg /)
  for (const token of [DARK.cyan, DARK.red, DARK.amber]) expect(svg?.props.source).toContain(token)
  expect(svg?.props.source).not.toContain(DARK.violet)
  expect(String(svg?.props.alt)).toMatch(/running/)
  expect(svg?.props.isInteractive).toBe(true)
  expect(await desktop.find({ type: 'Raster' })).toBeUndefined()
  await desktop.unmount()

  const terminal = await mount($, 'terminal')
  const raster = await terminal.find({ type: 'Raster' })
  expect(raster).toBeDefined()
  expect(atob(String(raster?.props.cells)).length).toBe(Number(raster?.props.columns) * Number(raster?.props.rows) * 12)
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  await terminal.unmount()

  // A pane too short for it leaves the terminal's chart out; a desktop's is never hidden for height (the pane scrolls).
  const short = await mount($, 'desktop', { scroll: { offset: 0, bodyRows: 30 } })
  expect(await short.find({ type: 'Svg' })).toBeDefined()
  await short.unmount()
  const shortTerminal = await mount($, 'terminal', { scroll: { offset: 0, bodyRows: 20 } })
  expect(await shortTerminal.find({ type: 'Raster' })).toBeUndefined()
  await shortTerminal.unmount()
})

test('pressing a row selects it, outlines its arc and fills the selected panel; pressing it again clears it', TREE, async ($, on) => {
  await populate($, on)
  const ui = await mount($, 'desktop')
  const source = async () => String((await ui.find({ type: 'Svg' }))?.props.source)
  // The head row, and the panel's name and path while this session is the one shown.
  const sessions = async () => (await ui.findAll({ type: 'Text', text: /^THIS SESSION$/ })).length
  const raised = async () => (await ui.findAll({ type: 'Box' })).filter(one => one.props.backgroundColor === DARK.raised).length
  // Nothing selected: this session in the panel, no arc outlined.
  expect(await source()).not.toContain(DARK.white)
  expect(await sessions()).toBe(3)
  expect(await raised()).toBe(0)
  await ui.press({ key: 'row-id-Scan docs' })
  expect(await source()).toContain(`stroke="${DARK.white}"`)
  expect(await ui.find({ type: 'Text', text: /^THIS SESSION \/ Explore · Scan docs$/ })).toBeDefined()
  expect(await sessions()).toBe(1)
  // The selected row carries the raised fill.
  expect(await raised()).toBeGreaterThan(0)
  await ui.press({ key: 'row-id-Scan docs' })
  expect(await source()).not.toContain(DARK.white)
  expect(await sessions()).toBe(3)
  expect(await raised()).toBe(0)
  await ui.unmount()
})

test('the selected panel shows path, state, progress, duration, tokens and children; OPEN TRANSCRIPT opens the transcript', TREE, async ($, on) => {
  const { said } = await populate($, on)
  const ui = await mount($, 'terminal')
  const has = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).length > 0
  expect(await has(/^SELECTED$/)).toBe(true)
  // This session by default: no transcript to open.
  expect(await ui.find({ key: 'transcript' })).toBeUndefined()
  await ui.press({ key: 'row-id-Scan docs' })
  expect(await has(/^THIS SESSION \/ Explore · Scan docs$/)).toBe(true)
  expect(await has(/^ RUNNING$/)).toBe(true)
  expect(await has(/^0\/1$/)).toBe(true)
  expect(await has(/^· 0%$/)).toBe(true)
  expect(await has(/^00:00:0\d$/)).toBe(true)
  expect(await has(/^—$/)).toBe(true)
  expect(await ui.find({ type: 'Button', key: 'transcript' })).toBeDefined()
  expect(await has(/^OPEN TRANSCRIPT$/)).toBe(true)
  await ui.press({ key: 'transcript' })
  expect(said.views).toEqual([{ agentId: 'id-Scan docs' }])
  // A queued task has no transcript to open.
  await ui.press({ key: 'row-task-T3' })
  expect(await has(/^ QUEUED$/)).toBe(true)
  expect(await ui.find({ key: 'transcript' })).toBeUndefined()
  await ui.unmount()
})

test('the transcript stays reachable when the full panel does not fit: a one-line strip with OPEN TRANSCRIPT', TREE, async ($, on) => {
  const { said } = await populate($, on)
  let strips = 0
  for (const bodyRows of [24, 28, 32, 36, 40, 44]) {
    said.views.length = 0
    const ui = await mount($, 'terminal', { scroll: { offset: 0, bodyRows } })
    const has = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).length > 0
    // Whenever the panel is not drawn, a strip stands in for it: the selection in one line.
    if (await has(/^SELECTED$/)) {
      await ui.unmount()
      continue
    }
    strips++
    expect(await ui.find({ key: 'transcript' })).toBeUndefined()
    await ui.press({ key: 'row-id-Scan docs' })
    expect(await has(/^Explore · Scan docs$/)).toBe(true)
    expect(await has(/RUNNING/)).toBe(true)
    expect(await has(/ · 0\/1 · 0 TOK$/)).toBe(true)
    expect(await ui.find({ type: 'Button', key: 'transcript' })).toBeDefined()
    await ui.press({ key: 'transcript' })
    expect(said.views).toEqual([{ agentId: 'id-Scan docs' }])
    await ui.press({ key: 'row-id-Scan docs' })
    await ui.unmount()
  }
  expect(strips).toBeGreaterThan(0)
})

test('the selected panel is funded before the KPI row', TREE, async ($, on) => {
  await populate($, on)
  const shows = async (bodyRows: number) => {
    const ui = await mount($, 'terminal', { scroll: { offset: 0, bodyRows } })
    const found = { panel: (await ui.findAll({ type: 'Text', text: /^SELECTED$/ })).length > 0, kpi: (await ui.findAll({ type: 'Text', text: /^PROGRESS$/ })).length > 1 }
    await ui.unmount()
    return found
  }
  // The shortest pane that draws the panel has no KPI row yet; with more rows it does.
  let first: number | undefined
  for (let rows = 24; rows <= 90 && first === undefined; rows++) if ((await shows(rows)).panel) first = rows
  expect(first).toBeDefined()
  expect((await shows(first!)).panel).toBe(true)
  expect((await shows(first! - 1)).panel).toBe(false)
  expect((await shows(first!)).kpi).toBe(false)
  expect((await shows(90)).kpi).toBe(true)
})

test('the KPI row is four stat blocks in one divided row: label, tabular value, unit and caption', TREE, async ($, on) => {
  await populate($, on)
  const ui = await mount($, 'terminal')
  const texts = await ui.findAll({ type: 'Text' })
  // 2 of 6 steps, six agents (three running), the 1.2k tokens of the failed one, one failed (the value in red, out of limits).
  for (const [title, value, ink] of [[/^PROGRESS$/, '33', 'text-1'], [/^AGENTS$/, '6', 'text-1'], [/^TOKENS$/, '1.2k', 'text-1'], [/^FAILED$/, '1', 'red']] as const) {
    const at = texts.findIndex((one, i) => title.test(one.text ?? '') && texts[i + 1]?.text === value)
    expect(at).toBeGreaterThan(-1)
    expect(texts[at]?.props).toMatchObject({ color: DARK['text-3'], size: 'caption' })
    expect(texts[at + 1]?.props).toMatchObject({ color: DARK[ink], size: 'title', tabular: true })
  }
  const has = (pattern: RegExp, color?: string) => texts.some(one => pattern.test(one.text ?? '') && (color === undefined || one.props.color === color))
  expect(has(/^ %$/, DARK['text-3'])).toBe(true)
  // TOKENS carries its unit under the value, as a caption.
  const tokens = texts.findIndex((one, i) => /^TOKENS$/.test(one.text ?? '') && texts[i + 1]?.text === '1.2k')
  expect(texts[tokens + 2]?.text).toBe('TOK')
  expect(has(/^2\/6 STEPS$/, DARK['text-3'])).toBe(true)
  expect(has(/^3 RUNNING$/, DARK['text-3'])).toBe(true)
  // The stats are divided by three `│` columns in `line`.
  expect(texts.filter(one => one.text === '│' && one.props.color === DARK.line).length).toBeGreaterThanOrEqual(9)
  // The legend: a glyph and a word per state.
  for (const word of [/^ RUNNING$/, /^ DONE$/, /^ FAILED$/, /^ BLOCKED$/, /^ QUEUED$/, /^ STOPPED$/]) expect(has(word, DARK['text-3'])).toBe(true)
  await ui.unmount()
})

test('the panel is one bracketed frame: four text-1 corners, and the selected panel and the KPI stats inside add none', TREE, async ($, on) => {
  await populate($, on)
  // Desktop: the frame is filled with `surface` and has four line edges and four text-1 bracket corners (eight arms), drawn without a height.
  const desktop = await mount($, 'desktop')
  const boxes = await desktop.findAll({ type: 'Box' })
  const framed = boxes.filter(one => one.props.backgroundColor === DARK.surface && one.props.width === PANE.props.bodyColumns)
  expect(framed.length).toBe(1)
  expect(framed[0]?.props.height).toBeUndefined()
  expect((await desktop.findAll({ type: 'Text', text: /^SELECTED$/ })).length).toBe(1)
  expect(boxes.filter(one => one.props.borderStyle === 'single' && one.props.borderColor === DARK['text-1']).length).toBe(8)
  await desktop.unmount()

  // Terminal: a `single` line border and the four corner glyphs in text-1.
  const terminal = await mount($, 'terminal')
  for (const glyph of ['┌', '┐', '└', '┘']) {
    const found = await terminal.findAll({ type: 'Text', text: glyph })
    expect(found.length).toBe(1)
    expect(found[0]?.props.color).toBe(DARK['text-1'])
  }
  const bordered = (await terminal.findAll({ type: 'Box' })).filter(one => one.props.borderStyle === 'single' && one.props.borderColor === DARK.line && one.props.width === PANE.props.bodyColumns)
  expect(bordered.length).toBe(1)
  await terminal.unmount()
})

test('the chart takes 85% of the pane: a Raster of 0.85 x the columns, an Svg sized in pixels, never smaller than its slot', TREE, async ($, on) => {
  await populate($, on)
  for (const bodyColumns of [60, 100]) {
    const columns = Math.round(0.85 * bodyColumns)
    const terminal = await mount($, 'terminal', { scroll: { offset: 0, bodyRows: 200 } }, bodyColumns)
    expect((await terminal.find({ type: 'Raster' }))?.props).toMatchObject({ columns, rows: Math.floor(columns / 2) })
    await terminal.unmount()
  }
  // Short of room the terminal's chart shrinks rather than push the table out: still round, fewer columns.
  const capped = await mount($, 'terminal', { scroll: { offset: 0, bodyRows: 50 } }, 100)
  const small = (await capped.find({ type: 'Raster' }))?.props as { columns: number; rows: number }
  expect(small.columns).toBeLessThan(85)
  expect(small.columns).toBe(small.rows * 2)
  expect(small.rows).toBeGreaterThanOrEqual(7)
  await capped.unmount()

  // The desktop's chart is 85% of the pane wide at every width and height, given in pixels (an interactive Svg's frame has no size of its own), and drawn at that size.
  for (const bodyColumns of [60, 100, 140]) {
    for (const bodyRows of [40, 70]) {
      const desktop = await mount($, 'desktop', { scroll: { offset: 0, bodyRows } }, bodyColumns)
      const svg = await desktop.find({ type: 'Svg' })
      const px = Math.max(220, Math.round(0.85 * bodyColumns * 7.2))
      expect(svg?.props.width).toBe(px)
      expect(svg?.props.height).toBe(px)
      expect(String(svg?.props.source)).toContain(`viewBox="0 0 ${px} ${px}"`)
      await desktop.unmount()
    }
  }
})

test('the table, the selected panel and the strip show CODE · full name, the code in text-3', TREE, async ($, on) => {
  await populate($, on)
  const ui = await mount($, 'terminal')
  const codes = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).filter(one => one.props.color === DARK['text-3'])
  const before = (await codes(/^A\d\d ·$/)).length
  expect(before).toBeGreaterThan(0)
  expect((await ui.findAll({ type: 'Text', text: /^Explore · Scan docs$/ })).length).toBeGreaterThan(0)
  await ui.press({ key: 'row-id-Scan docs' })
  // The selected panel adds the code before the name, beside the table's.
  expect((await codes(/^A\d\d ·$/)).length).toBeGreaterThan(before)
  expect((await ui.findAll({ type: 'Text', text: /^Explore · Scan docs$/ })).length).toBeGreaterThan(1)
  await ui.unmount()
})

test('the selected panel\'s title carries the member\'s state glyph and tone, and a session its hexagon', TREE, async ($, on) => {
  await populate($, on)
  const ui = await mount($, 'terminal')
  expect((await ui.findAll({ type: 'Text', text: /^⬢$/ })).length).toBeGreaterThan(0)
  // A failed member: the failed glyph in red, beside the panel's own title.
  const before = (await ui.findAll({ type: 'Text', text: /^◆$/ })).length
  await ui.press({ key: 'row-id-review:tests' })
  const glyphs = await ui.findAll({ type: 'Text', text: /^◆$/ })
  // The panel adds two: its title's, and its State line's.
  expect(glyphs.length).toBe(before + 2)
  expect(glyphs.every(one => one.props.color === DARK.red)).toBe(true)
  await ui.unmount()
})

const LIST = { key: 'toggle-list', hotkey: 's' } as const
const labelOf = async (ui: { find: (q: Record<string, unknown>) => Promise<{ text?: string } | undefined> }, key: string) => (await ui.find({ type: 'Button', key }))?.text

test('the toggle hangs directly under THIS SESSION\'s row, indented like its members; `s` on the terminal; folded it leaves that row and the toggle', TREE, async ($, on) => {
  await populate($, on)
  const ui = await mount($, 'terminal')
  const has = async (pattern: RegExp) => (await ui.findAll({ type: 'Text', text: pattern })).length > 0
  const order = async () => (await ui.findAll({})).filter(one => one.type === 'Button').map(one => one.key)
  let keys = await order()
  const main = keys.find(key => String(key).startsWith('row-'))!
  // The first press of a row is THIS SESSION's; the toggle is the next Button, before any member's row.
  expect(keys[keys.indexOf(main) + 1]).toBe(LIST.key)
  expect(keys.indexOf(LIST.key)).toBeLessThan(keys.indexOf('row-id-Scan docs'))
  expect((await ui.find({ type: 'Button', key: LIST.key }))?.props.hotkey).toBe('s')
  expect(((await ui.find({ type: 'Button', key: LIST.key }))?.children?.[0] as { props: { color: string } }).props.color).toBe(DARK['line-strong'])
  expect(await labelOf(ui, LIST.key)).toBe('▾ HIDE')
  expect(await has(/^STEPS$/)).toBe(true)
  await ui.press({ key: LIST.key })
  // Folded: THIS SESSION's row and the toggle, with the counts; the table's head stays, everything under the toggle goes.
  keys = await order()
  expect(keys.filter(key => String(key).startsWith('row-'))).toEqual([main])
  expect(await ui.find({ key: 'row-id-Scan docs' })).toBeUndefined()
  expect(await labelOf(ui, LIST.key)).toMatch(/^▸ SHOW \d+ SESSIONS · \d+ AGENTS$/)
  expect(await has(/^STEPS$/)).toBe(true)
  // The rest of the panel stays.
  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  expect(await has(/^PROGRESS$/)).toBe(true)
  expect(await has(/^SELECTED$/)).toBe(true)
  await ui.unmount()
  // The state is an atom: a pane mounted afterwards draws it folded, and unfolds with the same toggle.
  const again = await mount($, 'terminal')
  expect(await labelOf(again, LIST.key)).toMatch(/^▸ SHOW/)
  await again.press({ key: LIST.key })
  expect(await again.find({ key: 'row-id-Scan docs' })).toBeDefined()
  expect(await labelOf(again, LIST.key)).toBe('▾ HIDE')
  await again.unmount()
  const desktop = await mount($, 'desktop')
  expect((await desktop.find({ type: 'Button', key: LIST.key }))?.props.hotkey).toBeUndefined()
  await desktop.unmount()
})

test('collapsing the list hands its rows to the chart: more chart rows at the same height', TREE, async ($, on) => {
  await populate($, on)
  const ui = await mount($, 'terminal', { scroll: { offset: 0, bodyRows: 56 } })
  const rowsOf = async () => ((await ui.find({ type: 'Raster' }))?.props as { rows: number }).rows
  const open = await rowsOf()
  await ui.press({ key: LIST.key })
  expect(await rowsOf()).toBeGreaterThan(open)
  await ui.unmount()
})

test('with nothing tracked the panel draws this session, idle, and says there is no subagent yet', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ui = await mount($, 'terminal')
  expect(await ui.find({ text: /^SESSIONS$/ })).toBeDefined()
  expect(await ui.find({ text: /^0 RUNNING$/ })).toBeDefined()
  expect(await ui.find({ text: /^THIS SESSION$/ })).toBeDefined()
  expect(await ui.find({ text: /No subagent yet/ })).toBeDefined()
  expect(await ui.find({ text: /^ IDLE$/ })).toBeDefined()
  // A lone session has nothing to fold, and no chart to draw (one arc).
  expect(await ui.find({ key: LIST.key })).toBeUndefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

// The accounting itself (pure): every part the layout draws is paid for, whatever the pane's height, width or surface.
const layoutOf = (over: Partial<Parameters<typeof sessionsLayout>[0]> = {}) => {
  const lines = over.lines ?? 15
  return sessionsLayout({ rows: 56, cols: 72, isTerminal: true, canChart: true, lines, shrink: budget => ({ lines: Math.min(lines, budget), apply: () => {} }), reservedRows: 0, ...over })
}

test('the layout never takes more rows than the pane has, folded or not, whatever its height, width, surface and the rows reserved above it', () => {
  const tight: number[] = []
  for (const isTerminal of [true, false]) {
    for (const cols of [40, 60, 100]) {
      for (const rows of [16, 30, 40, 46, 60, 120]) {
        for (const lines of [3, 15]) {
          for (const reservedRows of [0, 8, 20]) {
            for (const hasFold of [false, true]) {
              for (const isListCollapsed of hasFold ? [false, true] : [false]) {
                const layout = layoutOf({ rows, cols, isTerminal, lines, reservedRows, hasFold, isListCollapsed })
                // Wherever the chart is drawn the parts never exceed the pane, whatever is folded, the toggle line paid for.
                // A desktop's chart, KPI row and selected panel are never folded for height: its pane scrolls past them, so only a terminal's parts must fit.
                if (layout.hasChart && isTerminal) expect(layout.used <= rows).toBe(true)
                if (!isTerminal) expect(layout.hasKpi && layout.hasSelected).toBe(true)
                if (layout.hasChart && !isTerminal && layout.chartGap === 0) tight.push(layout.chartPx)
                if (!isTerminal) {
                  expect(layout.hasChart).toBe(true)
                  expect(layout.chartPx).toBe(Math.max(220, Math.round(0.85 * cols * 7.2)))
                  expect(layout.chartWidth).toBe(layout.chartPx)
                }
                // The strip's two rows are counted when the panel is not drawn.
                expect(layout.stripRows).toBe(layout.hasSelected ? 0 : 2)
                expect(layout.legendRows).toBe(Math.ceil(59 / (cols - 4)))
                // Nothing in the accounting is the board's.
                expect(layout).not.toHaveProperty('room')
              }
            }
          }
        }
      }
    }
  }
  // The tight tier never shrinks a desktop's chart: its markup is at least its slot.
  expect(tight.length).toBeGreaterThan(0)
  for (const px of tight) expect(px).toBeGreaterThanOrEqual(220)
})

test('the rows reserved above the panel are spent before the chart: the same pane, fewer chart rows', () => {
  // Rows to spare: the chart is at its share of the width either way, and the panel takes exactly what was reserved more.
  const roomy = layoutOf({ rows: 120 })
  const reserved = layoutOf({ rows: 120, reservedRows: 20 })
  expect(reserved.used).toBe(roomy.used + 20)
  expect(reserved.chartRows).toBe(roomy.chartRows)
  // Short of rows the reservation costs the chart and the parts that fold before it.
  const plain = layoutOf({ rows: 60 })
  const above = layoutOf({ rows: 60, reservedRows: 20 })
  expect(above.chartRows).toBeLessThan(plain.chartRows)
  expect(above.used).toBeLessThanOrEqual(60)
  expect(plain.hasKpi && plain.hasSelected).toBe(true)
  expect(above.hasKpi && above.hasSelected).toBe(false)
  // Nothing above a panel is the whole pane: a negative count is taken as none.
  expect(layoutOf({ rows: 120, reservedRows: -5 }).used).toBe(roomy.used)
})

test('collapsing the list gives the chart its rows in the accounting too: a folded list is this session\'s row, its blank line and the toggle', () => {
  const base = { rows: 56, hasFold: true }
  const expanded = layoutOf(base)
  const folded = layoutOf({ ...base, isListCollapsed: true })
  expect(folded.treeLines).toBe(3)
  expect(folded.chartRows).toBeGreaterThan(expanded.chartRows)
  expect(folded.used).toBeLessThanOrEqual(56)
})

test('the toggle line costs a short pane no chart: the tight tier pays for it with the blank line above THIS SESSION\'s row', () => {
  // 15 lines of heads and ledger tasks that cannot yield, with the toggle's line they are 16.
  const base = { rows: 32, shrink: () => ({ lines: 15, apply: () => {} }) }
  const withToggle = layoutOf({ ...base, hasFold: true })
  expect(withToggle.hasChart).toBe(true)
  expect(withToggle.headGap).toBe(0)
  expect(withToggle.used).toBeLessThanOrEqual(32)
  // Without a toggle there is nothing to pay for: the blank line stays.
  expect(layoutOf(base)).toMatchObject({ hasChart: true, headGap: 1 })
})

// task-orchestrator's run S01 as the engine holds it: three workers, all done.
const RUN = [
  { id: 'E1-engine', role: 'investigator', calls: 44, tokens: 817_000, ms: 104_000 },
  { id: 'E2-panels', role: 'investigator', calls: 26, tokens: 350_200, ms: 89_000 },
  { id: 'agent-3', role: 'tester', calls: 31, tokens: 2_500_000, ms: 312_000 },
] as const
// The kit loads an inline register without its closure: the run is a literal inside it.
const finished: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 1_000, status: 'done', startedAt: 1_000, observed: { model: 'claude-sonnet-5-5', effort: 'medium', at: 1_100 } }
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'E1-engine', role: 'investigator', objective: 'Read the engine', agentId: 'id-E1-engine', endedAt: 105_000 },
      { ...task, id: 'E2-panels', role: 'investigator', objective: 'Read the panels', agentId: 'id-E2-panels', endedAt: 90_000 },
      { ...task, id: 'agent-3', role: 'tester', objective: 'Test it', agentId: 'id-agent-3', startedAt: 238_000, endedAt: 550_000 },
    ])
    return next(e)
  })
}

test('the pane draws the screenshot of 2026-10-29: this session idle, ORCH BALANCED run S01 with three done agents, 3.7M tokens, 3/3 steps', { plugins: [{ name: 'task-orchestrator', register: finished }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  for (const one of RUN) {
    await $.agent.spawn({ prompt: 'p', description: one.id, subagentType: `task-orchestrator:${one.role}` } as AgentSpawnInput)
    for (let i = 0; i < one.calls; i++) await $.tool.call({ tool: 'Bash', command: 'ls', agentId: `id-${one.id}` })
    await $.turn.complete({ agentId: `id-${one.id}`, reason: 'end_turn', answer: '', durationMs: one.ms, isAborted: false, turnId: `t-${one.id}`, usage: usage(one.tokens) })
  }
  listed.value = RUN.map(one => ({ id: `id-${one.id}`, type: `task-orchestrator:${one.role}`, description: one.id, status: 'completed', name: one.id, spawnedBy: 'task-orchestrator' }) as AgentInfo)
  await clock.advance(549_000)
  const ui = await mount($, 'desktop')
  const nodes = await ui.findAll({ type: 'Text' })
  // The pane is read top to bottom with one cursor, so each part is found where it belongs:
  // a word that the SELECTED panel or the legend repeats cannot stand in for a part that is gone.
  // `seq` finds consecutive Texts (a string is exact, a RegExp is a test) at or after `from`.
  const seq = (from: number, want: (string | RegExp)[]) => {
    for (let at = from; at + want.length <= nodes.length; at++) {
      if (want.every((one, i) => (typeof one === 'string' ? nodes[at + i]?.text === one : one.test(nodes[at + i]?.text ?? '')))) return at
    }
    return -1
  }
  let cursor = 0
  const next = (label: string, want: (string | RegExp)[]) => {
    const at = seq(cursor, want)
    expect(at, `${label}: ${want.join(' | ')}`).toBeGreaterThan(-1)
    cursor = at + want.length
    return at
  }

  // The head: the title, then the running count.
  next('head', ['SESSIONS', '0 RUNNING'])

  // The KPI row: four blocks in order, each its label, its value and its unit or caption, adjacent.
  const progress = next('PROGRESS', ['PROGRESS', '100', ' %', '3/3 STEPS'])
  next('AGENTS', ['AGENTS', '3', '0 RUNNING'])
  const tokens = next('TOKENS', ['TOKENS', '3.7M', 'TOK'])
  const failed = next('FAILED', ['FAILED', '0'])
  for (const at of [progress, tokens, failed]) {
    expect(nodes[at]?.props).toMatchObject({ color: DARK['text-3'], size: 'caption' })
    expect(nodes[at + 1]?.props).toMatchObject({ color: DARK['text-1'], size: 'title', tabular: true })
  }
  expect(nodes[progress + 2]?.props.color).toBe(DARK['text-3'])
  expect(nodes[progress + 3]?.props.color).toBe(DARK['text-3'])
  expect(nodes[tokens + 2]?.props.color).toBe(DARK['text-3'])

  // The legend: a glyph and a word per state, in this order, as consecutive Texts in text-3.
  const legend = next('legend', ['●', ' RUNNING', '■', ' DONE', '◆', ' FAILED', '▲', ' BLOCKED', '□', ' QUEUED', '○', ' STOPPED'])
  for (let i = 1; i < 12; i += 2) expect(nodes[legend + i]?.props.color, `legend word ${nodes[legend + i]?.text}`).toBe(DARK['text-3'])

  // The selected panel is this session by default: its state, its duration and its exact token count.
  next('selected', ['SELECTED', '⬢', 'THIS SESSION', 'THIS SESSION', 'STATE', '□', ' IDLE'])
  next('selected progress', ['PROGRESS', /^▰+$/, '3/3', ' STEPS', '· 100%'])
  next('selected totals', ['DURATION', '00:09:09', 'TOKENS', '3,667,200', ' TOK', 'CHILDREN', '1'])

  // The table: its head, then THIS SESSION, the S01 run and its three agents, each row's steps, time and tokens beside its state,
  // and an agent's calls and tokens under it. The fold toggle hangs under THIS SESSION's row.
  next('table head', ['SESSION', 'STATE', 'STEPS', 'TIME', 'TOK'])
  next('THIS SESSION row', ['THIS SESSION', '□', ' IDLE', '3/3', '9m09s', '3.7M', '▾ HIDE'])
  next('S01 row', ['S01 ·', 'ORCH BALANCED', '■', ' DONE', '3/3', '9m09s', '3.7M'])
  next('E1-engine row', [/^E1-engine · investigator/, '■', ' DONE', '1/1', '1m44s', '817k', /^\s+44 CALLS · 817k TOK$/])
  next('E2-panels row', [/^E2-panels · investigator/, '■', ' DONE', '1/1', '1m29s', '350.2k', /^\s+26 CALLS · 350\.2k TOK$/])
  next('agent-3 row', [/^agent-3 · tester/, '■', ' DONE', '1/1', '5m12s', '2.5M', /^\s+31 CALLS · 2\.5M TOK$/])
  // Nothing is drawn after the last agent's caption but the mod's version, a desktop's alone.
  next('version', [/^AGENT-WATCH \d+\.\d+\.\d+$/])
  expect(nodes.length).toBe(cursor)

  // The sunburst: the centre is this session's name, state, steps and duration; each sector carries its label and its steps.
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  for (const centre of [/<text[^>]*>THIS SESSION<\/text>/, /<text[^>]*>□ IDLE<\/text>/, /<text[^>]*>3\/3<tspan[^>]*> STEPS<\/tspan><\/text>/, /<text[^>]*>00:09:09<\/text>/]) {
    expect(source).toMatch(centre)
  }
  expect(source).toMatch(/>S01<\/text><text[^>]*>3\/3<\/text>/)
  for (const agent of ['E1-engine', 'E2-panels', 'agent-3']) expect(source, agent).toMatch(new RegExp(`>${agent}</text><text[^>]*>1/1</text>`))
  expect((source.match(/>1\/1<\/text>/g) ?? []).length).toBe(3)
  await ui.unmount()
})

test('a desktop keeps the KPI row and the selected panel at any height and width: its pane scrolls, as it does for the chart', TREE, async ($, on) => {
  await populate($, on)
  // A wide default-height pane, as Compass's pane seats it under its board: the chart alone took these rows before.
  for (const [bodyRows, columns] of [[24, 120], [40, 100], [60, 160]] as const) {
    const ui = await mount($, 'desktop', { scroll: { offset: 0, bodyRows } }, columns)
    expect((await ui.findAll({ type: 'Text', text: /^PROGRESS$/ })).length).toBeGreaterThan(1)
    expect((await ui.findAll({ type: 'Text', text: /^SELECTED$/ })).length).toBeGreaterThan(0)
    await ui.unmount()
  }
})

test('a desktop prints the version under the table; a terminal does not', TREE, async ($, on) => {
  await populate($, on)
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  const desktop = await mount($, 'desktop')
  expect(await desktop.find({ text: `AGENT-WATCH ${VERSION}` })).toBeDefined()
  await desktop.unmount()
  const terminal = await mount($, 'terminal')
  expect(await terminal.find({ text: /^AGENT-WATCH / })).toBeUndefined()
  await terminal.unmount()
})
