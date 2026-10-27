import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { SELF, addSeen, pluginDirs, serverOfTool, toolHints } from './model'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })
const hints = atom({ plugin: 'switchboard', key: 'hints' } as const, {})

/**
 * The `name` a folder's `.claude-plugin/plugin.json` declares, when the
 * folder has a hooks module to refuse (`hooks/hooks.json`); else undefined.
 */
async function manifestName($: EngineInterface, dir: string): Promise<string | undefined> {
  if (!(await $.fs.exists(`${dir}/hooks/hooks.json`).catch(() => false))) return undefined
  const text = await $.fs.read(`${dir}/.claude-plugin/plugin.json`).catch(() => undefined)
  if (typeof text !== 'string') return undefined
  try {
    const name = (JSON.parse(text) as { name?: unknown }).name
    return typeof name === 'string' && name !== '' ? name : undefined
  } catch {
    return undefined
  }
}

/**
 * The mods `CLAUDE_CODE_PLUGIN_DIRS` names: each folder that is a mod,
 * or each mod folder inside one that holds several. Read at
 * `session.start`, since a mod that loads before switchboard is judged
 * before its `plugin.register` hook can see it.
 */
export async function modsFromPluginDirs($: EngineInterface): Promise<string[]> {
  const value = await $.env.get('CLAUDE_CODE_PLUGIN_DIRS').catch(() => undefined)
  const names: string[] = []
  for (const dir of pluginDirs(value)) {
    const own = await manifestName($, dir)
    if (own !== undefined) {
      names.push(own)
      continue
    }
    if (await $.fs.exists(`${dir}/.claude-plugin/plugin.json`).catch(() => false)) continue
    const entries = await $.fs.list(dir).catch(() => [])
    for (const entry of entries) {
      const child = await manifestName($, `${dir}/${entry.name}`)
      if (child !== undefined) names.push(child)
    }
  }

  return names
}

/**
 * Brings what the pane lists up to date: the mods the plugin folders name;
 * the skills and MCP servers the context lists, from the summary breakdown
 * (counted locally, no request sent), with up to three tool names per
 * server; and the servers `$.tool.list()` names. The breakdown is read
 * rather than the skill listing, which a security plugin can send on past
 * this mod. Run at `session.start` and when the pane or the list is asked
 * for, since servers connect and skills load after a session starts.
 */
export async function refreshInventory($: EngineInterface) {
  const plugins = await modsFromPluginDirs($).catch(() => [])
  const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
  const breakdown = usage?.context.breakdown
  const skills = breakdown?.skills?.skillFrontmatter.map(skill => skill.name) ?? []
  const mcpTools = breakdown?.mcpTools ?? []
  const tools = await $.tool.list().catch(() => [])
  const servers = [
    ...mcpTools.map(tool => tool.serverName),
    ...tools.flatMap(tool => {
      const server = tool.mcp ? serverOfTool(tool.name) : undefined
      return server ? [server] : []
    }),
  ]
  await update($, seen, held =>
    addSeen(addSeen(addSeen(held, 'mod', [SELF, ...plugins]), 'skill', skills), 'connector', servers),
  ).catch(() => undefined)
  const found = toolHints(mcpTools)
  await update($, hints, held => ({ ...held, ...found })).catch(() => undefined)
}
