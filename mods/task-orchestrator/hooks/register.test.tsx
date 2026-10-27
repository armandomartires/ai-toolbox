import { expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, On } from 'claude-code'

/** The engine beneath the mod: registrations answered, spawns numbered, settings as given. */
const engine = (on: On, options: { settings?: unknown; denySpawn?: string } = {}) => {
  const spawned: { type: string; model?: string; name?: string; prompt: string }[] = []
  const registered: Record<string, unknown>[] = []
  const stopped: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__task-orchestrator__${e.name}` } }))
  on('agent.register', (_, e) => {
    registered.push(e as unknown as Record<string, unknown>)
    return { value: { agent: `task-orchestrator:${e.name}` } }
  })
  // A plugin's spawn reaches the engine as an Agent tool call in the
  // background; the model's reaches agent.spawn. Both land in `spawned`.
  const spawn = (type: string, model: string | undefined, name: string | undefined, prompt: string) => {
    if (options.denySpawn && model === options.denySpawn) return undefined
    spawned.push({ type, model, name, prompt })
    return { agentId: `agent-${spawned.length}`, model: `${model ?? 'inherit'}-resolved` }
  }
  // The kit raises a plugin's spawn in the Agent tool's shape (`subagent_type`)
  // and reads the record it hands the plugin from `result`; the model's spawn
  // comes as AgentSpawnInput. One stub answers both.
  on('agent.spawn', (_, e) => {
    const call = e as unknown as { subagentType?: string; subagent_type?: string; model?: string; name?: string; prompt: string }
    const got = spawn(call.subagentType ?? call.subagent_type ?? 'general-purpose', call.model, call.name, call.prompt)
    return got ? ({ model: got.model, agentId: got.agentId, result: { agentId: got.agentId, resolvedModel: got.model } } as never) : { deny: `model ${call.model} is not available` }
  })
  on('settings.read', () => ({ value: options.settings ?? {} }))
  on('session.cwd', () => ({ value: '/p' }))
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.append', (_, e, next) => next(e))
  on('fs.read', () => { throw new Error('ENOENT') })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('tool.call', (_, e) => {
    if (e.tool === 'TaskStop') stopped.push(String((e as { task_id?: string }).task_id))
    return { result: 'ok' }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return { spawned, registered, stopped }
}

const dispatch = (input: Record<string, unknown>) => ({ tool: 'mcp__task-orchestrator__dispatch', ...input })

const report = (status: string, next = 'review it') => `Status: ${status}\nFindings: found\nFiles: none\nChecks: none run\nEvidence: the read\nRisks: none\nNext: ${next}`

test('dispatch routes, registers the profile with model and effort, spawns a real subagent and records its id', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  mock.env(on, { HOME: '/home/x' })
  const world = engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })

  // Off by default: nothing is dispatched.
  const off = await $.tool.call(dispatch({ id: 'T1', class: 'lookup', objective: 'Find the parser' }))
  expect(String(off.result)).toContain('is off')
  expect(world.spawned).toHaveLength(0)

  await $.command.run({ command: 'orchestrate', args: 'on' })
  const ran = await $.tool.call(dispatch({ id: 'T1', class: 'lookup', objective: 'Find the parser', inputs: ['src/'] }))
  expect(String(ran.result)).toContain('T1 → scout [agent-1] → requested haiku/low → resolved haiku-resolved, effort unverified → running')
  expect(world.spawned[0]).toMatchObject({ type: 'task-orchestrator:scout', model: 'haiku', name: 'T1' })
  expect(world.spawned[0]?.prompt).toContain('# Assignment T1 — role scout (lookup)')
  const scout = world.registered.find(one => one.name === 'scout')
  expect(scout).toMatchObject({ model: 'haiku', effort: 'low', tools: ['Read', 'Grep', 'Glob', 'LS'] })
  expect(scout?.disallowedTools).toContain('Agent')

  // The worker's first model request shows the effective settings.
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-haiku-4-5', effort: 'low', messageCount: 1, agentId: 'agent-1' })) { /* drained */ }
  const status = await $.tool.call({ tool: 'mcp__task-orchestrator__status' })
  expect(String(status.result)).toContain('observed claude-haiku-4-5/low')
  expect(String(status.result)).toContain('coordinator model claude-fable-5-1')

  // Its turn.complete closes the task with the parsed report; collect returns it.
  await $.turn.complete({ agentId: 'agent-1', reason: 'answer', answer: report('completed'), durationMs: 1, isAborted: false, turnId: 't' })
  const got = await $.tool.call({ tool: 'mcp__task-orchestrator__collect', ids: ['T1'] })
  expect(String(got.result)).toContain('→ completed → review it')
  expect(String(got.result)).toContain('run: done')
})

test('overrides are disclosed, a gated effort is refused, and an unavailable model falls back visibly', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, { CLAUDE_EFFORT: 'high', CLAUDE_CODE_SUBAGENT_MODEL: 'opus' })
  const world = engine(on, { settings: { model: 'fable', modelSettings: { 'claude-sonnet-5-5': { effortLevel: 'high' } } }, denySpawn: 'haiku' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  const status = await $.tool.call({ tool: 'mcp__task-orchestrator__status' })
  expect(String(status.result)).toContain('settings model = fable')
  expect(String(status.result)).toContain('modelSettings.claude-sonnet-5-5.effortLevel = high')
  expect(String(status.result)).toContain('env CLAUDE_CODE_SUBAGENT_MODEL = opus: forces every subagent')

  const gated = await $.tool.call(dispatch({ id: 'R1', class: 'review', objective: 'Review', effort: 'xhigh' }))
  expect(String(gated.result)).toContain('opt-in high-effort')
  const bad = await $.tool.call(dispatch({ id: 'R2', class: 'review', objective: 'Review', effort: 'ultra' }))
  expect(String(bad.result)).toContain('nothing was sent')
  expect(world.spawned).toHaveLength(0)

  // haiku is refused by the engine: the task is blocked and says so; the next lookup falls back to sonnet.
  const first = await $.tool.call(dispatch({ id: 'L1', class: 'lookup', objective: 'Find it' }))
  expect(String(first.result)).toContain('blocked → spawn refused: model haiku is not available')
  const second = await $.tool.call(dispatch({ id: 'L2', class: 'lookup', objective: 'Find it again' }))
  expect(String(second.result)).toContain('requested sonnet/low')
  expect(String(second.result)).toContain('note: model haiku is unavailable here: falling back to sonnet')
})

test('limits hold: three workers, queued fourth, no nesting, no overlapping writers, fenced tools', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const world = engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  for (const id of ['S1', 'S2', 'S3']) await $.tool.call(dispatch({ id, class: 'lookup', objective: `look ${id}` }))
  const fourth = await $.tool.call(dispatch({ id: 'S4', class: 'lookup', objective: 'look S4' }))
  expect(String(fourth.result)).toContain('S4 → scout → requested haiku/low → unverified → queued')
  expect(world.spawned).toHaveLength(3)

  // A worker may not spawn, through the Agent tool or anything else.
  const nested = await $.agent.spawn({ prompt: 'help', description: 'nested', subagentType: 'Explore', parentAgentId: 'agent-1' } as AgentSpawnInput)
  expect(nested.deny).toContain('workers do not delegate')
  const denied = await $.tool.call({ tool: 'Agent', prompt: 'x', description: 'y', agentId: 'agent-1' })
  expect(denied.deny).toContain('may not call Agent')
  // A read-only worker may not run a shell or write; a writer may not write outside its files.
  const shell = await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'agent-2' })
  expect(shell.deny).toContain('read-only')
  // The main loop's calls are untouched.
  const main = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(main.deny).toBeUndefined()

  // One ends: the queued one starts.
  await $.turn.complete({ agentId: 'agent-1', reason: 'answer', answer: report('completed'), durationMs: 1, isAborted: false, turnId: 't' })
  expect(world.spawned.map(one => one.name)).toEqual(['S1', 'S2', 'S3', 'S4'])

  // Writers: one at a time without isolation; a write outside the allowed files is refused.
  for (const id of ['S2', 'S3', 'S4']) await $.turn.complete({ agentId: world.spawned.find(one => one.name === id) ? `agent-${world.spawned.findIndex(one => one.name === id) + 1}` : '', reason: 'answer', answer: report('completed'), durationMs: 1, isAborted: false, turnId: 't' })
  const b1 = await $.tool.call(dispatch({ id: 'B1', class: 'implementation', objective: 'change a', allowedFiles: ['src/a.ts'] }))
  expect(String(b1.result)).toContain('B1 → builder [agent-5]')
  const b2 = await $.tool.call(dispatch({ id: 'B2', class: 'implementation', objective: 'change b', allowedFiles: ['src/b.ts'] }))
  expect(String(b2.result)).toContain('queued')
  const edit = await $.tool.call({ tool: 'Edit', file_path: '/p/src/b.ts', old_string: 'a', new_string: 'b', agentId: 'agent-5' })
  expect(edit.deny).toContain('outside its allowed files')
  const ok = await $.tool.call({ tool: 'Edit', file_path: '/p/src/a.ts', old_string: 'a', new_string: 'b', agentId: 'agent-5' })
  expect(ok.deny).toBeUndefined()
})

test('a failed review blocks a done report, a worker profile taken through the Agent tool is tracked, and off keeps the ledger', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const world = engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  await $.tool.call(dispatch({ id: 'B1', class: 'implementation', objective: 'build', allowedFiles: ['src/a.ts'] }))
  await $.tool.call(dispatch({ id: 'R1', class: 'review', objective: 'review B1', deps: ['B1'] }))
  await $.turn.complete({ agentId: 'agent-1', reason: 'answer', answer: report('completed'), durationMs: 1, isAborted: false, turnId: 't' })
  expect(world.spawned.map(one => one.name)).toEqual(['B1', 'R1'])
  expect(world.spawned[1]?.prompt).toContain('B1 (builder, completed): found')
  await $.turn.complete({ agentId: 'agent-2', reason: 'answer', answer: report('failed', 'fix the null check'), durationMs: 1, isAborted: false, turnId: 't' })
  const got = await $.tool.call({ tool: 'mcp__task-orchestrator__collect' })
  expect(String(got.result)).toContain('run: failed (R1 (reviewer) failed)')
  // A worker whose turn ended without an answer is failed too.
  await $.tool.call(dispatch({ id: 'S1', class: 'lookup', objective: 'look' }))
  await $.turn.complete({ agentId: 'agent-3', reason: 'error', answer: '', durationMs: 1, isAborted: true, turnId: 't' })
  expect(String((await $.tool.call({ tool: 'mcp__task-orchestrator__status' })).result)).toContain('S1 → scout [agent-3] → requested haiku/low → resolved haiku-resolved, effort unverified → failed → the worker\'s turn ended by error')

  // The model takes a worker profile through the Agent tool: tracked and fenced like any worker.
  const direct = await $.agent.spawn({ prompt: 'look', description: 'direct scout', subagentType: 'task-orchestrator:scout', name: 'D1' } as AgentSpawnInput)
  expect(direct.agentId).toBe('agent-4')
  const fenced = await $.tool.call({ tool: 'Write', file_path: '/p/x', content: 'x', agentId: 'agent-4' })
  expect(fenced.deny).toContain('read-only')

  // Cancel stops a running worker through TaskStop.
  const cancelled = await $.tool.call({ tool: 'mcp__task-orchestrator__cancel', id: 'D1' })
  expect(String(cancelled.result)).toBe('D1 cancelled')
  expect(world.stopped).toEqual(['agent-4'])

  // Off: no new dispatch, the ledger stays, the fence lifts, nothing is discarded.
  const off = await $.command.run({ command: 'orchestrate', args: 'off' })
  expect(off.text).toContain('open task(s) stay in the ledger')
  const refused = await $.tool.call(dispatch({ id: 'S2', class: 'lookup', objective: 'look' }))
  expect(String(refused.result)).toContain('nothing was dispatched')
  const status = await $.tool.call({ tool: 'mcp__task-orchestrator__status' })
  expect(String(status.result)).toContain('task-orchestrator off')
  expect(String(status.result)).toContain('R1 → reviewer')
})

test('the policy changes the table and the profiles without touching code, and is stored', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const world = engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const before = world.registered.filter(one => one.name === 'planner').at(-1)
  expect(before).toMatchObject({ model: 'opus', effort: 'high' })
  const changed = await $.command.run({ command: 'orchestrate', args: 'policy economy' })
  expect(changed.text).toContain('- architecture: planner → sonnet/high')
  expect(world.registered.filter(one => one.name === 'planner').at(-1)).toMatchObject({ model: 'sonnet', effort: 'high' })
  expect((await $.command.run({ command: 'orchestrate', args: 'routing' })).text).toContain('policy economy')
  const usage = await $.command.run({ command: 'orchestrate', args: 'policy luxury' })
  expect(usage.text).toContain('usage: /orchestrate policy')
  const providers = await $.command.run({ command: 'orchestrate', args: 'providers enable openai' })
  expect(providers.text).toContain('not enabled: OpenAI (chat completions): no adapter is implemented')
})
