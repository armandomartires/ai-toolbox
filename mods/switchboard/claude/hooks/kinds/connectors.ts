import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import { addSeen, denyText, isOff, offName, serverOfProvider, serverOfTool } from '../model'
import { loadOff } from '../store'

const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })

/**
 * MCP servers and connectors: an off server's tools move behind ToolSearch
 * with a description that says so, and every call to one is refused. The
 * server stays connected: servers connect before any plugin loads (ADR-0042).
 */
export const registerConnectors = (on: On) => {
  on('tool.describe', async ($, e, next) => {
    const done = await next(e)
    const server = serverOfProvider(e.provider.plugin)
    if (server === undefined) return done
    await update($, seen, held => addSeen(held, 'connector', [server])).catch(() => undefined)
    if (!isOff(await loadOff($), 'connector', server)) return done

    return { description: `[Turned off in switchboard; calls are refused] ${done.description}`, isDeferred: true }
  })

  // One hook for every tool: a matcher naming MCP tools makes TypeScript
  // expand every connected server's tool types, past its depth.
  on('tool.call', async ($, e, next) => {
    const server = serverOfTool(String(e.tool))
    if (server === undefined) return next(e)
    const off = await loadOff($)
    if (isOff(off, 'connector', server)) return { deny: denyText('connector', offName(off, server)) }

    return next(e)
  })
}
