// Preview scenes (scripts/preview-mods.py, preview/scene-kit.ts): Compass's pane with a
// live task list, on a pinned board (snapshotted) and on this repo's own .ai/GOALS.md
// (shown, never snapshotted: the board changes with every task). Not a test: the
// script runs this file as one in a scratch copy of the mod.
import { mock, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

import { TOKENS } from '../hooks/sigma'
import { engine } from './fixtures'
import { GOALS } from './goals.fixture'
import { GOALS_LIVE } from './goals.live'
import { REQUEST } from './request'
import { runScenes, type Scene } from './scene-kit'

const populateOn = (goals: string) => async ($: EngineInterface, on: On) => {
  const clock = mock.clock(on, { now: 1_000 })
  engine(on, goals)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'Write the model', status: 'completed' }, { content: 'Render the dots', status: 'in_progress' }, { content: 'Test it', status: 'pending' }] } as never)
  await clock.advance(12_000)
}

const scenes: Record<string, Scene> = {
  'Compass pane': { requestId: 'task-compass', title: 'Compass', sizes: [[76, 40], [48, 40], [120, 50]], surfaces: ['desktop', 'terminal'], populate: populateOn(GOALS) },
  ...(GOALS_LIVE ? { 'Compass pane · this repo': { requestId: 'task-compass', title: 'Compass', sizes: [[100, 50]], surfaces: ['desktop'], populate: populateOn(GOALS_LIVE), snapshot: false } } : {}),
}

runScenes(test, 'task-compass', scenes, REQUEST, {}, TOKENS)
