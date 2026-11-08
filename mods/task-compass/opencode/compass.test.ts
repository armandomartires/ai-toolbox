// The OpenCode plugin's story tool and sidebar data, on node's test runner:
//   node --test mods/task-compass/opencode/compass.test.ts
// index.ts and tui.tsx import OpenCode's own packages and are not loaded here.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { goalsFile, runStory, sidebarBoard } from './compass.ts'

const dirs: string[] = []
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })))

const folder = (goals?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'compass-oc-'))
  dirs.push(dir)
  if (goals !== undefined) {
    mkdirSync(join(dir, '.ai'))
    writeFileSync(join(dir, '.ai', 'GOALS.md'), goals)
  }
  return dir
}

const GOALS = '## Sprint 1 — Ports\n- [>] OpenCode port\n- [ ] Codex port\n- [x] Core\n'

test('the story tool writes the new status into .ai/GOALS.md', () => {
  const dir = folder(GOALS)
  assert.equal(runStory(dir, { story: '1.2', status: 'review' }), 'Story 1.2 "Codex port" is now In review.')
  assert.equal(readFileSync(goalsFile(dir), 'utf8'), GOALS.replace('- [ ] Codex port', '- [?] Codex port'))
})

test('the story tool leaves the file alone when nothing changes or the call is wrong', () => {
  const dir = folder(GOALS)
  runStory(dir, { story: '1.1', status: 'in_progress' })
  assert.match(runStory(dir, { story: '4.4', status: 'done' }), /^No story "4.4"/)
  assert.match(runStory(dir, { story: '1.1', status: 'soon' }), /^Unknown status/)
  assert.equal(readFileSync(goalsFile(dir), 'utf8'), GOALS)
})

test('a folder with no board answers so and writes nothing', () => {
  const dir = folder()
  assert.match(runStory(dir, { story: '1.1', status: 'done' }), /^No \.ai\/GOALS\.md/)
  assert.deepEqual(sidebarBoard(dir), { title: 'No .ai/GOALS.md', rows: [] })
})

test('the sidebar lists the current sprint\'s stories with their glyphs', () => {
  assert.deepEqual(sidebarBoard(folder(GOALS)), {
    title: 'Sprint 1 — Ports',
    rows: [
      { glyph: '◐', text: '1.1 OpenCode port', status: 'in_progress' },
      { glyph: '○', text: '1.2 Codex port', status: 'todo' },
      { glyph: '●', text: '1.3 Core', status: 'done' },
    ],
  })
})
