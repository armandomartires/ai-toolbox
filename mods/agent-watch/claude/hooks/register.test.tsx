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
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
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
  on('turn.start', () => ({ turnId: 't' }))

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
    expect(await text(/^12s$/)).toBeDefined()
    // This session counts its agents while it keeps no task list: 0 of 1.
    expect(await text(/^0\/1$/)).toBeDefined()
    // Rows are coloured by their state, never by session: this session and the agent are running, cyan; the name is text-1.
    expect((await ui.find({ type: 'Text', text: /^⬢ $/ }))?.props.color).toBe(DARK.cyan)
    expect((await ui.find({ type: 'Text', text: /^ *● $/ }))?.props.color).toBe(DARK.cyan)
    expect((await ui.find({ type: 'Button', text: /Find hooks/ }))?.text).not.toContain('●')
    expect((await ui.find({ type: 'Text', text: /Find hooks/ }))?.props.color).toBe(DARK['text-1'])
    expect((await ui.findAll({ type: 'Text' })).filter(t => t.props.dimColor || (t.props.bold && !t.props.weight)).length).toBe(0)
    expect((await ui.findAll({ type: 'Box' }))[0]?.props.minHeight).toBe(60)
    await ui.unmount()
  }

  // Nothing pulses: a frame later the running glyph is the same one.
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const icon = async () => (await ui.find({ type: 'Text', text: /^ *● $/ }))?.text?.trim()
    const first = await icon()
    await clock.advance(400)
    expect([first, await icon()]).toEqual(['●', '●'])
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
  expect(await text(/^12s$/)).toBeDefined()
  expect(await text(/^17s$/)).toBeUndefined()
  // Ended: the member's glyph is the solid square in text-1 and its name dims to text-2; this session, with nothing running, is idle.
  // (The legend's glyphs are red and amber, without the trailing space a row's glyph carries.)
  expect((await ui.findAll({ type: 'Text' })).filter(one => (one.props.color === DARK.red || one.props.color === DARK.amber) && /[◆▲] $/.test(one.text ?? '')).length).toBe(0)
  const done = await ui.find({ type: 'Text', text: /^ *■ $/ })
  expect([done?.text?.trim(), done?.props.color]).toEqual(['■', DARK['text-1']])
  expect((await ui.find({ type: 'Text', text: /Find hooks/ }))?.props.color).toBe(DARK['text-2'])
  expect(await text(/^ IDLE$/)).toBeDefined()
  await ui.unmount()
})

