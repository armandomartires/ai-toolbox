import { expect, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

// The resize handle under the Sprints panel (ADR-0052): a `Client` the board
// draws where the surface's table has one, whose drags hold the board's
// columns at a height, per surface, until a double press lets them go.

const GOALS = `# Project

## Sprint 1 — Setup
- [x] Scaffold the mod

## Sprint 2 — Timeline
- [>] Draw the rails
- [ ] Draw the cards
`

const PANE = {
  plugin: 'task-compass',
  component: 'Pane',
  requestId: 'task-compass',
  props: {
    title: 'Compass',
    isFocused: false,
    bodyColumns: 76,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const HANDLE = 'sprints-handle'

/** The engine beneath the mod: a .ai/GOALS.md kept in memory in /p. */
const engine = (on: On) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__task-compass__${e.name}` } }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('classic.CwdChanged', () => ({}))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.stat', (_, e) => {
    if (!/[\\/]p[\\/]\.ai[\\/]GOALS\.md$/.test(e.path)) throw new Error('ENOENT')
    return { value: { kind: 'file', size: GOALS.length, mtimeMs: 1, isLink: false } }
  })
  on('fs.read', () => ({ value: GOALS }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.message', () => ({}))
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
}

type Mounted = Awaited<ReturnType<EngineInterface['ui']['mount']>>

/** The height the board's columns are held at; undefined while they size themselves. */
const heldAt = async (ui: Mounted) => ((await ui.find({ key: 'sprint-columns' }))?.props as { height?: number } | undefined)?.height

/** The rows the handle is told the columns take. */
const handleRows = async (ui: Mounted) => ((await ui.find({ key: HANDLE }))?.props as { props?: { rows?: number } } | undefined)?.props?.rows

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a drag on the handle under the board holds its columns at the rows dragged to, and a double press lets them go (${surface})`, async ($, on) => {
    engine(on)
    await $.session.start({ cwd: '/p', surface, isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Client', key: HANDLE })).toBeDefined()
    expect(await heldAt(ui)).toBeUndefined()
    // Automatic: the longest column as drawn (Sprint 2: header, progress, its fold toggle and two stories, or so), what a drag starts from.
    const auto = (await handleRows(ui))!
    expect(auto).toBeGreaterThan(0)

    await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'move', x: 10, y: 9, button: 'left', in: HANDLE })
    expect(await heldAt(ui)).toBe(auto + 9)
    expect(await handleRows(ui)).toBe(auto + 9)
    await ui.pointer({ type: 'up', x: 10, y: 9, button: 'left', in: HANDLE })
    expect(await heldAt(ui)).toBe(auto + 9)

    // A double press: back to automatic.
    await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    expect(await heldAt(ui)).toBeUndefined()
    expect(await handleRows(ui)).toBe(auto)
    await ui.unmount()
  })

  test(`a drag never holds the board under its floor of 6 rows, and up and down nudge it a row (${surface})`, async ($, on) => {
    engine(on)
    await $.session.start({ cwd: '/p', surface, isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'move', x: 10, y: -40, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'up', x: 10, y: -40, button: 'left', in: HANDLE })
    expect(await heldAt(ui)).toBe(6)
    await ui.key({ key: 'down', in: HANDLE })
    await ui.key({ key: 'down', in: HANDLE })
    await ui.key({ key: 'up', in: HANDLE })
    expect(await heldAt(ui)).toBe(7)
    await ui.key({ key: 'r', in: HANDLE })
    expect(await heldAt(ui)).toBeUndefined()
    await ui.unmount()
  })
}

test('a terminal measures a drag from where the handle now is, a desktop from where it was at the press', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  for (const [surface, back] of [
    // Down 10, then back up 4: the terminal's region moved down 10 with the board, so the pointer is at -4 there; a desktop says 6.
    ['terminal', -4],
    ['desktop', 6],
  ] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const auto = (await handleRows(ui))!
    await ui.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'move', x: 10, y: 10, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'move', x: 10, y: back, button: 'left', in: HANDLE })
    await ui.pointer({ type: 'up', x: 10, y: back, button: 'left', in: HANDLE })
    expect(await heldAt(ui)).toBe(auto + 6)
    await ui.unmount()
  }
})

test("a height held on one surface leaves the other's board sizing itself", async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await term.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
  await term.pointer({ type: 'move', x: 10, y: 12, button: 'left', in: HANDLE })
  await term.pointer({ type: 'up', x: 10, y: 12, button: 'left', in: HANDLE })
  expect(await heldAt(term)).toBeDefined()
  await term.unmount()
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await heldAt(desk)).toBeUndefined()
  await desk.unmount()
})

for (const surface of ['mobile', 'vscode'] as const) {
  test(`${surface} has no Client: no handle, and a held height does not apply there`, async ($, on) => {
    engine(on)
    await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
    // Held on the terminal first, so a surface that ignored the surface key would show it.
    const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await term.pointer({ type: 'down', x: 10, y: 0, button: 'left', in: HANDLE })
    await term.pointer({ type: 'move', x: 10, y: 12, button: 'left', in: HANDLE })
    await term.unmount()
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.findAll({ type: 'Client' })).toHaveLength(0)
    expect(await heldAt(ui)).toBeUndefined()
    expect(await ui.find({ text: /Draw the rails/ })).toBeDefined()
    await ui.unmount()
  })
}

test('the handle lies on the board frame: a terminal redraws the bottom edge around the grip, a desktop draws a bar at the foot of the row', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'sprints-handle-slot' }))?.props).toMatchObject({ position: 'absolute', bottom: 0, left: 0, height: 1, width: 76 })
    const drawn = JSON.stringify(await ui.drawn({ in: HANDLE }))
    if (surface === 'terminal') expect(drawn).toContain('└─')
    else expect(await ui.find({ key: 'sprints-handle-bar' })).toBeDefined()
    await ui.unmount()
  }
})
