// The fixtures the tests (hooks/*.test.tsx) and the preview scenes (preview/*.scene.tsx)
// share, so a scene draws exactly the state the tests assert on. Plain TS: only tests and
// scenes import it, never a hooks module (scripts/dev-mods.py skips preview/ when it copies
// a mod into a session).
import { mock } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, EngineInterface, On, Register } from 'claude-code'

export type Said = { views: unknown[] }

/** A tool call's result when the test does not say: a Workflow launches run wf_1, anything else returns nothing. */
const WORKFLOW_OR_NOTHING = (call: Record<string, unknown>): unknown =>
  call.tool === 'Workflow' ? { status: 'async_launched', taskId: 't', runId: 'wf_1', workflowName: 'review' } : {}

/** The engine beneath the mod: a list of agents the test moves, and the views the mod asked for. */
export const engine = (on: On, listed: { value: AgentInfo[] }, tool: (call: Record<string, unknown>) => unknown = WORKFLOW_OR_NOTHING): Said => {
  const said: Said = { views: [] }
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.view', (_, e) => {
    said.views.push(e)
    return { value: {} }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('classic.SubagentStop', () => ({}))
  on('agent.list', () => ({ value: listed.value }))
  on('agent.spawn', (_, e) => ({ model: 'm', agentId: `id-${e.description}` }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', () => ({ turnId: 't' }))
  on('tool.call', (_, e) => ({ result: tool(e as unknown as Record<string, unknown>) }) as never)

  return said
}

// task-orchestrator as the engine holds it: an inline plugin that writes its
// ledger (the kit loads an inline register without its closure, so it is a
// literal inside it).
export const orchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'running', agentId: 'id-T1 builder', startedAt: 1_000, observed: { model: 'claude-sonnet-5-5', effort: 'high', at: 1_100 } },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'blocked', startedAt: 600, endedAt: 900 },
      { ...task, id: 'T3', role: 'tester', objective: 'Test it', status: 'queued', deps: ['T1', 'T2'] },
    ])
    return next(e)
  })
}
export const TREE = { plugins: [{ name: 'task-orchestrator', register: orchestrator }] }

export const usage = (tokens: number) => ({ input_tokens: tokens, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })

/**
 * A session with a running agent of its own (2 calls), an orchestrator run (a
 * running worker, a blocked task, a queued one) and a Workflow run (one agent
 * running, one failed with 1.2k tokens): six agents, two of them ended.
 */
export const populate = async ($: EngineInterface, on: On) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  const said = engine(on, listed)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'p', description: 'Scan docs', subagentType: 'Explore' } as AgentSpawnInput)
  for (let i = 0; i < 2; i++) await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'id-Scan docs' })
  await $.agent.spawn({ prompt: 'p', description: 'T1 builder', subagentType: 'task-orchestrator:builder' } as AgentSpawnInput)
  await $.tool.call({ tool: 'Workflow', script: 'export const meta = {}' } as never)
  await $.agent.spawn({ prompt: 'p', description: 'review:code', subagentType: 'Explore', workflow: { runId: 'wf_1', agentIndex: 1 } } as AgentSpawnInput)
  await $.agent.spawn({ prompt: 'p', description: 'review:tests', subagentType: 'Explore', workflow: { runId: 'wf_1', agentIndex: 2 } } as AgentSpawnInput)
  listed.value = [
    { id: 'id-Scan docs', type: 'Explore', description: 'Scan docs', status: 'running' },
    { id: 'id-T1 builder', type: 'task-orchestrator:builder', description: 'T1 builder', status: 'running', name: 'T1', spawnedBy: 'task-orchestrator' },
  ]
  await clock.advance(1_000)
  await $.turn.complete({ agentId: 'id-review:tests', reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't1', usage: usage(1_200) })
  await clock.advance(3_000)

  return { clock, said }
}