test('a Workflow run is a sub-session coloured by its state, never a session tone; its agents end on their turn', async ($, on) => {
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
  // Colour is the state, never the session's tone: this session has no running member of its own, so it is idle (text-3); the run and its members run, cyan.
  const heads = await ui.findAll({ type: 'Text', text: /^ *⬢ $/ })
  expect(heads.map(head => head.props.color)).toEqual([DARK['text-3'], DARK.cyan])
  const icons = await ui.findAll({ type: 'Text', text: /^ *[●■□◆▲○] $/ })
  expect(icons.map(icon => icon.props.color)).toEqual([DARK.cyan, DARK.cyan])
  expect((await ui.findAll({ type: 'Text' })).some(one => one.props.color === DARK.violet)).toBe(false)
  await ui.unmount()

  // No list names a Workflow agent: its turn.complete ends it, and a failure is toasted.
  await $.turn.complete({ agentId: 'id-review:bugs', reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1' })
  await $.turn.complete({ agentId: 'id-review:perf', reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't2' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^2\/2$/ })).toBeDefined()
  // The failed agent's state cell, in red.
  expect((await ui.findAll({ type: 'Text', text: /^ ?FAILED$/ })).map(one => one.props.color)).toContain(DARK.red)
  expect(said.toasts).toEqual(['GENERAL-PURPOSE · review:perf · FAILED 00:00:01'])
  await ui.unmount()
})

test('a subagent that keeps its own task list becomes a session with a steps bar, its running child in the state colour', async ($, on) => {
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
  // Steps roll up the sum over its members, so the running child's 0/1, not the session's own list (1/2); the row says RUNNING.
  expect((await ui.findAll({ text: /^0\/1$/ })).length).toBeGreaterThanOrEqual(2)
  expect(await ui.find({ text: /^ RUNNING$/ })).toBeDefined()
  const heads = await ui.findAll({ type: 'Text', text: /^ *⬢ $/ })
  expect(heads.map(head => [head.text.trim().length, head.props.color])).toEqual([
    [1, DARK['text-3']],
    [1, DARK.cyan],
  ])
  // The child sits under it, running, in the state's colour; this session keeps none of them as members.
  expect((await ui.find({ type: 'Text', text: /^ *● $/ }))?.props.color).toBe(DARK.cyan)
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

test('the orchestrator run is a sub-session: its ledger tasks, their words, coloured by state',{ plugins: [{ name: 'task-orchestrator', register: orchestrator }] }, async ($, on) => {
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
    expect(await text(/T1 · builder · Write the model/)).toBeDefined()
    expect(await text(/claude-sonnet-5-5\/medium/)).toBeDefined()
    expect(await text(/^ BLOCKED$/)).toBeDefined()
    expect(await text(/WAITS ON T1/)).toBeDefined()
    // Each task carries its state's glyph and colour: the worker runs (cyan), the blocked one is amber, the queued one waits hollow in text-3; the worker is not also drawn under this session.
    const heads = await ui.findAll({ type: 'Text', text: /^ *⬢ $/ })
    expect(heads.map(head => head.props.color)).toEqual([DARK['text-3'], DARK.cyan])
    const icons = await ui.findAll({ type: 'Text', text: /^ +[●■□◆▲○] $/ })
    expect(icons.map(icon => [icon.text.trim(), icon.props.color])).toEqual([
      ['●', DARK.cyan],
      ['□', DARK['text-3']],
      ['▲', DARK.amber],
    ])
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

test('a nested subagent ends on its own turn, whatever the list says after (B-066)', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'p', description: 'Split it', subagentType: 'general-purpose' } as AgentSpawnInput)
  await $.agent.spawn({ prompt: 'p', description: 'Count tests', subagentType: 'Explore', parentAgentId: 'id-Split it' } as AgentSpawnInput)
  // The list lags: it still names the child running after its turn ended.
  const running = (id: string, description: string, parentId?: string): AgentInfo => ({ id, type: 'Explore', description, status: 'running', parentId })
  listed.value = [running('id-Split it', 'Split it'), running('id-Count tests', 'Count tests', 'id-Split it')]
  await clock.advance(2_000)
  await $.turn.complete({ agentId: 'id-Count tests', reason: 'answer', answer: '11', durationMs: 1, isAborted: false, turnId: 't1' })

  const childIcon = async () => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const out = { bar: (await ui.find({ text: /^\d+\/1$/ }))?.text, frames: [] as (string | undefined)[] }
    out.frames.push((await ui.find({ type: 'Text', text: /^ +[■□] $/ }))?.text?.trim())
    await ui.unmount()
    return out
  }
  // Ended: the parent session counts it, and its icon is solid and still across frames.
  await clock.advance(5_000)
  const first = await childIcon()
  await clock.advance(400)
  const second = await childIcon()
  expect(first.bar).toBe('1/1')
  expect([first.frames[0], second.frames[0]]).toEqual(['■', '■'])

  // The list then stops naming it: still ended, and its time stopped at its end.
  listed.value = [running('id-Split it', 'Split it')]
  await clock.advance(60_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /^1\/1$/ })).toBeDefined()
  expect(await ui.find({ text: /^2s$/ })).toBeDefined()
  await ui.unmount()

  // Woken again (a message resumes it): a new turn in its loop runs it again.
  await $.turn.start({ agentId: 'id-Count tests', prompt: 'again' } as never)
  const again = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await again.find({ text: /^0\/1$/ })).toBeDefined()
  await again.unmount()
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

  // wrap_up ticks every step off, but an agent still runs: not done.
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /ALL DONE/ })).toBeUndefined()
  expect(await ui.find({ text: /1 RUNNING/ })).toBeDefined()
  await ui.unmount()

  // Once nothing runs the meter turns text-1 and says so.
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'completed' }]
  await $.classic.SubagentStop(STOP)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^▰+$/ }))?.props.color).toBe(DARK['text-1'])
  expect(await ui.find({ text: /ALL DONE/ })).toBeDefined()
  await ui.unmount()

  // A survey holds the band.
  ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})

// The run of the brief: 4 of 7 tasks ended, T3 running, T4 and R3 queued behind it.
const midRun: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'completed', startedAt: 600, endedAt: 700 },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'completed', startedAt: 700, endedAt: 800 },
      { ...task, id: 'R1', role: 'tester', objective: 'Test it', status: 'completed', startedAt: 800, endedAt: 900 },
      { ...task, id: 'R2', role: 'reviewer', objective: 'Review the tests', status: 'completed', startedAt: 900, endedAt: 950 },
      { ...task, id: 'T3', role: 'builder', objective: 'Draw the band above the prompt', status: 'running', agentId: 'id-T3 builder', startedAt: 1_000 },
      { ...task, id: 'T4', role: 'tester', objective: 'Test the band', status: 'queued', deps: ['T3'] },
      { ...task, id: 'R3', role: 'reviewer', objective: 'Review the band', status: 'queued', deps: ['T3'] },
    ])
    return next(e)
  })
}
const mixedRun: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'completed', startedAt: 600, endedAt: 700 },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'failed', startedAt: 700, endedAt: 800 },
      { ...task, id: 'T3', role: 'tester', objective: 'Test it', status: 'blocked', startedAt: 800, endedAt: 900 },
      { ...task, id: 'T4', role: 'reviewer', objective: 'Review the tests', status: 'cancelled', endedAt: 950 },
      { ...task, id: 'T5', role: 'builder', objective: 'Fix it', status: 'completed', startedAt: 900, endedAt: 990 },
      { ...task, id: 'T6', role: 'builder', objective: 'Draw the band above the prompt', status: 'running', agentId: 'id-T6 builder', startedAt: 1_000 },
      { ...task, id: 'T7', role: 'tester', objective: 'Test the band', status: 'queued', deps: ['T6'] },
    ])
    return next(e)
  })
}
const doneRun: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'completed', startedAt: 600, endedAt: 700 },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'failed', startedAt: 700, endedAt: 800 },
    ])
    return next(e)
  })
}

