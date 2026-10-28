import { expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, ConfigRow, On, Register } from 'claude-code'

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

test('the pane shows a spawned agent under this session, running, then ended', async ($, on) => {
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
    expect(await text(/^SESSIONS$/)).toBeDefined()
    expect(await text(/^1 RUNNING$/)).toBeDefined()
    expect(await text(/^THIS SESSION$/)).toBeDefined()
    expect(await text(/Explore · Find hooks/)).toBeDefined()
    expect(await text(/12s/)).toBeDefined()
    // This session's bar counts its agents while it keeps no task list.
    expect(await text(/^0\/1$/)).toBeDefined()
    expect(await text(/^AGENTS$/)).toBeDefined()
    // The session's glyph and the agent's, both in this session's tone; the
    // agent's sits outside the name's Button. The name is text-1.
    expect((await ui.find({ type: 'Text', text: /^[⬢⬡] $/ }))?.props.color).toBe(DARK.cyan)
    expect((await ui.find({ type: 'Text', text: /^ *[■□] $/ }))?.props.color).toBe(DARK.cyan)
    expect((await ui.find({ type: 'Button', text: /Find hooks/ }))?.text).not.toContain('■')
    expect((await ui.find({ type: 'Text', text: /Find hooks/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.findAll({ type: 'Text' })).filter(t => t.props.dimColor || (t.props.bold && !t.props.weight)).length).toBe(0)
    expect((await ui.findAll({ type: 'Box' }))[0]?.props.minHeight).toBe(30)
    await ui.unmount()
  }

  // While it runs both icons pulse: solid, then hollow one frame later.
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const icon = async () => (await ui.find({ type: 'Text', text: /^ *[■□] $/ }))?.text?.trim()
    const head = async () => (await ui.find({ type: 'Text', text: /^[⬢⬡] $/ }))?.text?.trim()
    const [first, firstHead] = [await icon(), await head()]
    await clock.advance(400)
    expect(await icon()).not.toBe(first)
    expect(await head()).not.toBe(firstHead)
    await ui.unmount()
  }

  // The agent ends: its turn.complete refreshes the list.
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'completed' }]
  await $.turn.complete({ agentId: 'id-Find hooks', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't1' })
  await clock.advance(5_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
  expect(await text(/^1\/1$/)).toBeDefined()
  // Elapsed stops at the end, 12s after the spawn, not 17s.
  expect(await text(/ 12s/)).toBeDefined()
  expect(await text(/ 17s/)).toBeUndefined()
  // Ended: the glyph is solid and still, still in its owner's tone; the name
  // dims to text-2; a completed row carries no badge.
  expect(await text(/FAILED|STOPPED/)).toBeUndefined()
  await clock.advance(400)
  const done = await ui.find({ type: 'Text', text: /^ *[■□] $/ })
  expect([done?.text?.trim(), done?.props.color]).toEqual(['■', DARK.cyan])
  expect((await ui.find({ type: 'Text', text: /Find hooks/ }))?.props.color).toBe(DARK['text-2'])
  await ui.unmount()
})

test('a Workflow run is a sub-session in its own tone; its agents end on their turn', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  const said = engine(on, listed)
  on('tool.call', (_, e) => (e.tool === 'Workflow' ? { result: { status: 'async_launched', taskId: 't', runId: 'wf_1', workflowName: 'review-changes' } } : { result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  // The run's agents may spawn before the tool's result names the run.
  await $.agent.spawn({ prompt: 'p', description: 'review:bugs', subagentType: 'general-purpose', workflow: { runId: 'wf_1', agentIndex: 1 } } as AgentSpawnInput)
  await $.tool.call({ tool: 'Workflow', script: 'export const meta = {}' } as never)
  await $.agent.spawn({ prompt: 'p', description: 'review:perf', subagentType: 'general-purpose', workflow: { runId: 'wf_1', agentIndex: 2 } } as AgentSpawnInput)
  await clock.advance(1_000)

  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^WF review-changes$/ })).toBeDefined()
  expect(await ui.find({ text: /^0\/2$/ })).toBeDefined()
  const heads = await ui.findAll({ type: 'Text', text: /[⬢⬡] $/ })
  expect(heads.map(head => head.props.color)).toEqual([DARK.cyan, DARK.violet])
  const icons = await ui.findAll({ type: 'Text', text: /^ *[■□] $/ })
  expect(icons.map(icon => icon.props.color)).toEqual([DARK.violet, DARK.violet])
  await ui.unmount()

  // No list names a Workflow agent: its turn.complete ends it, and a failure is toasted.
  await $.turn.complete({ agentId: 'id-review:bugs', reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1' })
  await $.turn.complete({ agentId: 'id-review:perf', reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't2' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^2\/2$/ })).toBeDefined()
  expect(await ui.find({ text: /FAILED/ })).toBeDefined()
  expect(said.toasts).toEqual(['GENERAL-PURPOSE · review:perf · FAILED 00:00:01'])
  await ui.unmount()
})

