import { expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, EngineInterface, On, Register } from 'claude-code'

import { COMPASS_PANE } from './view'

// The Sessions panel contributed to Compass's pane (ADR-0048):
// agent-watch hooks the pane `task-compass` by its request id, calls `next(e)`
// and draws the meter, then the panel, after what comes back. Compass is modelled by an inline
// plugin of that name (the kit loads an inline register without its closure,
// so every value is a literal inside it).

const SURFACES = ['terminal', 'desktop'] as const

const mountProps = (requestId: string, surface: (typeof SURFACES)[number], plugin: string) =>
  ({
    plugin,
    component: 'Pane',
    requestId,
    surface,
    props: {
      title: 'Board',
      isFocused: false,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 90 },
      view: {},
    },
  }) as const

// Compass's side: draws BOARD, calls next(e), returns the board and the result.
const compass: Register = on => {
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const rest = await next(e)

    return (
      <Box flexDirection="column">
        <Text>BOARD</Text>
        {rest as never}
      </Box>
    )
  })
}

// A compass-like pane that draws its board and never calls next(e).
const compassWithoutNext: Register = on => {
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text>BOARD</Text>
      </Box>
    )
  })
}

// The tier orders the chain, outermost first (prepend, user, append): agent-watch
// is the `user` tier, so a Compass beyond it is `prepend` and one beneath it `append`.
const COMPASS_FIRST = { name: 'task-compass', tier: 'prepend', register: compass } as const
const COMPASS_SECOND = { name: 'task-compass', tier: 'append', register: compass } as const
const BARE_FIRST = { name: 'task-compass', tier: 'prepend', register: compassWithoutNext } as const

/** The engine beneath the mods: a list of agents the test moves. */
const engine = (on: On, listed: { value: AgentInfo[] }, base: boolean | 'engine' = true) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.view', () => ({ value: {} }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('classic.SubagentStop', () => ({}))
  on('agent.list', () => ({ value: listed.value }))
  on('agent.spawn', (_, e) => ({ model: 'm', agentId: `id-${e.description}` }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', () => ({ turnId: 't' }))
  on('tool.call', () => ({ result: {} }))
  // What the engine draws for a pane no plugin answers: the bottom of the chain.
  // Without it the kit throws there, as the real engine might (unverified).
  if (!base) return
  // Core's own drawing, as the engine's types have the last hook answer: what next(e) resolves to for the innermost hook.
  if (base === 'engine') {
    on('ui.render', { component: 'Pane', requestId: 'task-compass' }, () => ({ type: 'engine', ref: 0 }) as never)
    return
  }
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>ENGINE</Text>
  })
}

/** A session with one running agent, tracked through agent-watch's own hooks. */
const populate = async ($: EngineInterface, on: On, base: boolean | 'engine' = true, { plan = false, agent = true } = {}) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed, base)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  if (plan) {
    await $.tool.call({
      tool: 'mcp__ccd_turn__update_plan',
      items: [
        { content: 'Write the model', status: 'completed' },
        { content: 'Draw the meter', status: 'in_progress' },
        { content: 'Test it', status: 'pending' },
      ],
    } as never)
  }
  if (agent) {
    await $.agent.spawn({ prompt: 'p', description: 'Scan docs', subagentType: 'Explore' } as AgentSpawnInput)
    listed.value = [{ id: 'id-Scan docs', type: 'Explore', description: 'Scan docs', status: 'running' }]
  }
  await clock.advance(2_000)
}

const has = async (ui: Awaited<ReturnType<EngineInterface['ui']['mount']>>, pattern: RegExp) => (await ui.find({ text: pattern })) !== undefined

/** The pane's text in document order, for BOARD-before-SESSIONS. */
const order = async (ui: Awaited<ReturnType<EngineInterface['ui']['mount']>>) =>
  (await ui.findAll({ type: 'Text' })).map(one => String(one.text))

test('the Compass pane is the id agent-watch hooks, pinned: renaming it breaks the slot silently', () => {
  expect(COMPASS_PANE).toBe('task-compass')
})

