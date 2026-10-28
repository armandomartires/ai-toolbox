import { expect, mock, test } from 'claude-code/testing'
import type { AgentSpawnInput, ConfigRow, On } from 'claude-code'

import { TOKENS } from './sigma'

const NO_VERDICT = 'The server-side auto mode classifier gave no verdict for Agent: the request that produced this action did not ask for one. Issue the action again once, as-is; if it is denied again, continue with other tasks that don\'t require it and tell the user that auto mode could not evaluate it.'

/**
 * The engine beneath the mod: registrations answered, spawns numbered, settings
 * as given. `noVerdict` is how many of the plugin's spawns auto mode refuses
 * with no verdict, as it did in a desktop session; the model's own pass.
 */
const engine = (on: On, options: { settings?: unknown; denySpawn?: string; noVerdict?: number } = {}) => {
  const spawned: { type: string; model?: string; name?: string; prompt: string }[] = []
  const refused: string[] = []
  const registered: Record<string, unknown>[] = []
  const stopped: string[] = []
  const statuses: (string | undefined)[] = []
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
    if (call.subagent_type !== undefined && refused.length < (options.noVerdict ?? 0)) {
      refused.push(call.name ?? '')
      return { deny: NO_VERDICT }
    }
    const got = spawn(call.subagentType ?? call.subagent_type ?? 'general-purpose', call.model, call.name, call.prompt)
    return got ? ({ model: got.model, agentId: got.agentId, result: { agentId: got.agentId, resolvedModel: got.model } } as never) : { deny: `model ${call.model} is not available` }
  })
  on('settings.read', () => ({ value: options.settings ?? {} }))
  on('session.cwd', () => ({ value: '/p' }))
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.append', (_, e, next) => next(e))
  on('fs.read', () => { throw new Error('ENOENT') })
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
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
  return { spawned, registered, stopped, statuses, refused }
}

const dispatch = (input: Record<string, unknown>) => ({ tool: 'mcp__task-orchestrator__dispatch', ...input })

/** The text of `answer` from the line starting `from` on. */
const byLine = (answer: string, from: string) => answer.slice(answer.indexOf(from))

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

test('a spawn auto mode gives no verdict is issued again once, then handed to the coordinator\'s own Agent call and adopted', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const once = engine(on, { noVerdict: 1 })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  // Refused once: the second, identical issue starts it.
  const retried = await $.tool.call(dispatch({ id: 'T1', class: 'lookup', objective: 'Find the parser' }))
  expect(once.refused).toEqual(['T1'])
  expect(String(retried.result)).toContain('T1 → scout [agent-1] → requested haiku/low')
  expect(String(retried.result)).toContain('→ running')
  expect(once.spawned[0]?.prompt).toContain('# Assignment T1')
})

test('refused twice, a task waits for the hand-off; its dependant says what it waits on and collect does not wait it out', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const world = engine(on, { noVerdict: 99 })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  const held = String((await $.tool.call(dispatch({ id: 'H1', class: 'lookup', objective: 'Find the parser' }))).result)
  expect(world.refused).toEqual(['H1', 'H1'])
  expect(held).toContain('H1 → scout → requested haiku/low → unverified → blocked → auto mode gave the orchestrator\'s spawn no verdict, twice')
  expect(held).toContain('subagent_type "task-orchestrator:scout", model "haiku", effort "low", description "H1 scout"')
  expect(held).toContain('assignment for H1 (the Agent call\'s prompt, unchanged):\n# Assignment H1 — role scout (lookup)')

  // A dependant queues, says what holds it, and collect returns it at once.
  const dependant = String((await $.tool.call(dispatch({ id: 'H2', class: 'lookup', objective: 'Read what H1 found', deps: ['H1'] }))).result)
  expect(dependant).toContain('stalled: waits on H1 (blocked): dispatch H1 again under its id to retry it, or cancel H2')
  const status = String((await $.tool.call({ tool: 'mcp__task-orchestrator__status' })).result)
  expect(status).toContain('- H2: waits on H1 (blocked): dispatch H1 again under its id to retry it, or cancel H2')
  const got = String((await $.tool.call({ tool: 'mcp__task-orchestrator__collect', ids: ['H2'], timeoutMs: 600_000 })).result)
  expect(got).toContain('H2 → scout → requested haiku/low → unverified → queued')
  expect(got).toContain('  stalled: waits on H1 (blocked)')

  // The coordinator's own Agent call of another role is refused; of the role, adopted unchanged.
  const prompt = byLine(held, '# Assignment H1')
  const wrong = await $.agent.spawn({ prompt, description: 'H1 scout', subagentType: 'task-orchestrator:builder', name: 'H1' } as AgentSpawnInput)
  expect(wrong.deny).toBe('H1 waits for a hand-off as task-orchestrator:scout, not task-orchestrator:builder')
  const adopted = await $.agent.spawn({ prompt, description: 'H1 scout', subagentType: 'task-orchestrator:scout', model: 'haiku', name: 'H1' } as AgentSpawnInput)
  expect(adopted.agentId).toBe('agent-1')
  expect(world.spawned[0]).toMatchObject({ type: 'task-orchestrator:scout', model: 'haiku', name: 'H1', prompt })
  const after = String((await $.tool.call({ tool: 'mcp__task-orchestrator__status' })).result)
  expect(after).toContain('H1 → scout [agent-1] → requested haiku/low → resolved haiku-resolved, effort unverified → running')
  expect(after).not.toContain('agent-2')
  // Fenced as any worker, and its end starts the dependant, which is handed off in turn.
  expect((await $.tool.call({ tool: 'Write', file_path: '/p/x', content: 'x', agentId: 'agent-1' })).deny).toContain('read-only')
  await $.turn.complete({ agentId: 'agent-1', reason: 'answer', answer: report('completed'), durationMs: 1, isAborted: false, turnId: 't' })
  expect(world.refused).toEqual(['H1', 'H1', 'H2', 'H2'])
  expect(String((await $.tool.call({ tool: 'mcp__task-orchestrator__status' })).result)).toContain('H2 → scout → requested haiku/low → unverified → blocked → auto mode gave')
})

