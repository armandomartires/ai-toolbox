import { expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, ConfigRow, On } from 'claude-code'

import { TOKENS } from './sigma'

const DARK = TOKENS.dark

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

/** What the mod said to the engine's UI: toasts, status-line texts, views, pane opens. */
type Said = { toasts: string[]; statuses: (string | undefined)[]; views: unknown[]; opens: string[] }

/** The engine beneath the mod: a list of agents the test moves, and what the mod said. */
const engine = (on: On, listed: { value: AgentInfo[] }): Said => {
  const said: Said = { toasts: [], statuses: [], views: [], opens: [] }
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => {
    said.opens.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.view', (_, e) => {
    said.views.push(e)
    return { value: {} }
  })
  on('ui.toast', (_, e) => {
    said.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    said.statuses.push(e.text)
    return { value: undefined }
  })
  on('classic.SubagentStop', () => ({}))
  on('agent.list', () => ({ value: listed.value }))
  on('agent.spawn', (_, e) => ({ model: 'm', agentId: `id-${e.description}` }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  return said
}

const STOP = { stop_hook_active: false, agent_id: 'id-Find hooks', agent_transcript_path: '/t', agent_type: 'Explore' }

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
    expect(await text(/^SUBAGENTS$/)).toBeDefined()
    expect(await text(/^RUNNING  1$/)).toBeDefined()
    expect(await text(/Explore · Find hooks/)).toBeDefined()
    expect(await text(/12s/)).toBeDefined()
    expect(await text(/None has finished yet/)).toBeDefined()
    // The glyph, the agent's own, sits outside the name's Button, in the
    // colour of its state: cyan while it runs. The name is text-1.
    expect((await ui.find({ type: 'Text', text: /■/ }))?.props.color).toBe(DARK.cyan)
    expect((await ui.find({ type: 'Button', text: /Find hooks/ }))?.text).not.toContain('■')
    expect((await ui.find({ type: 'Text', text: /Find hooks/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.findAll({ type: 'Text' })).filter(t => t.props.dimColor || (t.props.bold && !t.props.weight)).length).toBe(0)
    expect((await ui.findAll({ type: 'Box' }))[0]?.props.minHeight).toBe(30)
    await ui.unmount()
  }

  // While it runs the icon pulses: solid, then hollow one frame later.
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const icon = async () => (await ui.find({ type: 'Text', text: /^[■□] $/ }))?.text
    const first = await icon()
    await clock.advance(400)
    const second = await icon()
    expect(first).not.toBe(second)
    expect(['■ ', '□ ']).toContain(first)
    expect(['■ ', '□ ']).toContain(second)
    await ui.unmount()
  }

  // The agent ends: its turn.complete refreshes the list, and the row moves.
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'completed' }]
  await $.turn.complete({ agentId: 'id-Find hooks', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't1' })
  await clock.advance(5_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
  expect(await text(/No subagent is running/)).toBeDefined()
  expect(await text(/^COMPLETED  1$/)).toBeDefined()
  // Elapsed stops at the end, 12s after the spawn, not 17s.
  expect(await text(/ 12s/)).toBeDefined()
  expect(await text(/ 17s/)).toBeUndefined()
  // Ended: the glyph is solid and still, in text-1; a completed row carries no badge.
  expect(await text(/FAILED|STOPPED/)).toBeUndefined()
  await clock.advance(400)
  const done = await ui.find({ type: 'Text', text: /^[■□] $/ })
  expect([done?.text, done?.props.color]).toEqual(['■ ', DARK['text-1']])
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
    const on = await ui.find({ type: 'Text', text: /^▰+$/ })
    expect([on?.text, on?.props.color]).toEqual(['▰▰▰▰▰▰▰', DARK.cyan])
    expect((await ui.find({ type: 'Text', text: /^▱+$/ }))?.props.color).toBe(DARK.line)
    expect((await ui.find({ type: 'Text', text: /^1\/3$/ }))?.props.tabular).toBe(true)
    expect(await text(/ STEPS/)).toBeDefined()
    expect(await text(/Draw the band/)).toBeDefined()
    expect(await text(/1 RUNNING/)).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^[■□] $/ }))?.props.color).toBe(DARK.cyan)
    await ui.unmount()
  }

  // wrap_up ticks every step off; the meter turns text-1 and says so.
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^▰+$/ }))?.props.color).toBe(DARK['text-1'])
  expect(await ui.find({ text: /ALL DONE/ })).toBeDefined()
  await ui.unmount()

  // A survey holds the band.
  ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})

