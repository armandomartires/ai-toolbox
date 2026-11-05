import { expect, test } from 'claude-code/testing'

import { detectOverrides, effortMismatchNote, effortOverridesFor, overridesText } from './overrides'
import { enableBlocker, PROVIDERS, providersText } from './providers'
import { DEFAULT_CONFIG } from './routing'

test('global model and effort overrides are detected and disclosed, values shown only for model and effort names', () => {
  const found = detectOverrides(
    { model: 'fable', modelSettings: { 'claude-sonnet-5-5': { effortLevel: 'high' } }, env: { CLAUDE_CODE_SUBAGENT_MODEL: 'opus', ANTHROPIC_API_KEY: 'sk-secret' } },
    { CLAUDE_EFFORT: 'high', ANTHROPIC_API_KEY: 'sk-secret' },
  )
  expect(found.map(one => `${one.source}:${one.key}=${one.value}`)).toEqual([
    'settings:model=fable',
    'settings:modelSettings.claude-sonnet-5-5.effortLevel=high',
    'settings:env.CLAUDE_CODE_SUBAGENT_MODEL=opus',
    'env:CLAUDE_EFFORT=high',
  ])
  expect(JSON.stringify(found)).not.toContain('sk-secret')
  expect(overridesText(found)).toContain('forces every subagent onto this model')
  expect(overridesText([])).toContain('none found')
  expect(detectOverrides(undefined, {})).toEqual([])
})

test('no external provider is enabled or enableable in this version, and the disclosure is shown', () => {
  for (const provider of PROVIDERS) {
    expect(DEFAULT_CONFIG.providers[provider.id]?.enabled).toBe(false)
    expect(enableBlocker(provider, { [provider.envVar]: 'set' })).toContain('no adapter is implemented')
  }
  const text = providersText(DEFAULT_CONFIG, {})
  expect(text).toContain('openai: disabled, text-only, not-implemented')
  expect(text).toContain('grok: disabled, text-only, not-implemented')
  expect(text).toContain('nothing leaves the session')
})

test("a modelSettings effort for the worker's model is found when it differs from the requested effort", () => {
  const found = detectOverrides({ modelSettings: { 'claude-sonnet-5-5': { effortLevel: 'high' }, 'claude-opus-5-5': { effortLevel: 'high' } } }, {})
  expect(effortOverridesFor(found, 'sonnet', 'medium').map(one => one.key)).toEqual(['modelSettings.claude-sonnet-5-5.effortLevel'])
  expect(effortOverridesFor(found, 'sonnet', 'medium', 'claude-sonnet-5-5').map(one => one.key)).toEqual(['modelSettings.claude-sonnet-5-5.effortLevel'])
  expect(effortOverridesFor(found, 'claude-opus-5-5', 'low').map(one => one.key)).toEqual(['modelSettings.claude-opus-5-5.effortLevel'])
  expect(effortOverridesFor(found, 'sonnet', 'high')).toEqual([])
  expect(effortOverridesFor(found, 'haiku', 'low')).toEqual([])
})

test('an effort mismatch note names requested and observed, and the host setting for that model that likely caused it; none when equal', () => {
  const found = detectOverrides({ modelSettings: { 'claude-sonnet-5-5': { effortLevel: 'xhigh' }, 'claude-opus-5-5': { effortLevel: 'low' } } }, {})
  expect(effortMismatchNote(found, 'sonnet', 'medium', 'xhigh', 'claude-sonnet-5-5')).toBe(
    'effort mismatch: requested medium, observed xhigh; host setting modelSettings.claude-sonnet-5-5.effortLevel = xhigh is set for this model and likely caused it',
  )
  // Equal: no note, set host setting or not.
  expect(effortMismatchNote(found, 'sonnet', 'xhigh', 'xhigh', 'claude-sonnet-5-5')).toBeUndefined()
  // A mismatch with no setting for that model names none.
  expect(effortMismatchNote(found, 'haiku', 'medium', 'high', 'claude-haiku-4-5')).toBe('effort mismatch: requested medium, observed high')
  expect(overridesText(found)).toContain('disclosed, not a prediction')
  expect(overridesText(found)).not.toContain('may replace')
})