/** The band's texts, left to right, and the width they take with at most one cell between its parts. */
const bandTexts = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }) => {
  const parts = (await ui.findAll({ type: 'Text' })).map(part => part.text)
  return { joined: parts.join(' '), width: parts.join('').length + 4 }
}

test('with an open run the band follows the ledger: marks, n/m TASKS, the running task, what is queued', { plugins: [{ name: 'task-orchestrator', register: midRun }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const said = engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  // The app's task list is ticked off at every turn end: the band must not read it.
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'Plan', status: 'in_progress' }] } as AppTool)
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  await clock.advance(5_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 110 }, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^4\/7$/)).toBeDefined()
    expect(await text(/^ TASKS$/)).toBeDefined()
    expect(await text(/T3 · builder · Draw the band above the prompt/)).toBeDefined()
    expect(await text(/^5s$/)).toBeDefined()
    expect(await text(/^2 QUEUED · WAIT ON T3$/)).toBeDefined()
    expect(await ui.find({ text: /ALL DONE|STEPS|\d+ running/ })).toBeUndefined()
    // One mark per task in the Sessions panel's own glyphs and colours; the running one is the legend's cyan ●.
    const marks = await ui.findAll({ type: 'Text', text: /^[●■□◆▲○]$/ })
    expect(marks.map(mark => [mark.text, mark.props.color])).toEqual([
      ['■', DARK['text-1']], ['■', DARK['text-1']], ['■', DARK['text-1']], ['■', DARK['text-1']],
      ['●', DARK.cyan],
      ['□', DARK['text-3']], ['□', DARK['text-3']],
    ])
    // The running mark opens its agent's transcript; the task text opens the pane.
    const opens = said.opens.length
    await ui.press({ key: 'band-agent-id-T3 builder' })
    expect(said.views).toContainEqual({ agentId: 'id-T3 builder' })
    await ui.press({ key: 'band-step' })
    expect(said.opens.length).toBe(opens + 1)
    await ui.unmount()
  }
})

test('with failed, blocked and cancelled tasks the band counts every ended one and draws each in the panel glyph and colour', { plugins: [{ name: 'task-orchestrator', register: mixedRun }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(5_000)
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 110 }, surface: 'terminal' })
  // Done, failed, blocked and cancelled all ended: 5 of 7.
  expect(await ui.find({ text: /^5\/7$/ })).toBeDefined()
  expect(await ui.find({ text: /^ TASKS$/ })).toBeDefined()
  expect(await ui.find({ text: /ALL DONE/ })).toBeUndefined()
  expect(await ui.find({ text: /T6 · builder/ })).toBeDefined()
  const marks = await ui.findAll({ type: 'Text', text: /^[●■□◆▲○]$/ })
  expect(marks.map(mark => [mark.text, mark.props.color])).toEqual([
    ['■', DARK['text-1']], ['◆', DARK.red], ['▲', DARK.amber], ['○', DARK['text-3']], ['■', DARK['text-1']],
    ['●', DARK.cyan],
    ['□', DARK['text-3']],
  ])
  await ui.unmount()
})

test('a run that is not open leaves the band as the task list draws it', { plugins: [{ name: 'task-orchestrator', register: doneRun }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  // Every task ended and no task list: the band is the engine's.
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()

  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'Draw the band', status: 'in_progress' }, { content: 'Test it', status: 'pending' }] } as AppTool)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /^0\/2$/ })).toBeDefined()
  expect(await ui.find({ text: / STEPS/ })).toBeDefined()
  expect(await ui.find({ text: /TASKS/ })).toBeUndefined()
  expect(await ui.find({ text: /Draw the band/ })).toBeDefined()
  await ui.unmount()
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /ALL DONE/ })).toBeDefined()
  await ui.unmount()

  // The same list with an agent running is not done, and the agent's glyph and count stay as they were.
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'running' }]
  await clock.advance(1_000)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /ALL DONE/ })).toBeUndefined()
  expect(await ui.find({ text: /1 RUNNING/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^[■□] $/ }))?.props.color).toBe(DARK.cyan)
  await ui.unmount()
})

