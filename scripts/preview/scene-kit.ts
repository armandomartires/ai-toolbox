// The scene kit: what a mod's preview/*.scene.tsx files build on. scripts/preview-mods.py
// copies this file into each mod's preview/ folder as scene-kit.ts (never edit the copy)
// and, in the scratch copy it runs, writes preview/request.ts beside it: the sizes,
// surfaces and presses asked for, or null for every scene's own matrix.
//
// A scene is a populated pane: `populate` seeds the mod's state through the engine's
// hooks, as the mod's tests do; the kit mounts the pane at each size and surface, applies
// the presses asked for, and hands the drawn tree out through the one channel the test
// kit has, a failure message (it has no files and drops console output).
import type { EngineInterface, On } from 'claude-code'

export type Surface = 'desktop' | 'terminal'

export type Scene = {
  /** The pane's requestId, and the plugin that owns it (the mod itself unless it contributes to another's pane). */
  requestId: string
  plugin?: string
  title?: string
  /** The default matrix: [columns, rows] pairs, each drawn on every listed surface. */
  sizes: [number, number][]
  surfaces: Surface[]
  /** Seeds the state the pane draws; runs once per entry, on a fresh engine. */
  populate: ($: EngineInterface, on: On) => Promise<unknown>
  /** False for a scene drawn from data that changes outside the mod (a live board): shown, never snapshotted. */
  snapshot?: boolean
}

/** A Button's key, and the plugin that drew it when it is not the mod's own (a contributed pane). */
export type Press = { press: string; plugin?: string }

/** One drawing asked for: a scene at a size on a surface, after some presses. */
export type Request = { mod: string; scene: string; surface: Surface; columns: number; rows: number; actions?: Press[] }

/** What the kit hands out per drawing, and what the preview page draws. */
export type Drawn = Request & { requestId: string; tree: unknown; theme?: unknown; error?: string; snapshot?: boolean }

export const MARK = { open: '@@PREVIEW@@', close: '@@END@@' }

type Test = (name: string, ...rest: unknown[]) => void

const entriesOf = (mod: string, scenes: Record<string, Scene>, request: Request[] | null): Request[] => {
  if (request) return request.filter(one => one.mod === mod && scenes[one.scene] !== undefined)
  const out: Request[] = []
  for (const [scene, one] of Object.entries(scenes)) for (const surface of one.surfaces) for (const [columns, rows] of one.sizes) out.push({ mod, scene, surface, columns, rows })
  return out
}

/**
 * Registers one kit test per drawing asked for. `options` is the test kit's own options
 * object (inline plugins, for a pane that reads another mod's state); `theme` the mod's
 * colour tokens, so the page can draw the other theme too.
 */
export const runScenes = (test: Test, mod: string, scenes: Record<string, Scene>, request: Request[] | null, options: Record<string, unknown> = {}, theme?: unknown) => {
  for (const entry of entriesOf(mod, scenes, request)) {
    const scene = scenes[entry.scene]!
    const label = `${entry.scene} · ${entry.surface} · ${entry.columns}×${entry.rows}${entry.actions?.length ? ` · ${entry.actions.map(a => a.press).join(', ')}` : ''}`
    test(`preview: ${mod} · ${label}`, options, async ($: EngineInterface, on: On) => {
      const out: Drawn = { ...entry, requestId: scene.requestId, tree: undefined, theme, snapshot: scene.snapshot !== false }
      try {
        await scene.populate($, on)
        const props = { title: scene.title ?? scene.requestId, isFocused: false, bodyColumns: entry.columns, placement: 'dock', scroll: { offset: 0, bodyRows: entry.rows }, view: {} }
        const ui = await $.ui.mount({ plugin: scene.plugin ?? mod, component: 'Pane', requestId: scene.requestId, surface: entry.surface, props } as never)
        for (const action of entry.actions ?? []) await ui.press(action.plugin ? { key: action.press, plugin: action.plugin } : { key: action.press })
        out.tree = await ui.drawn()
        await ui.unmount()
      } catch (error) {
        out.error = error instanceof Error ? error.message : String(error)
      }
      throw new Error(`${MARK.open}${encodeURIComponent(JSON.stringify([out]))}${MARK.close}`)
    })
  }
}
