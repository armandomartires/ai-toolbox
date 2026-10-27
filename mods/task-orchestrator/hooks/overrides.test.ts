import { expect, test } from 'claude-code/testing'

import { detectOverrides, overridesText } from './overrides'
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