test("the person's model and effort: each setting its own profile, the hand-off names it, a host setting that may replace it is said", async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const world = engine(on, { settings: { modelSettings: { 'claude-sonnet-5-5': { effortLevel: 'high' } } } })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  // Two builders on sonnet, one at the table's medium and one at high, isolated so both run.
  const medium = String((await $.tool.call(dispatch({ id: 'B1', class: 'implementation', objective: 'build a', allowedFiles: ['src/a.ts'], isolated: true, model: 'sonnet', effort: 'medium' }))).result)
  const high = String((await $.tool.call(dispatch({ id: 'B2', class: 'implementation', objective: 'build b', allowedFiles: ['src/b.ts'], isolated: true, model: 'sonnet', effort: 'high' }))).result)
  expect(world.spawned.map(one => one.type)).toEqual(['task-orchestrator:builder--sonnet-medium-wt', 'task-orchestrator:builder--sonnet-high-wt'])
  expect(world.registered.find(one => one.name === 'builder--sonnet-medium-wt')).toMatchObject({ model: 'sonnet', effort: 'medium', isolation: 'worktree' })
  expect(world.registered.find(one => one.name === 'builder--sonnet-high-wt')).toMatchObject({ model: 'sonnet', effort: 'high', isolation: 'worktree' })
  // The table's own settings keep the role's name, registered at start.
  expect(world.registered.filter(one => one.name === 'builder').at(-1)).toMatchObject({ model: 'sonnet', effort: 'medium' })
  expect(world.registered.filter(one => one.name === 'builder')).toHaveLength(1)
  // The host forces sonnet to high: medium is told, high is not.
  expect(medium).toContain('note: host setting modelSettings.claude-sonnet-5-5.effortLevel = high may replace the requested effort medium')
  expect(high).not.toContain('host setting')
})

test("a handed-off task at the person's effort names its own profile and is adopted only from it", async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const world = engine(on, { noVerdict: 99 })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  const held = String((await $.tool.call(dispatch({ id: 'H1', class: 'review', objective: 'Review it', model: 'sonnet', effort: 'medium' }))).result)
  expect(held).toContain('subagent_type "task-orchestrator:reviewer--sonnet-medium", model "sonnet", effort "medium"')
  expect(held).not.toContain('name "H1"')
  const prompt = byLine(held, '# Assignment H1')
  // The desktop's Agent tool takes no name: the prompt's header names the task.
  // The role's own profile carries the table's high effort: refused.
  const plain = await $.agent.spawn({ prompt, description: 'H1 reviewer', subagentType: 'task-orchestrator:reviewer', model: 'sonnet' } as AgentSpawnInput)
  expect(plain.deny).toBe('H1 waits for a hand-off as task-orchestrator:reviewer--sonnet-medium, not task-orchestrator:reviewer')
  const adopted = await $.agent.spawn({ prompt, description: 'H1 reviewer', subagentType: 'task-orchestrator:reviewer--sonnet-medium', model: 'sonnet' } as AgentSpawnInput)
  expect(adopted.agentId).toBe('agent-1')
  // Fenced as its role: a reviewer is read-only.
  expect((await $.tool.call({ tool: 'Write', file_path: '/p/x', content: 'x', agentId: 'agent-1' })).deny).toContain('read-only')
  expect(String((await $.tool.call({ tool: 'mcp__task-orchestrator__status' })).result)).toContain('H1 → reviewer [agent-1] → requested sonnet/medium')
})

