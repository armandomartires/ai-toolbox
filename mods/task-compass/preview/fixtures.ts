// The fixtures the tests (hooks/register.test.tsx) and the preview scene (preview/board.scene.tsx)
// share, so a scene draws the engine the tests assert on. Plain TS: only tests and scenes import
// it, never a hooks module (scripts/dev-mods.py skips preview/ when it copies a mod into a session).
// The GOALS.md each one hands in is its own: a small one in the tests, the repo's in the scene.
import type { On } from 'claude-code'

/**
 * The engine beneath the mod: a .ai/GOALS.md kept in memory in /p, the session's
 * folder unless the test moves it.
 */
export const engine = (on: On, goals: string) => {
  const file = { text: goals, mtime: 1, cwd: '/p' }
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__task-compass__${e.name}` } }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('classic.CwdChanged', () => ({}))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  // The test kit's base hook for the pane, which Compass's `next(e)` reaches: it draws nothing.
  on('ui.render', { component: 'Pane', requestId: 'task-compass' }, ($, e) => {
    const { Box } = $.ui.resolve(e)

    return h(Box, null)
  })
  on('session.cwd', () => ({ value: file.cwd }))
  on('fs.stat', (_, e) => {
    if (!/[\\/]p[\\/]\.ai[\\/]GOALS\.md$/.test(e.path)) throw new Error('ENOENT')
    return { value: { kind: 'file', size: file.text.length, mtimeMs: file.mtime, isLink: false } }
  })
  on('fs.read', () => ({ value: file.text }))
  on('fs.write', (_, e) => {
    file.text = e.text
    file.mtime++
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  return file
}
