// Preview scene (scripts/preview-mods.py): the Switchboard pane with Mods and Skills
// grouped by topic, seeded through the same engine hooks the tests use. Not a test:
// the script runs this file as one in a scratch copy.
import { mock, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

import { TOKENS } from '../hooks/sigma'
import { REQUEST } from './request'
import { runScenes, type Scene } from './scene-kit'

const populate = async ($: EngineInterface, on: On) => {
  mock.store(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.root', () => ({ value: '/p' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.list', () => ({ value: [{ name: 'mcp__figma__get_screenshot', description: 'x', mcp: true }, { name: 'mcp__claude_ai_Gmail__search', description: 'x', mcp: true }] }))
  on('session.usage', () => ({
    value: { context: { breakdown: { skills: { skillFrontmatter: ['legal:brief', 'legal:review-contract', 'sales:call-prep', 'sales:forecast', 'loop', 'review'].map(name => ({ name })), }, mcpTools: [] } } } as never,
  }))
  const files: Record<string, string> = {}
  for (const [name, category] of [['switchboard', 'configuration'], ['agent-watch', 'observability'], ['task-compass', 'planning'], ['task-orchestrator', 'orchestration'], ['my-experiment', '']]) {
    files[`/mods/${name}/.claude-plugin/plugin.json`] = JSON.stringify(category ? { name, category } : { name })
    files[`/mods/${name}/hooks/hooks.json`] = '{}'
  }
  mock.env(on, { CLAUDE_CODE_PLUGIN_DIRS: '/mods' })
  // The Windows CLI hands a path over as `C:\mods\...`; the fixtures are POSIX.
  const posix = (path: string) => path.replace(/^[A-Za-z]:/, '').replaceAll(String.fromCharCode(92), '/')
  on('fs.exists', (_, e) => ({ value: posix(e.path) in files }))
  on('fs.read', (_, e) => (posix(e.path) in files ? { value: files[posix(e.path)] as string } : { deny: 'ENOENT' }))
  on('fs.list', (_, e) => ({ value: posix(e.path) === '/mods' ? ['switchboard', 'agent-watch', 'task-compass', 'task-orchestrator', 'my-experiment'].map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) : [] }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'switchboard', args: 'off mod agent-watch' } as never)
  await $.command.run({ command: 'switchboard', args: 'off skill sales:forecast' } as never)
  await $.command.run({ command: 'switchboard', args: 'list' } as never)
}

const scenes: Record<string, Scene> = {
  'Switchboard pane': { requestId: 'switchboard', title: 'Switchboard', sizes: [[70, 50], [48, 50]], surfaces: ['desktop', 'terminal'], populate },
}

runScenes(test, 'switchboard', scenes, REQUEST, {}, TOKENS)
