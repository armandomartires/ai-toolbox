/**
 * task-compass for Codex: an MCP stdio server exposing the `story` tool on
 * core/ (story.ts and board.ts here are byte-identical copies of
 * mods/task-compass/core/; check-mods.py rule 10). Plain node, no SDK:
 * newline-delimited JSON-RPC 2.0 on stdin and stdout, as MCP's stdio
 * transport is. Run as `node mcp-server.ts` (Node 22.18 or later strips the
 * types). The board is <folder>/.ai/GOALS.md, the folder being
 * TASK_COMPASS_DIR when set, else the server's working directory.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { STATUSES } from './board.ts'
import { isMain } from './main.ts'
import { answerStory, GOALS_PATH, STORY_DESCRIPTION } from './story.ts'
import type { StoryInput } from './story.ts'

export const SERVER = { name: 'task-compass', version: '0.1.0' }
const PROTOCOL = '2025-06-18'

export const STORY_TOOL = {
  name: 'story',
  description: STORY_DESCRIPTION,
  inputSchema: {
    type: 'object',
    properties: {
      story: { type: 'string', description: 'The story id, <sprint>.<story>, e.g. "3.2".' },
      status: { type: 'string', enum: STATUSES, description: "The story's new status." },
    },
    required: ['story'],
  },
}

/** The story tool on a folder's .ai/GOALS.md: answers, and writes the file when the status changed. */
export const runStory = (dir: string, input: StoryInput): string => {
  const file = join(dir, GOALS_PATH)
  const answer = answerStory(existsSync(file) ? readFileSync(file, 'utf8') : undefined, input)
  if (answer.markdown !== undefined) writeFileSync(file, answer.markdown, 'utf8')

  return answer.result
}

type Message = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
type Reply = { jsonrpc: '2.0'; id: unknown; result?: unknown; error?: { code: number; message: string } }

const ok = (id: unknown, result: unknown): Reply => ({ jsonrpc: '2.0', id, result })
const fail = (id: unknown, code: number, message: string): Reply => ({ jsonrpc: '2.0', id, error: { code, message } })

/** One JSON-RPC message in, its reply out; undefined for a notification, which gets none. */
export const handle = (message: Message, dir: string): Reply | undefined => {
  const isRequest = message.id !== undefined && message.id !== null
  const id = message.id ?? null
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return fail(id, -32600, 'Invalid Request')
  }
  if (!isRequest) return undefined
  const params = (typeof message.params === 'object' && message.params !== null ? message.params : {}) as Record<string, unknown>
  switch (message.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER,
      })
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: [STORY_TOOL] })
    case 'tools/call': {
      if (params.name !== 'story') return fail(id, -32602, `Unknown tool: ${String(params.name)}`)
      const args = (typeof params.arguments === 'object' && params.arguments !== null ? params.arguments : {}) as StoryInput
      try {
        return ok(id, { content: [{ type: 'text', text: runStory(dir, args) }], isError: false })
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error)

        return ok(id, { content: [{ type: 'text', text: `story failed: ${why}` }], isError: true })
      }
    }
    default:
      return fail(id, -32601, `Method not found: ${message.method}`)
  }
}

/** A line of stdin as a reply line; undefined when nothing is to be sent. */
export const answerLine = (line: string, dir: string): string | undefined => {
  if (line.trim() === '') return undefined
  let message: unknown
  try {
    message = JSON.parse(line)
  } catch {
    return JSON.stringify(fail(null, -32700, 'Parse error'))
  }
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return JSON.stringify(fail(null, -32600, 'Invalid Request'))
  }
  const reply = handle(message as Message, dir)

  return reply === undefined ? undefined : JSON.stringify(reply)
}

if (isMain(import.meta.url)) {
  const dir = process.env.TASK_COMPASS_DIR || process.cwd()
  createInterface({ input: process.stdin }).on('line', line => {
    const out = answerLine(line, dir)
    if (out !== undefined) process.stdout.write(`${out}\n`)
  })
}