test('the pane shows what a running agent is doing: its call, its calls, its tokens', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'running' }]

  const caption = async (surface: 'terminal' | 'desktop') => {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = (await ui.find({ type: 'Text', text: /^  \d+ CALLS?/ }))?.text
    await ui.unmount()
    return text
  }
  // No call yet: no caption.
  expect(await caption('terminal')).toBeUndefined()
  // The engine stub answers a call at once, so one call has ended.
  await $.tool.call({ tool: 'Bash', command: 'ls -la', agentId: 'id-Find hooks' })
  expect(await caption('terminal')).toBe('  1 CALL')
  await $.turn.complete({
    agentId: 'id-Find hooks',
    reason: 'answer',
    answer: 'done',
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' },
  })
  await clock.advance(1_000)
  for (const surface of ['terminal', 'desktop'] as const) expect(await caption(surface)).toBe('  1 CALL · 1.2k TOK')
})

test('a failed agent raises one toast, at once on SubagentStop', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  const said = engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'running' }]
  await clock.advance(1_000)
  expect(said.toasts).toEqual([])

  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'failed' }]
  await $.classic.SubagentStop(STOP)
  // No clock advance: the stop itself raised it.
  expect(said.toasts).toEqual(['EXPLORE · Find hooks · FAILED 00:00:01'])
  await clock.advance(5_000)
  await $.classic.SubagentStop(STOP)
  expect(said.toasts.length).toBe(1)
})

test('band buttons open the agent and the pane; the status line counts the running', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  const said = engine(on, listed)
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'Draw the band', status: 'in_progress' }] } as AppTool)
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'running' }]
  await clock.advance(1_000)
  expect(said.statuses).toEqual(['1 AGENT RUNNING'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const opensBefore = said.opens.length
    await ui.press({ key: 'band-agent-id-Find hooks' })
    expect(said.views).toContainEqual({ agentId: 'id-Find hooks' })
    await ui.press({ key: 'band-step' })
    expect(said.opens.length).toBe(opensBefore + 1)
    expect(said.opens[said.opens.length - 1]).toBe('agent-watch')
    await ui.unmount()
  }

  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'completed' }]
  await $.classic.SubagentStop(STOP)
  expect(said.statuses).toEqual(['1 AGENT RUNNING', undefined])
})

const OUTPUT = (text: string) => ({
  plugin: 'agent-watch',
  component: 'CommandOutput',
  props: { command: 'agent-watch', args: '', text, isErrored: false },
}) as const

test('/agent-watch opens the pane and draws its counts as a panel, in the host theme', async ($, on) => {
  mock.clock(on)
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('config.list', () => ({ value: [{ key: 'theme', value: 'light' } as ConfigRow] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: false })
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  const { text } = await $.command.run({ command: 'agent-watch', args: '' } as never)
  expect(text).toBe('Agents pane opened: 1 running, 0 completed, 0 failed or stopped.')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...OUTPUT(text ?? ""), surface })
    expect((await ui.find({ type: 'Text', text: /^AGENTS$/ }))?.props.color).toBe(TOKENS.light['text-1'])
    expect((await ui.find({ type: 'Text', text: /^1$/ }))?.props.color).toBe(TOKENS.light.cyan)
    expect(await ui.find({ text: /NONE FAILED/ })).toBeDefined()
    await ui.unmount()
  }
  // A row from before a reload is the engine's text.
  const old = await $.ui.mount({ ...OUTPUT('Agents pane opened.'), surface: 'terminal' })
  expect((await old.find({ type: 'Text' }))?.text).toBe('engine')
  await old.unmount()
})
