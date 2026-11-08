/**
 * task-compass for OpenCode, the server part: a `story` tool that sets a
 * story's status in the session folder's .ai/GOALS.md, as the Claude mod's
 * story tool does. The sidebar is tui.tsx. Written against the plugin API on
 * this host, @opencode-ai/plugin 1.18.30 (types/opencode-plugin.d.ts); see
 * mods/task-compass/README.md, *Portability*.
 */
import { tool } from '@opencode-ai/plugin'
import type { Plugin } from '@opencode-ai/plugin'

import { runStory } from './compass.ts'
import { STORY_DESCRIPTION } from './story.ts'

const server: Plugin = async ({ directory }) => ({
  tool: {
    story: tool({
      description: STORY_DESCRIPTION,
      args: {
        story: tool.schema.string().describe('The story id, <sprint>.<story>, e.g. "3.2".'),
        status: tool.schema
          .string()
          .optional()
          .describe('The new status: backlog, todo, in_progress, review, blocked or done.'),
      },
      async execute(args, context) {
        return runStory(context.directory || directory, args)
      },
    }),
  },
})

export default { id: 'task-compass', server }