test('the band never wraps: the objective is cut first, then WAIT ON, then the queue', { plugins: [{ name: 'task-orchestrator', register: midRun }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(5_000)

  const at = async (columns: number) => {
    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: columns }, surface: 'terminal' })
    const out = await bandTexts(ui)
    await ui.unmount()
    return { ...out, columns }
  }
  const wide = await at(100)
  expect(wide.joined).toContain('T3 · builder · Draw the band above the prompt')
  expect(wide.joined).toContain('2 QUEUED · WAIT ON T3')

  // Objective first: the head stays, the objective is cut, the queue and its wait stay.
  const cut = await at(70)
  expect(cut.joined).toContain('T3 · builder · ')
  expect(cut.joined).toMatch(/…/)
  expect(cut.joined).not.toContain('above the prompt')
  expect(cut.joined).toContain('WAIT ON T3')
  // Then the wait goes, the queue stays.
  const noWait = await at(50)
  expect(noWait.joined).not.toContain('WAIT ON')
  expect(noWait.joined).toContain('2 QUEUED')
  expect(noWait.joined).toContain('T3 · builder')
  // Then the queue.
  const none = await at(40)
  expect(none.joined).not.toContain('QUEUED')
  expect(none.joined).toContain('T3 · builder')
  for (const one of [wide, cut, noWait, none]) expect(one.width).toBeLessThanOrEqual(Math.max(20, one.columns))
})

// The orchestrator's switch on, nothing else; each is a literal, the kit evaluating an inline register without its closure.
const orchOn: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    return next(e)
  })
}
const orchOnMidRun: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'completed', startedAt: 600, endedAt: 700 },
      { ...task, id: 'T3', role: 'builder', objective: 'Draw the band above the prompt', status: 'running', agentId: 'id-T3 builder', startedAt: 1_000 },
      { ...task, id: 'T4', role: 'tester', objective: 'Test the band', status: 'queued', deps: ['T3'] },
    ])
    return next(e)
  })
}

test('orchestration on with nothing to show draws ORCH <POLICY> · IDLE, and off leaves the band to the engine', { plugins: [{ name: 'task-orchestrator', register: orchOn }] }, async ($, on) => {
  const said = engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /ORCH BALANCED · IDLE/ }))?.props.color).toBe(DARK['text-3'])
  expect(await ui.find({ text: /^engine$/ })).toBeUndefined()
  const opens = said.opens.length
  await ui.press({ key: 'band-orch' })
  expect(said.opens.length).toBe(opens + 1)
  await ui.unmount()

  // A survey still holds the band.
  ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()

})

test('orchestration off with nothing to show leaves the band to the engine', async ($, on) => {
  engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  expect(await ui.find({ text: /ORCH/ })).toBeUndefined()
  await ui.unmount()
})

test('with a run open the band leads with ORCH <POLICY>, which goes before the objective is cut', { plugins: [{ name: 'task-orchestrator', register: orchOnMidRun }] }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await clock.advance(5_000)
  const at = async (columns: number) => {
    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: columns }, surface: 'terminal' })
    const out = await bandTexts(ui)
    await ui.unmount()
    return { ...out, columns }
  }
  const wide = await at(120)
  expect(wide.joined.indexOf('ORCH BALANCED')).toBe(0)
  expect(wide.joined).toContain('T3 · builder · Draw the band above the prompt')
  // Narrower: the label goes while the objective is still whole.
  const narrower = await at(96)
  expect(narrower.joined).not.toContain('ORCH')
  expect(narrower.joined).toContain('T3 · builder · Draw the band above the prompt')
  for (const one of [wide, narrower]) expect(one.width).toBeLessThanOrEqual(Math.max(20, one.columns))
})

test('with a task list and no run the band ends with ORCH <POLICY> while it is on, and drops it when narrow', { plugins: [{ name: 'task-orchestrator', register: orchOn }] }, async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [{ content: 'Draw the band', status: 'in_progress' }, { content: 'Test it', status: 'pending' }],
  } as AppTool)
  const at = async (columns: number) => {
    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: columns }, surface: 'terminal' })
    const texts = (await ui.findAll({ type: 'Text' })).map(part => part.text)
    await ui.unmount()
    return texts
  }
  const wide = await at(80)
  expect(wide.at(-1)).toBe('ORCH BALANCED')
  expect(wide.join(' ')).toContain('Draw the band')
  const narrow = await at(34)
  expect(narrow.join(' ')).not.toContain('ORCH')
  expect(narrow.join(' ')).toContain('Draw')
})

// A policy other than the default, to prove the label reads it.
const orchQuality: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'quality')
    return next(e)
  })
}

