import { expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, EngineInterface, On, Register } from 'claude-code'

import { engine as shared } from '../preview/fixtures'

// The resize handle under the Sessions panel in Compass's pane (ADR-0052): a
// `Client` agent-watch draws after its panel where the surface's table has
// one, whose drags hold the panel at a height, per surface, fed into the
// panel's own row budget (`sessionsLayout`), until a double press lets it go.
// Compass is an inline plugin of that name, as in contribution.test.tsx.

const HANDLE = 'sessions-handle'

const mountProps = (requestId: string, surface: 'terminal' | 'desktop' | 'mobile' | 'vscode', plugin: string) =>
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
const COMPASS = { name: 'task-compass', tier: 'prepend', register: compass } as const

type Mounted = Awaited<ReturnType<EngineInterface['ui']['mount']>>

/** A session with one running agent and a second session, so the panel has a chart to draw. */
const populate = async ($: EngineInterface, on: On) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  shared(on, listed)
  on('ui.message', () => ({}))
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
  on('ui.render', { component: 'Pane', requestId: 'agent-watch' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'p', description: 'Scan docs', subagentType: 'Explore' } as AgentSpawnInput)
  await $.agent.spawn({ prompt: 'p', description: 'Write tests', subagentType: 'general-purpose' } as AgentSpawnInput)
  listed.value = [
    { id: 'id-Scan docs', type: 'Explore', description: 'Scan docs', status: 'running' },
    { id: 'id-Write tests', type: 'general-purpose', description: 'Write tests', status: 'running' },
  ]
  await clock.advance(2_000)
}

/** The height the panel's content is held and cut at; undefined while it sizes itself. */
const heldBody = async (ui: Mounted) => ((await ui.find({ key: 'sessions-handle-body' }))?.props as { height?: number } | undefined)?.height

/** The rows the handle is told the panel takes. */
const handleRows = async (ui: Mounted) => ((await ui.find({ key: HANDLE }))?.props as { props?: { rows?: number } } | undefined)?.props?.rows

const drag = async (ui: Mounted, to: number) => {
  await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
  await ui.pointer({ type: 'move', x: 10, y: to, button: 'left', in: HANDLE })
  await ui.pointer({ type: 'up', x: 10, y: to, button: 'left', in: HANDLE })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a drag on the handle under the Sessions panel holds it at the rows dragged to, and a double press lets it go (${surface})`, { plugins: [COMPASS] }, async ($, on) => {
    await populate($, on)
    const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
    expect(await ui.find({ type: 'Client', key: HANDLE })).toBeDefined()
    expect(await heldBody(ui)).toBeUndefined()
    const auto = (await handleRows(ui))!
    expect(auto).toBeGreaterThan(12)

    await drag(ui, 5)
    // Held at the body's rows plus the drag.
    expect(await handleRows(ui)).toBe(auto + 5)
    expect(await heldBody(ui)).toBe(auto + 5)

    await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    expect(await heldBody(ui)).toBeUndefined()
    expect(await handleRows(ui)).toBe(auto)
    await ui.unmount()
  })

  test(`a drag never holds the Sessions panel under 12 rows, its body 8 (${surface})`, { plugins: [COMPASS] }, async ($, on) => {
    await populate($, on)
    const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
    await drag(ui, -200)
    expect(await heldBody(ui)).toBe(12 - 4)
    await ui.unmount()
  })
}

test("the held rows are the panel's row budget: a terminal panel dragged small folds its chart, as a short pane does", { plugins: [COMPASS] }, async ($, on) => {
  await populate($, on)
  const ui = await $.ui.mount(mountProps('task-compass', 'terminal', 'task-compass'))
  expect(await ui.find({ type: 'Raster', key: 'sunburst' })).toBeDefined()
  await drag(ui, -200)
  expect(await ui.find({ type: 'Raster', key: 'sunburst' })).toBeUndefined()
  await ui.unmount()
})

test("a height held on one surface leaves the other's panel sizing itself", { plugins: [COMPASS] }, async ($, on) => {
  await populate($, on)
  const term = await $.ui.mount(mountProps('task-compass', 'terminal', 'task-compass'))
  await drag(term, 6)
  expect(await heldBody(term)).toBeDefined()
  await term.unmount()
  const desk = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  expect(await heldBody(desk)).toBeUndefined()
  await desk.unmount()
})

test("agent-watch's own Agents pane has the handle too, and its height is its own, apart from Compass's pane", { plugins: [COMPASS] }, async ($, on) => {
  await populate($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const own = await $.ui.mount(mountProps('agent-watch', surface, 'agent-watch'))
    expect(await own.find({ type: 'Client', key: HANDLE })).toBeDefined()
    await drag(own, -200)
    expect(await heldBody(own)).toBe(8)
    await own.unmount()
    const compass = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
    expect(await heldBody(compass)).toBeUndefined()
    await compass.unmount()
  }
})

for (const surface of ['mobile', 'vscode'] as const) {
  test(`${surface} has no Client: no handle under the Sessions panel, which sizes itself`, { plugins: [COMPASS] }, async ($, on) => {
    await populate($, on)
    const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
    expect(await ui.find({ text: /^SESSIONS$/ })).toBeDefined()
    expect(await ui.findAll({ type: 'Client' })).toHaveLength(0)
    expect(await heldBody(ui)).toBeUndefined()
    await ui.unmount()
  })
}

test('the handle lies on the panel frame: a terminal redraws the bottom edge around the grip, a desktop draws a bar at the foot of the row', { plugins: [COMPASS] }, async ($, on) => {
  await populate($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(mountProps('task-compass', surface, 'task-compass'))
    expect((await ui.find({ key: 'sessions-handle-slot' }))?.props).toMatchObject({ position: 'absolute', bottom: 0, left: 0, height: 1 })
    const drawn = JSON.stringify(await ui.drawn({ in: HANDLE }))
    if (surface === 'terminal') {
      expect(drawn).toContain('└─')
      expect(drawn).toContain('─┘')
    } else {
      expect(drawn).not.toContain('└')
      expect(await ui.find({ key: 'sessions-handle-bar' })).toBeDefined()
    }
    await ui.unmount()
  }
})

test('on a desktop a held panel shorter than its content is cut, not grown: the content takes the held rows and hides the rest', { plugins: [COMPASS] }, async ($, on) => {
  await populate($, on)
  const ui = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  await drag(ui, -200)
  expect((await ui.find({ key: 'sessions-handle-body' }))?.props).toMatchObject({ height: 8, overflow: 'hidden' })
  expect(await ui.find({ type: 'Client', key: HANDLE })).toBeDefined()
  await ui.unmount()
})

test('on a desktop the hint is a hover reveal one row above the handle, centred over the bar; a terminal says it in the edge', { plugins: [COMPASS] }, async ($, on) => {
  await populate($, on)
  const desk = await $.ui.mount(mountProps('task-compass', 'desktop', 'task-compass'))
  const slot = JSON.stringify(await desk.find({ key: 'sessions-handle-slot' }))
  expect(slot).toContain('"display":"none"')
  expect(slot).toContain('"bottom":1')
  expect(slot).toContain('"borderStyle":"single"')
  expect(slot).toContain('"backgroundColor"')
  expect(slot).toContain('DRAG ↕ TO SIZE')
  await desk.unmount()
  const term = await $.ui.mount(mountProps('task-compass', 'terminal', 'task-compass'))
  expect(JSON.stringify(await term.find({ key: 'sessions-handle-slot' }))).not.toContain('DRAG ↕')
  await term.unmount()
})
