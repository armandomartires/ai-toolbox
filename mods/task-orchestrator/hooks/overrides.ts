// Settings and environment that outrank or alter what a worker is asked to
// run on. Pure: the hooks module reads the sources and hands them here.
// Values printed are model names and effort words, never secrets.

import type { Override } from '../types'

export type { Override }

/** The environment variables that bear on model or effort selection. */
export const OVERRIDE_ENV = ['CLAUDE_CODE_SUBAGENT_MODEL', 'CLAUDE_EFFORT', 'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'CLAUDE_CODE_EFFORT_LEVEL'] as const

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export const detectOverrides = (settings: unknown, env: Readonly<Record<string, string | undefined>>): Override[] => {
  const out: Override[] = []
  if (isRecord(settings)) {
    if (typeof settings.model === 'string')
      out.push({ source: 'settings', key: 'model', value: settings.model, effect: 'the session default; a worker with no routed model inherits it' })
    if (typeof settings.effortLevel === 'string' || typeof settings.effortLevel === 'number')
      out.push({ source: 'settings', key: 'effortLevel', value: String(settings.effortLevel), effect: 'the session effort; may apply to a worker whose profile sets none' })
    if (isRecord(settings.modelSettings)) {
      for (const [model, value] of Object.entries(settings.modelSettings)) {
        if (isRecord(value) && value.effortLevel !== undefined)
          out.push({ source: 'settings', key: `modelSettings.${model}.effortLevel`, value: String(value.effortLevel), effect: `may replace the routed effort of a worker on ${model}` })
      }
    }
    if (isRecord(settings.env)) {
      for (const name of OVERRIDE_ENV) {
        if (typeof settings.env[name] === 'string') out.push({ source: 'settings', key: `env.${name}`, value: settings.env[name] as string, effect: envEffect(name) })
      }
    }
  }
  for (const name of OVERRIDE_ENV) {
    const value = env[name]
    if (value !== undefined && value !== '') out.push({ source: 'env', key: name, value, effect: envEffect(name) })
  }
  return out
}

const envEffect = (name: string): string => {
  switch (name) {
    case 'CLAUDE_CODE_SUBAGENT_MODEL':
      return 'forces every subagent onto this model, outranking a routed model'
    case 'CLAUDE_EFFORT':
      return "the current turn's effort as the engine reports it (a reading of the session, not a worker setting)"
    case 'ANTHROPIC_MODEL':
      return 'the session model; a worker with no routed model inherits it'
    case 'ANTHROPIC_SMALL_FAST_MODEL':
      return 'replaces the haiku alias for engine-internal calls'
    default:
      return 'may replace the session effort'
  }
}

export const overridesText = (overrides: readonly Override[]): string =>
  overrides.length
    ? overrides.map(one => `- ${one.source} ${one.key} = ${one.value}: ${one.effect}`).join('\n')
    : '- none found in settings or environment'