test('a finished task list ends with ORCH <POLICY> in the policy in force, and drops it before ALL DONE is cut when narrow', { plugins: [{ name: 'task-orchestrator', register: orchQuality }] }, async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [{ content: 'Draw the band', status: 'completed' }, { content: 'Test it', status: 'completed' }],
  } as AppTool)
  const at = async (columns: number) => {
    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: columns }, surface: 'terminal' })
    const out = await bandTexts(ui)
    await ui.unmount()
    return { ...out, columns }
  }
  const wide = await at(80)
  expect(wide.joined).toContain('ALL DONE')
  expect(wide.joined).toContain('ORCH QUALITY')
  expect(wide.joined).not.toContain('BALANCED')
  const narrow = await at(34)
  expect(narrow.joined).toContain('ALL DONE')
  expect(narrow.joined).not.toContain('ORCH')
  for (const one of [wide, narrow]) expect(one.width).toBeLessThanOrEqual(Math.max(20, one.columns))
})

test('a running agent with no task list and orchestration on: the meter fits its columns, and ORCH goes when there is no room', { plugins: [{ name: 'task-orchestrator', register: orchOn }] }, async ($, on) => {
  mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  listed.value = [{ id: 'id-Find hooks', type: 'Explore', description: 'Find hooks', status: 'running' }]
  const at = async (columns: number) => {
    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: columns }, surface: 'terminal' })
    const out = await bandTexts(ui)
    await ui.unmount()
    return { ...out, columns }
  }
  const wide = await at(80)
  expect(wide.joined).toContain('1 running'.toUpperCase())
  expect(wide.joined).toContain('ORCH BALANCED')
  const narrow = await at(30)
  expect(narrow.joined).toContain('1 running'.toUpperCase())
  expect(narrow.joined).not.toContain('ORCH')
  for (const one of [wide, narrow]) expect(one.width).toBeLessThanOrEqual(Math.max(20, one.columns))
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
  // Its turn's end reports its tokens; the ended row keeps its calls and tokens.
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

// ---- Background tasks (ADR-0049) ------------------------------------------

/** The engine's answers to the background-task tools: Bash opens one when asked to, Monitor always, TaskStop names what it stopped. */
const backgroundTools = (on: On) => {
  on('tool.call', (_, e) => {
    const call = e as unknown as Record<string, unknown>
    if (call.tool === 'Bash') return { result: call.run_in_background ? { stdout: '', stderr: '', interrupted: false, backgroundTaskId: String(call.description) === 'Run the driver' ? 'b1' : 'b2' } : { stdout: '', stderr: '', interrupted: false } }
    if (call.tool === 'Monitor') return { result: { taskId: 'm1', timeoutMs: 300_000 } }
    if (call.tool === 'TaskStop') return { result: { message: 'stopped', task_id: call.task_id, task_type: 'local_bash' } }
    return { result: {} }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('classic.Stop', () => ({}))
}

const notice = (id: string, status: string, summary: string) =>
  `<task-notification>\n<task-id>${id}</task-id>\n<status>${status}</status>\n<summary>${summary}</summary>\n</task-notification>`

/** A Monitor's event as it arrived live (2.1.318): no status, the line in <event>. */
const monitorEvent = (id: string, line: string) =>
  `<task-notification>\n<task-id>${id}</task-id>\n<summary>Monitor event: "gate steps"</summary>\n<event>${line}</event>\nIf this event is something the user would act on now, send a PushNotification.\n</task-notification>`

test("a monitor on a background run's output fills that run's row step by step, and a FAIL marks it failed", async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  backgroundTools(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: './gates.sh', description: 'Run the driver', run_in_background: true })
  // The monitor tails the run's own output file, which names its id (b1).
  await $.tool.call({ tool: 'Monitor', description: 'gate steps', command: 'tail -f /tmp/claude/tasks/b1.output | grep --line-buffered "^step "', timeout_ms: 300_000 } as never)
  const event = (line: string) => $.prompt.submit({ text: monitorEvent('m1', line), origin: { kind: 'task-notification' } } as never)
  const look = async (check: (text: (pattern: RegExp) => Promise<string | undefined>) => Promise<void>) => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await check(async pattern => (await ui.find({ text: pattern }))?.text)
    await ui.unmount()
  }

  await event('step 1/3 lint ok')
  await clock.advance(1_000)
  await look(async text => {
    // One row, the run's: the monitor is folded into it, and it is still running.
    expect(await text(/^1 RUNNING$/)).toBeDefined()
    expect(await text(/monitor · gate steps/)).toBeUndefined()
    expect(await text(/1\/3 STEPS · lint/)).toBeDefined()
    expect(await text(/^1\/3$/)).toBeDefined()
  })

  await event('step 2/3 typecheck FAIL')
  await clock.advance(1_000)
  await look(async text => {
    expect(await text(/2\/3 STEPS · FAIL typecheck/)).toBeDefined()
    expect(await text(/^2\/3$/)).toBeDefined()
    // Failed from that step on, though the run goes on.
    expect(await text(/^1 RUNNING$/)).toBeDefined()
  })

  await event('step 3/3 tests ok')
  await $.prompt.submit({ text: notice('b1', 'completed', 'Background command "Run the driver" completed (exit code 0)'), origin: { kind: 'task-notification' } } as never)
  await clock.advance(1_000)
  await look(async text => {
    expect(await text(/^0 RUNNING$/)).toBeDefined()
    expect(await text(/3\/3 STEPS · FAIL typecheck · EXIT 0/)).toBeDefined()
  })
})

