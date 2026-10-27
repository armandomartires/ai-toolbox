import type { EngineInterface } from 'claude-code'

import { pluginDirs } from './model'

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
