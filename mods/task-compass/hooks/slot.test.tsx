import { expect, test } from 'claude-code/testing'
import type { EngineInterface, On, Register } from 'claude-code'

// The slot ADR-0048 clause 1 gives other mods: Compass's Pane hook calls
// `next(e)` and draws what comes back after its Sprints board, so a mod that
// hooks the same pane (agent-watch's Sessions panel) lands there whichever
// of the two loaded first. The contributor is an inline plugin named
// 'agent-watch'; the kit loads an inline register without its closure, so every
// value is a literal inside it.

const GOALS = `# Project

## Sprint 1 — Setup
- [x] Scaffold the mod

## Sprint 2 — Timeline
- [>] Draw the rails
`

const SURFACES = ['terminal', 'desktop'] as const

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

/** The engine beneath the mod: a .ai/GOALS.md kept in memory in /p. */
const engine = (on: On, base: boolean | 'engine' = true) => {
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
  // The test kit's base hook: what is drawn for the pane when nothing above it does. It draws nothing.
  // Without it the kit throws at the bottom of the chain, as the real engine might (unverified).
  if (!base) return
  // Core's own drawing, as the engine's types have the last hook answer: what next(e) resolves to for the innermost hook.
  if (base === 'engine') {
    on('ui.render', { component: 'Pane', requestId: 'task-compass' }, () => ({ type: 'engine', ref: 0 }) as never)
    return
  }
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
}

// agent-watch's side: hooks Compass's pane, calls next(e), appends CONTRIBUTED.
const contributor: Register = on => {
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const result = await next(e)

    return (
      <Box flexDirection="column">
        {result as never}
        <Text>CONTRIBUTED</Text>
      </Box>
    )
  })
}

// The tier orders the chain, outermost first (prepend, user, append): Compass is
// the `user` tier, so a contributor beyond it is `prepend` and one beneath it `append`.
const AFTER_COMPASS = { name: 'agent-watch', tier: 'append', register: contributor } as const
const BEFORE_COMPASS = { name: 'agent-watch', tier: 'prepend', register: contributor } as const

/** The pane's text in document order. */
const order = async (ui: Awaited<ReturnType<EngineInterface['ui']['mount']>>) =>
  (await ui.findAll({ type: 'Text' })).map(one => String(one.text))

const BASE = "next(e) stands for the test kit's base hook; the real engine's base for a pane nobody else draws is unverified"

for (const surface of SURFACES) {
  for (const [label, plugin] of [
    ['compass first, then the contributor', AFTER_COMPASS],
    // This case cannot detect a Compass that never calls next(e): the contributor wraps Compass, so its CONTRIBUTED
    // line is drawn whatever Compass does with next(e). Only the AFTER case, where Compass calls next(e), can.
    ['the contributor first, then compass', BEFORE_COMPASS],
  ] as const) {
    test(`${label}: the pane shows the board, then what the contributor drew (${surface})`, { plugins: [plugin] }, async ($, on) => {
      engine(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      const ui = await $.ui.mount({ ...PANE, surface })
      const texts = await order(ui)
      const board = texts.findIndex(text => /Draw the rails/.test(text))
      expect(board).toBeGreaterThanOrEqual(0)
      expect(texts).toContain('CONTRIBUTED')
      expect(board).toBeLessThan(texts.indexOf('CONTRIBUTED'))
      await ui.unmount()
    })
  }

  test(`with no contributor the pane shows the board alone and does not error; ${BASE} (${surface})`, async ($, on) => {
    engine(on)
    await $.session.start({ cwd: '/p', surface, isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Draw the rails/ })).toBeDefined()
    expect(await ui.find({ text: /CONTRIBUTED/ })).toBeUndefined()
    await ui.unmount()
  })

  test(`with nothing beneath compass's hook (the kit rejecting next(e)) the board still draws, with no contribution (${surface})`, async ($, on) => {
    engine(on, false)
    await $.session.start({ cwd: '/p', surface, isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Draw the rails/ })).toBeDefined()
    await ui.unmount()
  })
  test(`with core's own drawing beneath compass's hook (type engine) the board draws and the element is left out (${surface})`, async ($, on) => {
    const logged: string[] = []
    on('ui.log', (_, e) => {
      if (e.to === 'debug') logged.push(e.text)
      return { value: undefined }
    })
    engine(on, 'engine')
    await $.session.start({ cwd: '/p', surface, isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /Draw the rails/ })).toBeDefined()
    expect(await ui.findAll({ type: 'engine' })).toHaveLength(0)
    expect(logged).toContain('task-compass: next(e) resolved object (type engine)')
    await ui.unmount()
  })
}