test('a background command is a running row with no agent, and its notification ends it with its exit code', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  backgroundTools(on)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'python3 .unattended/driver.py run', description: 'Run the driver', run_in_background: true })
  // A foreground command opens nothing.
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List files' })
  await clock.advance(95_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^1 RUNNING$/)).toBeDefined()
    expect(await text(/shell · Run the driver/)).toBeDefined()
    expect(await text(/List files/)).toBeUndefined()
    expect(await text(/\$ python3 \.unattended\/driver\.py run/)).toBeDefined()
    expect(await text(/^B01 ·$/)).toBeDefined()
    expect(await text(/^1m35s$/)).toBeDefined()
    // Running is cyan, and the AGENTS block still counts no agent.
    expect((await ui.find({ type: 'Text', text: /^ *● $/ }))?.props.color).toBe(DARK.cyan)
    expect(await text(/No subagent yet/)).toBeUndefined()
    await ui.unmount()
  }

  await $.prompt.submit({ text: notice('b1', 'failed', 'Background command "Run the driver" failed with exit code 2'), origin: { kind: 'task-notification' } } as never)
  await clock.advance(10_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
  expect(await text(/^0 RUNNING$/)).toBeDefined()
  expect(await text(/EXIT 2/)).toBeDefined()
  // Its time stopped at the notification.
  expect(await text(/^1m35s$/)).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^ *◆ $/ }))?.props.color).toBe(DARK.red)
  await ui.unmount()
})

test('a finished task list with a background command still running is not ALL DONE; the band names what it waits on', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  backgroundTools(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'Run the gate', status: 'in_progress' }, { content: 'Commit', status: 'pending' }] } as AppTool)
  await $.tool.call({ tool: 'Bash', command: './gates.sh', description: 'Run the driver', run_in_background: true })
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as AppTool)
  await clock.advance(1_000)
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /^2\/2$/ })).toBeDefined()
  expect(await ui.find({ text: /ALL DONE/ })).toBeUndefined()
  expect(await ui.find({ text: /1 BACKGROUND RUNNING/ })).toBeDefined()
  await ui.unmount()

  await $.prompt.submit({ text: notice('b1', 'completed', 'Background command "Run the driver" completed (exit code 0)'), origin: { kind: 'task-notification' } } as never)
  await clock.advance(1_000)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /ALL DONE/ })).toBeDefined()
  expect(await ui.find({ text: /BACKGROUND RUNNING/ })).toBeUndefined()
  await ui.unmount()
})

test('a PowerShell command moved to the background at its timeout is a running shell until its notification', async ($, on) => {
  const clock = mock.clock(on, { now: 700_000 })
  engine(on, { value: [] })
  // The result a live PowerShell call gave when its 600 s timeout passed.
  on('tool.call', (_, e) => ({ result: (e as unknown as Record<string, unknown>).tool === 'PowerShell' ? { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b0xa8rys0', timedOutAfterMs: 600_000 } : {} }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'PowerShell', command: 'wsl -d AlmaLinux-10 bash -lc ./gates.sh', description: 'Run the gates', timeout: 600_000 } as never)
  await clock.advance(5_000)
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const text = async (pattern: RegExp) => (await ui.find({ text: pattern }))?.text
    expect(await text(/^1 RUNNING$/)).toBeDefined()
    expect(await text(/shell · Run the gates/)).toBeDefined()
    // Backdated by its timeout: it has run ten minutes already.
    expect(await text(/^10m05s$/)).toBeDefined()
    await ui.unmount()
  }
  await $.prompt.submit({ text: notice('b0xa8rys0', 'completed', 'Background command "Run the gates" completed (exit code 0)'), origin: { kind: 'task-notification' } } as never)
  await clock.advance(5_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ text: /^0 RUNNING$/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('a prompt that is not a task notification ends nothing', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  backgroundTools(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'sleep 600', description: 'Run the driver', run_in_background: true })
  await $.prompt.submit({ text: notice('b1', 'completed', 'done (exit code 0)'), origin: { kind: 'composer' } } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /^1 RUNNING$/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('TaskStop stops a background task; a monitor is a row too', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  backgroundTools(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'sleep 600', description: 'Sleep', run_in_background: true })
  await $.tool.call({ tool: 'Monitor', description: 'Watch the log', command: 'tail -f log', timeout_ms: 300_000 } as never)
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect((await ui.find({ text: /^2 RUNNING$/ }))?.text).toBeDefined()
    expect((await ui.find({ text: /monitor · Watch the log/ }))?.text).toBeDefined()
    await ui.unmount()
  }
  await $.tool.call({ tool: 'TaskStop', task_id: 'b2' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /^1 RUNNING$/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^ *○ $/ }))?.props.color).toBe(DARK['text-3'])
  await ui.unmount()
})

test("Stop's in-flight list adds an untracked shell, never a subagent, and ends a task it no longer names", async ($, on) => {
  mock.clock(on, { now: 1_000 })
  engine(on, { value: [] })
  backgroundTools(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'sleep 600', description: 'Run the driver', run_in_background: true })
  const stop = { stop_hook_active: false, session_id: 's', transcript_path: '/t', cwd: '/p' }
  await $.classic.Stop({
    ...stop,
    background_tasks: [
      { id: 'b1', type: 'shell', status: 'running', description: 'Run the driver' },
      { id: 'b9', type: 'shell', status: 'running', description: 'Build the site', command: 'make site' },
      { id: 'a9', type: 'subagent', status: 'running', description: 'Find hooks', agent_type: 'Explore' },
    ],
  } as never)
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect((await ui.find({ text: /^2 RUNNING$/ }))?.text).toBeDefined()
    expect((await ui.find({ text: /shell · Build the site/ }))?.text).toBeDefined()
    expect((await ui.find({ text: /Find hooks/ }))?.text).toBeUndefined()
    await ui.unmount()
  }
  await $.classic.Stop({ ...stop, background_tasks: [{ id: 'b9', type: 'shell', status: 'running', description: 'Build the site' }] } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /^1 RUNNING$/ }))?.text).toBeDefined()
  await ui.unmount()
})