test('a subagent that keeps its own task list becomes a session with a steps bar, its children in its tone', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'p', description: 'Build it', subagentType: 'general-purpose' } as AgentSpawnInput)
  await $.tool.call({
    tool: 'TodoWrite',
    agentId: 'id-Build it',
    todos: [
      { content: 'a', activeForm: 'doing a', status: 'completed' },
      { content: 'b', activeForm: 'doing b', status: 'in_progress' },
    ],
  } as never)
  await $.agent.spawn({ prompt: 'p', description: 'Find tests', subagentType: 'Explore', parentAgentId: 'id-Build it' } as AgentSpawnInput)
  await clock.advance(1_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^general-purpose · Build it$/ })).toBeDefined()
  expect(await ui.find({ text: /^1\/2$/ })).toBeDefined()
  expect(await ui.find({ text: /^STEPS$/ })).toBeDefined()
  const heads = await ui.findAll({ type: 'Text', text: /[⬢⬡] $/ })
  expect(heads.map(head => [head.text.trim().length, head.props.color])).toEqual([
    [1, DARK.cyan],
    [1, DARK.violet],
  ])
  // The child sits under it, in its tone; this session keeps none of them as members.
  expect((await ui.find({ type: 'Text', text: /^ *[■□] $/ }))?.props.color).toBe(DARK.violet)
  expect(await ui.find({ text: /No subagent yet/ })).toBeUndefined()
  // The band's task list is the main loop's alone.
  await ui.unmount()
})

// task-orchestrator as the engine holds it: inline plugins that write its
// state. The kit loads an inline plugin's register on its own, without its
// closure, so each ledger is a literal inside it.
const orchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'running', agentId: 'id-T1 builder', startedAt: 1_000, observed: { model: 'claude-sonnet-5-5', effort: 'medium', at: 1_100 } },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'blocked', startedAt: 600, endedAt: 900 },
      { ...task, id: 'T3', role: 'tester', objective: 'Test it', status: 'queued', deps: ['T1'] },
    ])
    return next(e)
  })
}
const idleOrchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [])
    return next(e)
  })
}

test('the orchestrator run is a sub-session: its ledger tasks, their words, a TASKS bar', { plugins: [{ name: 'task-orchestrator', register: orchestrator }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  listed.value = [{ id: 'id-T1 builder', type: 'task-orchestrator:builder', description: 'T1 builder', status: 'running', name: 'T1', spawnedBy: 'task-orchestrator' }]
  await clock.advance(1_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^ORCH BALANCED$/)).toBeDefined()
    expect(await text(/^1\/3$/)).toBeDefined()
    expect(await text(/^TASKS$/)).toBeDefined()
    expect(await text(/T1 · builder · Write the model/)).toBeDefined()
    expect(await text(/claude-sonnet-5-5\/medium/)).toBeDefined()
    expect(await text(/^ BLOCKED$/)).toBeDefined()
    expect(await text(/WAITS ON T1/)).toBeDefined()
    // The queued task waits hollow; the worker runs in the orchestrator's tone, not under this session.
    const heads = await ui.findAll({ type: 'Text', text: /[⬢⬡] $/ })
    expect(heads.map(head => head.props.color)).toEqual([DARK.cyan, DARK.violet])
    const icons = await ui.findAll({ type: 'Text', text: /^ *[■□] $/ })
    expect(icons.map(icon => icon.props.color)).toEqual([DARK.violet, DARK.violet, DARK.violet])
    expect(icons[1]?.text.trim()).toBe('□')
    expect((await ui.findAll({ type: 'Text', text: /T1 builder/ })).length).toBe(0)
    await ui.unmount()
  }
})

test('no orchestrator run is drawn while its ledger is empty', { plugins: [{ name: 'task-orchestrator', register: idleOrchestrator }] }, async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^THIS SESSION$/ })).toBeDefined()
  expect(await ui.find({ text: /ORCH/ })).toBeUndefined()
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
    const text = (await ui.find({ type: 'Text', text: /^ +\d+ CALLS?/ }))?.text?.trim()
    await ui.unmount()
    return text
  }
  // No call yet: no caption.
  expect(await caption('terminal')).toBeUndefined()
  // The engine stub answers a call at once, so one call has ended.
  await $.tool.call({ tool: 'Bash', command: 'ls -la', agentId: 'id-Find hooks' })
  expect(await caption('terminal')).toBe('1 CALL')
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
  for (const surface of ['terminal', 'desktop'] as const) expect(await caption(surface)).toBe('1 CALL · 1.2k TOK')
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
