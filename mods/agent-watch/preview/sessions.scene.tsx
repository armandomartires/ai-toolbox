// Preview scenes (scripts/preview-mods.py): the Sessions panel drawn by the
// test kit at several sizes, its trees handed to the preview page. Not a test:
// the script copies this file into a scratch copy of the mod as a test, and
// the kit's failure message is how a tree leaves it (the kit has no files).
import { mock, test } from 'claude-code/testing'
import type { AgentInfo, AgentSpawnInput, EngineInterface, On, Register } from 'claude-code'

const SCENES: { name: string; surface: 'desktop' | 'terminal'; columns: number; rows: number; requestId: string }[] = [
  { name: 'Agents pane · desktop · default', surface: 'desktop', columns: 80, rows: 40, requestId: 'agent-watch' },
  { name: 'Agents pane · desktop · wide', surface: 'desktop', columns: 120, rows: 40, requestId: 'agent-watch' },
  { name: 'Agents pane · desktop · short', surface: 'desktop', columns: 60, rows: 24, requestId: 'agent-watch' },
  { name: 'Agents pane · terminal', surface: 'terminal', columns: 80, rows: 50, requestId: 'agent-watch' },
  { name: "Compass's pane (board stand-in) · desktop", surface: 'desktop', columns: 80, rows: 60, requestId: 'task-compass' },
]

const engine = (on: On, listed: { value: AgentInfo[] }) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.view', () => ({ value: {} }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('classic.SubagentStop', () => ({}))
  on('agent.list', () => ({ value: listed.value }))
  on('agent.spawn', (_, e) => ({ model: 'm', agentId: `id-${e.description}` }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', () => ({ turnId: 't' }))
  on('tool.call', (_, e) => (e.tool === 'Workflow' ? { result: { status: 'async_launched', taskId: 't', runId: 'wf_1', workflowName: 'review' } } : { result: {} }))
}

// task-orchestrator's ledger mid-run, and a stand-in for Compass's board (the kit loads an inline register without its closure: literals only).
const orchestrator: Register = on => {
  on('session.start', async ($, e, next) => {
    const task = { requested: { model: 'sonnet', effort: 'medium' }, deps: [] as string[], createdAt: 500 }
    await $.state.set({ plugin: 'task-orchestrator', key: 'policy' } as const, 'balanced')
    await $.state.set({ plugin: 'task-orchestrator', key: 'enabled' } as const, true)
    await $.state.set({ plugin: 'task-orchestrator', key: 'ledger' } as const, [
      { ...task, id: 'T1', role: 'builder', objective: 'Write the model', status: 'running', agentId: 'id-T1 builder', startedAt: 1_000, observed: { model: 'claude-sonnet-5-5', effort: 'medium', at: 1_100 } },
      { ...task, id: 'T2', role: 'reviewer', objective: 'Review it', status: 'completed', startedAt: 600, endedAt: 900 },
      { ...task, id: 'T3', role: 'tester', objective: 'Test it', status: 'queued', deps: ['T1'] },
    ])
    return next(e)
  })
}
const board: Register = on => {
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const below = await next(e).catch(() => undefined)
    return (
      <Box flexDirection="column">
        <Box borderStyle="single" paddingX={1} height={8}>
          <Text>SPRINTS (stand-in for Compass's board)</Text>
        </Box>
        {below as never}
      </Box>
    )
  })
}

const usage = (tokens: number) => ({ input_tokens: tokens, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })

const populate = async ($: EngineInterface, on: On) => {
  const clock = mock.clock(on, { now: 1_000 })
  const listed = { value: [] as AgentInfo[] }
  engine(on, listed)
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
}

test('preview: agent-watch', { plugins: [{ name: 'task-orchestrator', register: orchestrator }, { name: 'task-compass', register: board }] }, async ($, on) => {
  await populate($, on)
  const out: unknown[] = []
  for (const scene of SCENES) {
    const props = { title: scene.requestId === 'agent-watch' ? 'Agents' : 'Compass', isFocused: false, bodyColumns: scene.columns, placement: 'dock', scroll: { offset: 0, bodyRows: scene.rows }, view: {} }
    const ui = await $.ui.mount({ plugin: scene.requestId, component: 'Pane', requestId: scene.requestId, surface: scene.surface, props } as never)
    out.push({ mod: 'agent-watch', ...scene, tree: await ui.drawn() })
    await ui.unmount()
  }
  throw new Error(`@@PREVIEW@@${encodeURIComponent(JSON.stringify(out))}@@END@@`)
})