test("a subagent's background command sits under it and ends with it when it dies with the agent", async ($, on) => {
  mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('tool.call', (_, e) => ({ result: (e as unknown as Record<string, unknown>).tool === 'Bash' ? { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b7', backgroundEndsWithFinalResponse: true } : {} }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  await $.tool.call({ tool: 'Bash', command: 'sleep 600', description: 'Tail the log', run_in_background: true, agentId: 'id-Find hooks' })
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect((await ui.find({ text: /^2 RUNNING$/ }))?.text).toBeDefined()
    await ui.unmount()
  }
  await $.turn.complete({ agentId: 'id-Find hooks', reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't1' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /^0 RUNNING$/ }))?.text).toBeDefined()
  expect((await ui.find({ text: /shell · Tail the log/ }))?.text).toBeDefined()
  // Stopped with its owner (○), not done: it never finished.
  expect((await ui.find({ type: 'Text', text: /^ *○ $/ }))?.props.color).toBe(DARK['text-3'])
  expect((await ui.find({ type: 'Text', text: /^ *■ $/ }))?.text).toBeDefined()
  await ui.unmount()
})

// A `/reload-plugins --force` drops the mod's `$.state` with its instance
// (seen live 2026-11-06), so the rows are mirrored into `$.store` and come
// back at `session.start` under the same session id (TASK-0238). The test
// answers the store itself, so it can seed it and read what was written.
const KEPT = 'agent-watch:rows:sess-A'
const storeOf = (on: On, entries: Record<string, unknown> = {}) => {
  const store = new Map(Object.entries(entries))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', (_, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  return store
}
const kept = (sessionId: string) => ({
  sessionId,
  agents: [{ id: 'id-Old', type: 'Explore', description: 'Old search', status: 'completed', startedAt: 100, endedAt: 900, calls: 3, tokens: 40 }],
  tasks: [{ id: '1', text: 'Read it', status: 'completed' }, { id: '2', text: 'Write it', status: 'in_progress' }],
  runs: [],
  tones: {},
  background: [{ id: 'b1', kind: 'shell', description: 'Tail the log', status: 'running', startedAt: 500 }],
})

test('each change mirrors the rows into the store under this session id; a session.start with rows held restores nothing (TASK-0238)', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  const store = storeOf(on)
  on('session.id', () => ({ value: 'sess-A' }))
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(store.get(KEPT)).toBeUndefined()

  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  const after = store.get(KEPT) as { sessionId: string; agents: { id: string; status: string }[]; background: unknown[] }
  expect(after.sessionId).toBe('sess-A')
  expect((after as { savedAt?: number }).savedAt).toBe(1_000)
  expect(after.agents).toMatchObject([{ id: 'id-Find hooks', status: 'running' }])
  expect(after.background).toEqual([])

  // A plain reload runs session.start again with the atoms kept: nothing is restored over them.
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /^1 RUNNING$/ }))?.text).toBeDefined()
  expect(await ui.findAll({ type: 'Button', text: /Find hooks/ })).toHaveLength(1)
  await ui.unmount()
})

