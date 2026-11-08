/**
 * The `story` tool and the board as text, for a harness that has no Compass
 * pane (OpenCode, Codex). Pure: it takes GOALS.md's text and returns the new
 * text and the answer; the harness reads and writes the file. Imports only
 * board.ts (ADR-0054 clause 4); opencode/ and codex/scripts/ carry
 * byte-identical copies (check-mods.py rule 10). The Claude plugin keeps its
 * own tool in claude/hooks/register.tsx, which also reads a project-workflow
 * `.ai/` layer and marks the current story on the pane.
 */
import type { Sprint, Status, Story } from './board.ts'
import { currentSprint, parseSprints, setStoryStatus, statusFromWords, STATUSES } from './board.ts'

/** Where the ports read the board, relative to the session's folder. */
export const GOALS_PATH = '.ai/GOALS.md'

export const LABEL: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  review: 'In review',
  blocked: 'Blocked',
  done: 'Done',
}

/** One glyph per status, as the Compass pane draws them. */
export const GLYPH: Record<Status, string> = {
  backlog: '◌',
  todo: '○',
  in_progress: '◐',
  review: '▲',
  blocked: '◆',
  done: '●',
}

export const STORY_DESCRIPTION =
  `Update the person's sprint board (${GOALS_PATH}): set a story's status by its id, <sprint>.<story> (e.g. "1.2"). ` +
  'Call it unprompted as you work: in_progress when you start a story, review when you hand it over, done when it is finished, blocked when stuck. ' +
  `Statuses: ${STATUSES.join(', ')}. Without a status it only reports the story.`

/** A sprint by name: its title when that already says "Sprint", else "Sprint <n> <title>". */
const sprintName = (sprint: Sprint) => (/^sprint\b/i.test(sprint.title) ? sprint.title : `Sprint ${sprint.n} ${sprint.title}`)

const storyLine = (story: Story) => `  ${story.id} ${story.title} [${LABEL[story.status]}]`

/** The board as the model reads it: done sprints folded to one line. */
export const boardText = (sprints: Sprint[]): string =>
  sprints
    .flatMap(sprint =>
      sprint.status === 'done'
        ? [`${sprintName(sprint)} [done]`]
        : [
            `${sprintName(sprint)} [${LABEL[sprint.status]}]${sprint.goal ? ` goal: ${sprint.goal}` : ''}`,
            ...sprint.stories.map(storyLine),
          ],
    )
    .join('\n')

/** The current sprint, or undefined for a board with none. */
export const sprintNow = (sprints: Sprint[]): Sprint | undefined =>
  sprints.length === 0 ? undefined : sprints[currentSprint(sprints)]

/** The current sprint's stories that are not done, as a few lines of context. */
export const openStoriesText = (markdown: string | undefined): string => {
  if (markdown === undefined) return `No ${GOALS_PATH} in this folder, so there is no sprint board.`
  const sprint = sprintNow(parseSprints(markdown))
  if (!sprint) return `${GOALS_PATH} has no sprints yet.`
  const open = sprint.stories.filter(story => story.status !== 'done')
  const head = `Current sprint (${GOALS_PATH}): ${sprintName(sprint)}${sprint.goal ? `, goal: ${sprint.goal}` : ''}.`
  if (open.length === 0) return `${head} Every story in it is done.`

  return [
    `${head} Open stories:`,
    ...open.map(storyLine),
    'Keep their status current with the story tool (id and status).',
  ].join('\n')
}

export type StoryInput = { story?: unknown; status?: unknown }

/** What a call of the story tool does: the answer, and GOALS.md's new text when it changed. */
export type StoryAnswer = { result: string; markdown?: string }

/** The story tool on GOALS.md's text; undefined text is a folder with no board. */
export const answerStory = (markdown: string | undefined, input: StoryInput): StoryAnswer => {
  if (markdown === undefined) {
    return { result: `No ${GOALS_PATH} in this folder. Create one: each "## " heading is a sprint, each "- [ ] item" under it a story.` }
  }
  const sprints = parseSprints(markdown)
  const id = String(input.story ?? '').trim().replace(/^s(?:tory)?\s*/i, '')
  const story = sprints.flatMap(sprint => sprint.stories).find(one => one.id === id)
  if (!story) return { result: `No story "${id}" in ${GOALS_PATH}. Ids are <sprint>.<story>:\n${boardText(sprints)}` }
  if (input.status === undefined || input.status === null || input.status === '') {
    return { result: `Story ${id} "${story.title}" is ${LABEL[story.status]}.` }
  }
  const raw = String(input.status)
  const status = (STATUSES as string[]).includes(raw) ? (raw as Status) : statusFromWords(raw)
  if (!status) return { result: `Unknown status "${raw}". Use one of: ${STATUSES.join(', ')}.` }
  const next = setStoryStatus(markdown, id, status)
  if (next === undefined) return { result: `Could not find story ${id}'s line in ${GOALS_PATH}.` }
  const result = `Story ${id} "${story.title}" is now ${LABEL[status]}.`

  return next === markdown ? { result } : { result, markdown: next }
}