test('a re-dispatch under the id of a blocked or failed task is a counted retry, refused past the limit', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  mock.env(on, {})
  const world = engine(on, { denySpawn: 'haiku' })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' })
  expect(String((await $.tool.call(dispatch({ id: 'L1', class: 'lookup', objective: 'Find it' }))).result)).toContain('blocked → spawn refused: model haiku is not available')
  // haiku is now known refused: the retry falls back to sonnet and starts.
  const first = String((await $.tool.call(dispatch({ id: 'L1', class: 'lookup', objective: 'Find it' }))).result)
  expect(first).toContain('L1 → scout [agent-1] → requested sonnet/low')
  expect(first).toContain('note: retry 1 of 2 after blocked')
  await $.turn.complete({ agentId: 'agent-1', reason: 'answer', answer: report('failed', 'look elsewhere'), durationMs: 1, isAborted: false, turnId: 't' })
  const second = String((await $.tool.call(dispatch({ id: 'L1', class: 'lookup', objective: 'Find it in lib/' }))).result)
  expect(second).toContain('L1 → scout [agent-2]')
  expect(second).toContain('note: retry 2 of 2 after failed')
  expect(world.spawned[1]?.prompt).toContain('Find it in lib/')
  await $.turn.complete({ agentId: 'agent-2', reason: 'answer', answer: report('failed'), durationMs: 1, isAborted: false, turnId: 't' })
  expect(String((await $.tool.call(dispatch({ id: 'L1', class: 'lookup', objective: 'Find it' }))).result)).toBe('blocked: task L1 has used its 2 retries: stop and report')
  // A completed task is not dispatched again under its id.
  await $.tool.call(dispatch({ id: 'C1', class: 'lookup', objective: 'Look' }))
  await $.turn.complete({ agentId: 'agent-3', reason: 'answer', answer: report('completed'), durationMs: 1, isAborted: false, turnId: 't' })
  expect(String((await $.tool.call(dispatch({ id: 'C1', class: 'lookup', objective: 'Look' }))).result)).toBe('blocked: task C1 already exists and is completed; only a blocked, failed, partial task is retried under its id')
  expect(world.spawned).toHaveLength(3)
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

const OUTPUT = (text: string) => ({
  plugin: 'task-orchestrator',
  component: 'CommandOutput',
  props: { command: 'orchestrate', args: 'status', text, isErrored: false },
}) as const

test('/orchestrate status and routing draw as panels in the host theme; the status line is uppercase', async ($, on) => {
  mock.clock(on, { now: 1_000 })
  mock.store(on)
  mock.env(on, { HOME: '/home/x' })
  const { statuses } = engine(on)
  on('config.list', () => ({ value: [{ key: 'theme', value: 'light' } as ConfigRow] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'orchestrate', args: 'on' } as never)
  await $.tool.call(dispatch({ id: 'T1', class: 'lookup', objective: 'Find the parser' }) as never)
  expect(statuses[statuses.length - 1]).toBe('ORCH BALANCED · 1 RUNNING · 0 QUEUED')

  const status = ((await $.command.run({ command: 'orchestrate', args: 'status' } as never)) as { text: string }).text
  // The text the model reads keeps its facts.
  expect(status).toContain('T1 → scout [agent-1] → requested haiku/low')
  const LIGHT = TOKENS.light
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...OUTPUT(status), surface })
    expect((await ui.find({ type: 'Text', text: /^ORCHESTRATOR$/ }))?.props.color).toBe(LIGHT['text-1'])
    expect(await ui.find({ text: /ON · BALANCED/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^ RUNNING$/ }))?.props.color).toBe(LIGHT.cyan)
    expect((await ui.find({ type: 'Text', text: /^T1$/ }))?.props.tabular).toBe(true)
    expect(await ui.find({ text: /haiku\/low →/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^OVERRIDES IN FORCE$/ })).toBeDefined()
    await ui.unmount()
  }

  const routing = ((await $.command.run({ command: 'orchestrate', args: 'routing' } as never)) as { text: string }).text
  const ui = await $.ui.mount({ ...OUTPUT(routing), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^ROUTING$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^LOOKUP$/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^haiku\/low/ }))?.props.color).toBe(LIGHT['text-1'])
  await ui.unmount()

  const old = await $.ui.mount({ ...OUTPUT('task-orchestrator off, policy balanced'), surface: 'terminal' })
  expect((await old.find({ type: 'Text' }))?.text).toBe('engine')
  await old.unmount()
})