test("a session.start that finds the atoms empty restores this session's rows from the store, numbered as before (TASK-0238)", async ($, on) => {
  mock.clock(on, { now: 2_000 })
  storeOf(on, { [KEPT]: kept('sess-A') })
  on('session.id', () => ({ value: 'sess-A' }))
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /Explore · Old search/ }))?.text).toBeDefined()
  expect((await ui.find({ text: /shell · Tail the log/ }))?.text).toBeDefined()
  expect((await ui.find({ text: /^1 RUNNING$/ }))?.text).toBeDefined()
  // The task list came back too: its 1 of 2 beside the ended agent (1/1) and the running shell (0/1).
  expect((await ui.find({ text: /^2\/4$/ }))?.text).toBeDefined()
  await ui.unmount()
  // A new agent takes the next number after the restored one, as before the reload.
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  const again = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await again.find({ text: /^2 RUNNING$/ }))?.text).toBeDefined()
  expect((await again.find({ text: /A02/ }))?.text).toBeDefined()
  await again.unmount()
})

test('rows stored by another session are never restored (TASK-0238)', async ($, on) => {
  mock.clock(on, { now: 2_000 })
  const store = storeOf(on, { 'agent-watch:rows:sess-B': kept('sess-B') })
  on('session.id', () => ({ value: 'sess-A' }))
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /Old search/ })).toBeUndefined()
  expect(await ui.find({ text: /Tail the log/ })).toBeUndefined()
  expect((await ui.find({ text: /^0 RUNNING$/ }))?.text).toBeDefined()
  await ui.unmount()
  // The first change of this session writes its own key; the other session's rows stay.
  await $.agent.spawn({ prompt: 'look', description: 'Find hooks', subagentType: 'Explore' } as AgentSpawnInput)
  expect((store.get(KEPT) as { sessionId: string }).sessionId).toBe('sess-A')
  expect((store.get('agent-watch:rows:sess-B') as { sessionId: string }).sessionId).toBe('sess-B')
})

// Each session keeps its rows under its own key (TASK-0250): one shared key let
// the last session to write win (seen live 2026-11-07).
const SHARED = 'agent-watch:rows'

test('rows the shared key of 0.12.0 holds for this session are restored and moved to its own key (TASK-0250)', async ($, on) => {
  mock.clock(on, { now: 2_000 })
  const store = storeOf(on, { [SHARED]: kept('sess-A') })
  on('session.id', () => ({ value: 'sess-A' }))
  engine(on, { value: [] as AgentInfo[] })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ text: /shell · Tail the log/ }))?.text).toBeDefined()
  await ui.unmount()
  expect((store.get(KEPT) as { sessionId: string }).sessionId).toBe('sess-A')
  expect(store.has(SHARED)).toBe(false)
})

test("another session's rows under the shared key are neither restored nor removed while recent (TASK-0250)", async ($, on) => {
  mock.clock(on, { now: 2_000 })
  const store = storeOf(on, { [SHARED]: kept('sess-B') })
  on('session.id', () => ({ value: 'sess-A' }))
  engine(on, { value: [] as AgentInfo[] })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /Tail the log/ })).toBeUndefined()
  await ui.unmount()
  expect((store.get(SHARED) as { sessionId: string }).sessionId).toBe('sess-B')
})

test("session.start deletes other sessions' rows not written for a week, and nothing else (TASK-0250)", async ($, on) => {
  const now = 8 * 24 * 60 * 60 * 1000
  mock.clock(on, { now })
  const store = storeOf(on, {
    'agent-watch:rows:sess-old': { ...kept('sess-old'), savedAt: 0 },
    'agent-watch:rows:sess-new': { ...kept('sess-new'), savedAt: now - 1_000 },
    // The shared key of 0.12.0 has no time: its rows' latest start or end (900) dates it.
    [SHARED]: kept('sess-X'),
    'agent-watch:other': 'left alone',
  })
  on('session.id', () => ({ value: 'sess-A' }))
  engine(on, { value: [] as AgentInfo[] })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect([...store.keys()].sort()).toEqual(['agent-watch:other', 'agent-watch:rows:sess-new'])
})

test('/agent-watch theme light pins Daylight for the next render; a bad value answers with usage', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
  on('config.list', () => ({ value: [{ key: 'theme', value: 'dark' } as ConfigRow] }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: false })

  const bad = (await $.command.run({ command: 'agent-watch', args: 'theme blue' } as never)) as { text: string }
  expect(bad.text).toBe('Unknown theme "blue". Usage: /agent-watch theme dark|light|auto')

  const pinned = (await $.command.run({ command: 'agent-watch', args: 'theme light' } as never)) as { text: string }
  expect(pinned.text).toBe('Colours: Daylight (pinned; "theme auto" follows the theme setting again)')
  const { text } = (await $.command.run({ command: 'agent-watch', args: '' } as never)) as { text: string }
  const ui = await $.ui.mount({ ...OUTPUT(text), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^AGENTS$/ }))?.props.color).toBe(TOKENS.light['text-1'])
  await ui.unmount()
})
