// Preview scenes (scripts/preview-mods.py): Compass's pane drawn by the test
// kit from a board (the repo's own .ai/GOALS.md in the script's scratch copy),
// its trees handed to the preview page by the kit's failure message. Not a
// test: the script renames it into one in that copy.
import { mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { GOALS } from './goals.fixture'

const SCENES: { name: string; surface: 'desktop' | 'terminal'; columns: number; rows: number }[] = [
  { name: 'Compass pane · desktop · default', surface: 'desktop', columns: 76, rows: 40 },
  { name: 'Compass pane · desktop · narrow', surface: 'desktop', columns: 48, rows: 40 },
  { name: 'Compass pane · desktop · wide', surface: 'desktop', columns: 120, rows: 50 },
  { name: 'Compass pane · terminal', surface: 'terminal', columns: 100, rows: 40 },
]

const engine = (on: On) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__task-compass__${e.name}` } }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('classic.CwdChanged', () => ({}))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.cwd', () => ({ value: '/p' }))
  on('fs.stat', (_, e) => {
    if (!/[\\/]p[\\/]\.ai[\\/]GOALS\.md$/.test(e.path)) throw new Error('ENOENT')
    return { value: { kind: 'file', size: GOALS.length, mtimeMs: 1, isLink: false } }
  })
  on('fs.read', () => ({ value: GOALS }))
  on('fs.write', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
}

test('preview: task-compass', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'Write the model', status: 'completed' }, { content: 'Render the dots', status: 'in_progress' }, { content: 'Test it', status: 'pending' }] } as never)
  await clock.advance(12_000)
  const out: unknown[] = []
  for (const scene of SCENES) {
    const props = { title: 'Compass', isFocused: false, bodyColumns: scene.columns, placement: 'dock', scroll: { offset: 0, bodyRows: scene.rows }, view: {} }
    const ui = await $.ui.mount({ plugin: 'task-compass', component: 'Pane', requestId: 'task-compass', surface: scene.surface, props } as never)
    out.push({ mod: 'task-compass', ...scene, tree: await ui.drawn() })
    await ui.unmount()
  }
  throw new Error(`@@PREVIEW@@${encodeURIComponent(JSON.stringify(out))}@@END@@`)
})
