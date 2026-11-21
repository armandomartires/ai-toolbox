/**
 * task-compass for Codex: the SessionStart command hook. Reads the hook's
 * JSON on stdin (its `cwd`), and prints the current sprint's open stories
 * from <cwd>/.ai/GOALS.md as additional context for the session. Never
 * blocks: any error still exits 0 with a one-line note.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { isMain } from './main.ts'
import { CONF_UNREADABLE, confProblem, forgeDecline, isForge, trackerOf } from './tracker.ts'
import { GOALS_PATH, openStoriesText } from './story.ts'

/** The hook's stdout for a session started in `dir`. */
export const sessionStart = (dir: string): string => {
  const file = join(dir, GOALS_PATH)
  const conf = join(dir, 'tracker.conf')
  // Anything that is not a regular file is absent, as tracker_lib.py's isfile has it; a read that fails is reported.
  let text: string | undefined
  let unreadable = false
  try {
    text = statSync(conf).isFile() ? readFileSync(conf, 'utf8') : undefined
  } catch (error) {
    unreadable = (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
  const tracker = unreadable ? { error: CONF_UNREADABLE } : trackerOf(text)
  const context =
    'error' in tracker
      ? confProblem(tracker.error)
      : isForge(tracker)
        ? forgeDecline(tracker)
        : openStoriesText(existsSync(file) ? readFileSync(file, 'utf8') : undefined)

  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `task-compass: ${context}` },
  })
}

/** The folder a hook input names; the process's own when it names none. */
export const folderOf = (stdin: string): string => {
  try {
    const input = JSON.parse(stdin) as { cwd?: unknown }
    if (typeof input.cwd === 'string' && input.cwd) return input.cwd
  } catch {
    // Not JSON: fall back to the working directory.
  }
  return process.cwd()
}

if (isMain(import.meta.url)) {
  let stdin = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => (stdin += chunk))
  process.stdin.on('end', () => {
    try {
      process.stdout.write(`${sessionStart(folderOf(stdin))}\n`)
    } catch (error) {
      process.stdout.write(`task-compass: could not read the board (${String(error)})\n`)
    }
  })
}
