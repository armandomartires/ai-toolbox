// The Codex bundle's MCP server and SessionStart hook, on node's test runner:
//   node --test mods/task-compass/codex/scripts/codex.test.ts
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { answerLine, handle, STORY_TOOL } from './mcp-server.ts'
import { folderOf, sessionStart } from './session-start.ts'
import { isMain } from './main.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dirs: string[] = []
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })))

const GOALS = '## Sprint 1 — Ports\n- [x] OpenCode port\n- [>] Codex port\n- [ ] Marketplace entry\n'
const folder = (goals?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'compass-cx-'))
  dirs.push(dir)
  if (goals !== undefined) {
    mkdirSync(join(dir, '.ai'))
    writeFileSync(join(dir, '.ai', 'GOALS.md'), goals)
  }
  return dir
}

test('initialize answers with the client protocol, tools capability and server info', () => {
  const reply = handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, folder())
  assert.deepEqual(reply, {
    jsonrpc: '2.0',
    id: 1,
    result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'task-compass', version: '0.1.0' } },
  })
})

test('a notification gets no reply; ping and tools/list answer', () => {
  assert.equal(handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, folder()), undefined)
  assert.deepEqual(handle({ jsonrpc: '2.0', id: 'p', method: 'ping' }, folder()), { jsonrpc: '2.0', id: 'p', result: {} })
  const list = handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, folder())
  assert.deepEqual(list?.result, { tools: [STORY_TOOL] })
  assert.deepEqual(STORY_TOOL.inputSchema.required, ['story'])
})

test('tools/call story sets the status in .ai/GOALS.md', () => {
  const dir = folder(GOALS)
  const reply = handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'story', arguments: { story: '1.2', status: 'done' } } }, dir)
  assert.deepEqual(reply?.result, { content: [{ type: 'text', text: 'Story 1.2 "Codex port" is now Done.' }], isError: false })
  assert.equal(readFileSync(join(dir, '.ai', 'GOALS.md'), 'utf8'), GOALS.replace('- [>] Codex port', '- [x] Codex port'))
})

test('errors: unknown tool, unknown method, invalid request, parse error', () => {
  assert.equal(handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope' } }, folder())?.error?.code, -32602)
  assert.equal(handle({ jsonrpc: '2.0', id: 5, method: 'resources/list' }, folder())?.error?.code, -32601)
  assert.equal(handle({ id: 6, method: 'ping' }, folder())?.error?.code, -32600)
  assert.deepEqual(JSON.parse(answerLine('{not json', folder()) ?? ''), { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  assert.equal(answerLine('   ', folder()), undefined)
  assert.equal(JSON.parse(answerLine('[1]', folder()) ?? '').error.code, -32600)
})

test('the server runs over stdio as a process, one reply line per request', () => {
  const dir = folder(GOALS)
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'story', arguments: { story: '1.3', status: 'in_progress' } } },
  ].map(line => JSON.stringify(line)).join('\n') + '\n'
  const run = spawnSync(process.execPath, [join(here, 'mcp-server.ts')], { input, encoding: 'utf8', env: { ...process.env, TASK_COMPASS_DIR: dir } })
  const lines = run.stdout.trim().split('\n').map(line => JSON.parse(line))
  assert.deepEqual(lines.map(line => line.id), [1, 2], run.stderr)
  assert.match(lines[1].result.content[0].text, /Story 1\.3 "Marketplace entry" is now In progress\./)
  assert.match(readFileSync(join(dir, '.ai', 'GOALS.md'), 'utf8'), /- \[>\] Marketplace entry/)
})

test('the SessionStart hook prints the open stories as additional context', () => {
  const out = JSON.parse(sessionStart(folder(GOALS)))
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart')
  const context: string = out.hookSpecificOutput.additionalContext
  assert.match(context, /^task-compass: Current sprint \(\.ai\/GOALS\.md\): Sprint 1 — Ports\. Open stories:/)
  assert.match(context, /1\.2 Codex port \[In progress\]\n {2}1\.3 Marketplace entry \[To do\]/)
  assert.doesNotMatch(context, /OpenCode port/)
  assert.match(JSON.parse(sessionStart(folder())).hookSpecificOutput.additionalContext, /no sprint board/)
})

test('the hook reads cwd from its stdin JSON, and runs as a process', () => {
  const dir = folder(GOALS)
  assert.equal(folderOf(JSON.stringify({ hook_event_name: 'SessionStart', cwd: dir })), dir)
  assert.equal(folderOf('not json'), process.cwd())
  const run = spawnSync(process.execPath, [join(here, 'session-start.ts')], { input: JSON.stringify({ cwd: dir }), encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  assert.match(JSON.parse(run.stdout).hookSpecificOutput.additionalContext, /1\.2 Codex port/)
})

test('a story call that throws answers isError, not a crashed server', () => {
  const dir = folder()
  mkdirSync(join(dir, '.ai', 'GOALS.md'), { recursive: true })
  const reply = handle({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'story', arguments: { story: '1.2', status: 'done' } } }, dir)
  const result = reply?.result as { isError: boolean; content: { text: string }[] }
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /^story failed: /)
})

test('isMain matches the entry script by real path, ignoring case on Windows', () => {
  const self = fileURLToPath(import.meta.url)
  assert.equal(isMain(import.meta.url, self), true)
  assert.equal(isMain(import.meta.url, ''), false)
  assert.equal(isMain(import.meta.url, join(dirname(self), 'mcp-server.ts')), false)
  if (process.platform === 'win32') assert.equal(isMain(import.meta.url, self.toUpperCase()), true)
})
