/**
 * The OpenCode plugin's file side: read and write the session folder's
 * .ai/GOALS.md around core's pure story tool (story.ts and board.ts are
 * byte-identical copies of mods/task-compass/core/; check-mods.py rule 10).
 * node:fs only, which Bun (OpenCode's runtime) and node both provide, so
 * compass.test.ts runs on node's own test runner.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Status } from './board.ts'
import { parseSprints } from './board.ts'
import { CONF_UNREADABLE, confProblem, isForge, forgeDecline, trackerOf } from './tracker.ts'
import type { Tracker } from './tracker.ts'
import { answerStory, GLYPH, GOALS_PATH, LABEL, sprintNow, storyFolder } from './story.ts'
import type { StoryInput } from './story.ts'

/** The board of the project `dir` lies in, never one inside a .ai/ (storyFolder). */
export const goalsFile = (dir: string) => join(storyFolder(dir, existsSync), GOALS_PATH)

const readGoals = (dir: string): string | undefined => {
  const file = goalsFile(dir)
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

/** The project folder's declared tracker (`tracker.conf`, in the folder `storyFolder` resolves); absent means files. */
const readTracker = (dir: string): Tracker | { error: string } => {
  const file = join(storyFolder(dir, existsSync), 'tracker.conf')
  // Anything that is not a regular file is absent, as tracker_lib.py's isfile has it; a read that fails is reported.
  let text: string | undefined
  try {
    text = statSync(file).isFile() ? readFileSync(file, 'utf8') : undefined
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return { error: CONF_UNREADABLE }
  }
  return trackerOf(text)
}

/** The `story` tool's execute: answers, and writes GOALS.md when the status changed. */
export const runStory = (dir: string, input: StoryInput): string => {
  const tracker = readTracker(dir)
  if ('error' in tracker) return confProblem(tracker.error)
  if (isForge(tracker)) return forgeDecline(tracker)
  const answer = answerStory(readGoals(dir), input)
  if (answer.markdown !== undefined) writeFileSync(goalsFile(dir), answer.markdown, 'utf8')

  return answer.result
}

export type SidebarRow = { glyph: string; text: string; status: Status }

/** What the sidebar slot draws: the current sprint's name and its stories. */
export const sidebarBoard = (dir: string): { title: string; rows: SidebarRow[] } => {
  const tracker = readTracker(dir)
  if ('error' in tracker) return { title: tracker.error, rows: [] }
  if (isForge(tracker)) return { title: `Forge: ${tracker.tracker} ${tracker.path}`, rows: [] }
  const markdown = readGoals(dir)
  if (markdown === undefined) return { title: `No ${GOALS_PATH}`, rows: [] }
  const sprint = sprintNow(parseSprints(markdown))
  if (!sprint) return { title: 'No sprints yet', rows: [] }

  return {
    title: sprint.title,
    rows: sprint.stories.map(story => ({
      glyph: GLYPH[story.status],
      text: `${story.id} ${story.title}`,
      status: story.status,
    })),
  }
}

export { LABEL }
