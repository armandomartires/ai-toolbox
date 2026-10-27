import { expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, On } from 'claude-code'

const PANE = {
  plugin: 'agent-watch',
  component: 'Pane',
  requestId: 'agent-watch',
  props: {
    title: 'Agents',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

/** The engine beneath the mod: a list of agents the test moves. */
const engine = (on: On, listed: { value: AgentInfo[] }) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.view', () => ({ value: {} }))
  on('agent.list', () => ({ value: listed.value }))
  on('agent.spawn', (_, e) => ({ model: 'm', agentId: `id-${e.description}` }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
}

test('the pane shows a spawned agent under Running, then under Completed', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)

  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'running' }]
  await clock.advance(12_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/Running  1/)).toBeDefined()
    expect(await text(/Explore · Find hooks/)).toBeDefined()
    expect(await text(/12s/)).toBeDefined()
    expect(await text(/None has finished yet/)).toBeDefined()
    // The icon, in the agent's own color, sits outside the name's Button,
    // and the name carries the same color.
    expect((await ui.find({ type: 'Text', text: /●/ }))?.props.color).toBe('suggestion')
    expect((await ui.find({ type: 'Button', text: /Find hooks/ }))?.text).not.toContain('●')
    expect((await ui.find({ type: 'Text', text: /Find hooks/ }))?.props.color).toBe('suggestion')
    expect((await ui.findAll({ type: 'Box' }))[0]?.props.minHeight).toBe(30)
    await ui.unmount()
  }

  // While it runs the icon pulses: solid, then hollow one frame later.
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const icon = async () => (await ui.find({ type: 'Text', text: /^[●○] $/ }))?.text
    const first = await icon()
    await clock.advance(400)
    const second = await icon()
    expect(first).not.toBe(second)
    expect(['● ', '○ ']).toContain(first)
    expect(['● ', '○ ']).toContain(second)
    await ui.unmount()
  }

  // The agent ends: its turn.complete refreshes the list, and the row moves.
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'completed' }]
  await $.turn.complete({ agentId: 'id-Find hooks', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't1' })
  await clock.advance(5_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
  expect(await text(/No subagent is running/)).toBeDefined()
  expect(await text(/Completed  1/)).toBeDefined()
  // Elapsed stops at the end, 12s after the spawn, not 17s.
  expect(await text(/ 12s/)).toBeDefined()
  expect(await text(/ 17s/)).toBeUndefined()
  // Ended: the icon is solid and still, with its outcome mark.
  expect(await text(/✓/)).toBeDefined()
  await clock.advance(400)
  expect((await ui.find({ type: 'Text', text: /^[●○] $/ }))?.text).toBe('● ')
  await ui.unmount()
})

const BAND = {
  plugin: 'agent-watch',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 } },
} as const

/** A call to one of the desktop app's tools, which the engine may not type. */
type AppTool = never

test('the band shows the task list as a bar and the running agents, and nothing without either', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('tool.call', () => ({ result: {} }))
  // Beneath the mod the engine draws its own band: here, one marked Text.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })

  // Nothing tracked: the band is left to the engine.
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()

  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Write the model', status: 'completed' },
      { content: 'Draw the band', status: 'in_progress' },
      { content: 'Test it', status: 'pending' },
    ],
  } as AppTool)
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'running' }]
  await clock.advance(1_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    ui = await $.ui.mount({ ...BAND, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^▰+▱+$/)).toBe('▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱')
    expect(await text(/1\/3/)).toBeDefined()
    expect(await text(/Draw the band/)).toBeDefined()
    expect(await text(/1 running/)).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^[●○] $/ }))?.props.color).toBe('suggestion')
    await ui.unmount()
  }

  // wrap_up ticks every step off; the bar turns green and says so.
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ text: /^▰+$/ }))?.props.color).toBe('success')
  expect(await ui.find({ text: /all done/ })).toBeDefined()
  await ui.unmount()

  // A survey holds the band.
  ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})

test('/agent-watch opens the pane', async ($, on) => {
  mock.clock(on)
  engine(on, { value: [] })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: false })
  const { text } = await $.command.run({ command: 'agent-watch', args: '' } as never)
  expect(text).toBe('Agents pane opened.')
})
