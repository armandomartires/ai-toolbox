// Preview scenes (scripts/preview-mods.py, preview/scene-kit.ts): the Sessions panel
// in this mod's own pane, and in Compass's pane behind a stand-in board. Not a test:
// the script runs this file as one in a scratch copy of the mod.
import { test } from 'claude-code/testing'
import type { Register } from 'claude-code'

import { TOKENS } from '../hooks/sigma'
import { orchestrator, populate } from './fixtures'
import { REQUEST } from './request'
import { runScenes, type Scene } from './scene-kit'

// task-orchestrator's ledger and the populated session are ./fixtures, the tests' own. A stand-in for Compass's board follows (the kit loads an inline register without its closure: literals only).
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

const scenes: Record<string, Scene> = {
  'Agents pane': { requestId: 'agent-watch', title: 'Agents', sizes: [[80, 40], [120, 40], [60, 24]], surfaces: ['desktop', 'terminal'], populate },
  "Compass's pane (board stand-in)": { requestId: 'task-compass', plugin: 'task-compass', title: 'Compass', sizes: [[80, 60]], surfaces: ['desktop'], populate },
}

runScenes(test, 'agent-watch', scenes, REQUEST, { plugins: [{ name: 'task-orchestrator', register: orchestrator }, { name: 'task-compass', register: board }] }, TOKENS)
