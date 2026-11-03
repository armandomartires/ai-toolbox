import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { SELF, addSeen, pluginDirs, serverOfTool, toolHints } from './model'

// The engine lists a module's $.state reads and writes from the atoms declared
// in that same file, so each module declares the atoms it uses.
const seen = atom({ plugin: 'switchboard', key: 'seen' } as const, { mod: [], skill: [], connector: [] })
const hints = atom({ plugin: 'switchboard', key: 'hints' } as const, {})
const topics = atom({ plugin: 'switchboard', key: 'topics' } as const, {})

/** What a mod's `plugin.json` says of it: its `name`, and its `category` when it names one. */
export type Manifest = { name: string; category?: string }

/**
 * The `name` and `category` the folder's `.claude-plugin/plugin.json`
 * declares; undefined when it has no readable manifest with a name. A
 * function declaration, since `plugin.register` passes `$` into it.
 */
export async function readManifest($: EngineInterface, dir: string): Promise<Manifest | undefined> {
  const text = await $.fs.read(`${dir}/.claude-plugin/plugin.json`).catch(() => undefined)
  if (typeof text !== 'string') return undefined
  try {
    const { name, category } = JSON.parse(text) as { name?: unknown; category?: unknown }
    if (typeof name !== 'string' || name === '') return undefined

    return typeof category === 'string' && category.trim() !== '' ? { name, category: category.trim() } : { name }
  } catch {
    return undefined
  }
}

/** The manifest of a folder that has a hooks module to refuse (`hooks/hooks.json`); else undefined. */
async function manifestInfo($: EngineInterface, dir: string): Promise<Manifest | undefined> {
  if (!(await $.fs.exists(`${dir}/hooks/hooks.json`).catch(() => false))) return undefined

  return readManifest($, dir)
}

/**
 * The mods `CLAUDE_CODE_PLUGIN_DIRS` names: each folder that is a mod,
 * or each mod folder inside one that holds several. Read at
 * `session.start`, since a mod that loads before switchboard is judged
 * before its `plugin.register` hook can see it.
 */
export async function modsFromPluginDirs($: EngineInterface): Promise<Manifest[]> {
  const value = await $.env.get('CLAUDE_CODE_PLUGIN_DIRS').catch(() => undefined)
  const mods: Manifest[] = []
  for (const dir of pluginDirs(value)) {
    const own = await manifestInfo($, dir)
    if (own !== undefined) {
      mods.push(own)
      continue
    }
    if (await $.fs.exists(`${dir}/.claude-plugin/plugin.json`).catch(() => false)) continue
    const entries = await $.fs.list(dir).catch(() => [])
    for (const entry of entries) {
      const child = await manifestInfo($, `${dir}/${entry.name}`)
      if (child !== undefined) mods.push(child)
    }
  }

  return mods
}

/**
 * Brings what the pane lists up to date: the mods the plugin folders name,
 * with the `category` each declares (`$.state` `topics`, which groups the
 * pane); the skills and MCP servers the context lists, from the summary
 * breakdown (counted locally, no request sent), with up to three tool names
 * per server; and the servers `$.tool.list()` names. The breakdown is read
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
    addSeen(addSeen(addSeen(held, 'mod', [SELF, ...plugins.map(plugin => plugin.name)]), 'skill', skills), 'connector', servers),
  ).catch(() => undefined)
  const categories = Object.fromEntries(plugins.flatMap(plugin => (plugin.category === undefined ? [] : [[plugin.name, plugin.category]])))
  await update($, topics, held => ({ ...held, ...categories })).catch(() => undefined)
  const found = toolHints(mcpTools)
  await update($, hints, held => ({ ...held, ...found })).catch(() => undefined)
}