for (const surface of SURFACES) {
  test(`compass first, then agent-watch: the Compass pane shows BOARD, then SESSIONS and the agents (${surface})`, { plugins: [COMPASS_FIRST] }, async ($, on) => {
    await populate($, on)
    const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
    const texts = await order(ui)
    expect(texts).toContain('BOARD')
    expect(await has(ui, /^SESSIONS$/)).toBe(true)
    expect(await has(ui, /Explore · Scan docs/)).toBe(true)
    expect(texts.indexOf('BOARD')).toBeLessThan(texts.indexOf('SESSIONS'))
    await ui.unmount()
  })

  for (const [label, compassPlugin] of [['compass first', COMPASS_FIRST], ['agent-watch first', COMPASS_SECOND]] as const) {
    test(`the meter sits between BOARD and SESSIONS when a task list exists, ${label} (${surface})`, { plugins: [compassPlugin] }, async ($, on) => {
      await populate($, on, true, { plan: true })
      const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
      const texts = await order(ui)
      const meter = texts.findIndex(text => /^1\/3$/.test(text))
      expect(meter).toBeGreaterThan(-1)
      expect(texts.some(text => /Draw the meter/.test(text))).toBe(true)
      expect(texts.indexOf('BOARD')).toBeLessThan(meter)
      expect(meter).toBeLessThan(texts.indexOf('SESSIONS'))
      await ui.unmount()
    })

    test(`no meter in Compass's pane while there is no task list and nothing runs, ${label} (${surface})`, { plugins: [compassPlugin] }, async ($, on) => {
      await populate($, on, true, { agent: false })
      const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
      expect(await has(ui, /^BOARD$/)).toBe(true)
      expect(await has(ui, /^SESSIONS$/)).toBe(true)
      expect(await ui.find({ type: 'Text', text: /^▰+$/ })).toBeUndefined()
      await ui.unmount()
    })
  }

  test(`agent-watch first, then compass: the Compass pane shows BOARD, then SESSIONS and the agents (${surface})`, { plugins: [COMPASS_SECOND] }, async ($, on) => {
    await populate($, on)
    const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
    const texts = await order(ui)
    expect(texts).toContain('BOARD')
    expect(await has(ui, /^SESSIONS$/)).toBe(true)
    expect(await has(ui, /Explore · Scan docs/)).toBe(true)
    expect(texts.indexOf('BOARD')).toBeLessThan(texts.indexOf('SESSIONS'))
    await ui.unmount()
  })

  for (const [label, compassPlugin] of [['compass first', COMPASS_FIRST], ['agent-watch first', COMPASS_SECOND]] as const) {
    test(`pressing a row in the contributed panel selects it and redraws the panel inside Compass's pane, ${label} (${surface})`, { plugins: [compassPlugin] }, async ($, on) => {
      await populate($, on)
      const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
      const sessions = async () => (await ui.findAll({ type: 'Text', text: /^THIS SESSION$/ })).length
      const before = await sessions()
      expect(before).toBeGreaterThan(1)
      expect(await has(ui, /^THIS SESSION \/ Explore · Scan docs$/)).toBe(false)
      await ui.press({ key: 'row-id-Scan docs', plugin: 'agent-watch' })
      // The row is selected: the panel names it, and the board is still above it.
      expect(await has(ui, /^THIS SESSION \/ Explore · Scan docs$/)).toBe(true)
      expect(await sessions()).toBeLessThan(before)
      expect(await has(ui, /^BOARD$/)).toBe(true)
      expect(await has(ui, /^SESSIONS$/)).toBe(true)
      await ui.unmount()
    })
  }

  test(`without Compass, agent-watch's own pane draws the panel and nothing errors (${surface})`, async ($, on) => {
    await populate($, on)
    const ui = await $.ui.mount(mountProps('agent-watch', surface, 'agent-watch'))
    expect(await has(ui, /^SESSIONS$/)).toBe(true)
    expect(await has(ui, /Explore · Scan docs/)).toBe(true)
    expect(await has(ui, /^BOARD$/)).toBe(false)
    await ui.unmount()
  })
}

test('known limit: a Compass pane that loads first and does not call next(e) hides the contribution', { plugins: [BARE_FIRST] }, async ($, on) => {
  await populate($, on)
  const ui = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  expect(await has(ui, /^BOARD$/)).toBe(true)
  expect(await has(ui, /^SESSIONS$/)).toBe(false)
  await ui.unmount()
})

test("with nothing beneath agent-watch's hook, next(e) rejects, the panel still draws alone and the debug log says why", async ($, on) => {
  const logged: { text: string; to: string }[] = []
  on('ui.log', (_, e) => {
    logged.push({ text: e.text, to: e.to })
    return { value: undefined }
  })
  await populate($, on, false)
  const ui = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  expect(await has(ui, /^SESSIONS$/)).toBe(true)
  expect(await has(ui, /Explore · Scan docs/)).toBe(true)
  // The error is hidden from the screen, not from the debug log.
  expect(logged.length).toBeGreaterThan(0)
  expect(logged.every(one => one.to === 'debug' && /^agent-watch: next\(e\) rejected: /.test(one.text))).toBe(true)
  await ui.unmount()
})

test('the debug log says what next(e) resolved to, once while it stays the same', { plugins: [COMPASS_FIRST] }, async ($, on) => {
  const logged: string[] = []
  on('ui.log', (_, e) => {
    if (e.to === 'debug') logged.push(e.text)
    return { value: undefined }
  })
  await populate($, on)
  const first = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  await first.unmount()
  const second = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  await second.unmount()
  // What Compass's hook resolved to is one line, however often the pane draws.
  expect(logged.filter(text => /^agent-watch: next\(e\) resolved /.test(text)).length).toBe(1)
  expect(logged.some(text => /\(type [A-Za-z]+\)/.test(text))).toBe(true)
})

test("core's own drawing beneath agent-watch's hook (type engine) is left out: the panel draws and the log names its type", { plugins: [COMPASS_FIRST] }, async ($, on) => {
  const logged: string[] = []
  on('ui.log', (_, e) => {
    if (e.to === 'debug') logged.push(e.text)
    return { value: undefined }
  })
  await populate($, on, 'engine', { plan: true })
  const ui = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  const texts = await order(ui)
  expect(texts).toContain('BOARD')
  expect(await has(ui, /^SESSIONS$/)).toBe(true)
  expect(await ui.findAll({ type: 'engine' })).toHaveLength(0)
  expect(logged).toContain('agent-watch: next(e) resolved object (type engine)')
  await ui.unmount()
})
