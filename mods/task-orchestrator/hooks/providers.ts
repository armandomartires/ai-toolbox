// External workers: the adapter interface and a registry with nothing
// enabled. No adapter is implemented in 0.1.0 (ADR-0041): an entry here is a
// declared, disabled design, and `/orchestrate providers` says so.

import type { Config } from './routing'

export type ExternalProvider = {
  id: string
  label: string
  /** `text-only`: analysis and text out, no tools; `agentic`: a tool-using worker. */
  kind: 'text-only' | 'agentic'
  /** `not-implemented` until an adapter exists and was verified live. */
  status: 'not-implemented' | 'available'
  /** The variable whose presence (never its value) says the provider is configured. */
  envVar: string
  disclosure: string
}

export const PROVIDERS: readonly ExternalProvider[] = [
  {
    id: 'openai',
    label: 'OpenAI (chat completions)',
    kind: 'text-only',
    status: 'not-implemented',
    envVar: 'OPENAI_API_KEY',
    disclosure: 'Prompts and any file content you include would leave this machine for OpenAI. Model and effort names are not Claude aliases and are not interchangeable with native workers.',
  },
  {
    id: 'grok',
    label: 'xAI Grok',
    kind: 'text-only',
    status: 'not-implemented',
    envVar: 'XAI_API_KEY',
    disclosure: 'Prompts and any file content you include would leave this machine for xAI. Model and effort names are not Claude aliases and are not interchangeable with native workers.',
  },
]

export const providerById = (id: string): ExternalProvider | undefined => PROVIDERS.find(one => one.id === id)

/** Why a provider cannot be enabled now; every condition must hold. */
export const enableBlocker = (provider: ExternalProvider, env: Readonly<Record<string, string | undefined>>): string | undefined => {
  if (provider.status !== 'available') return `${provider.label}: no adapter is implemented in this version; the entry is a design placeholder`
  if (!env[provider.envVar]) return `${provider.label}: ${provider.envVar} is not set (its value is never read by this mod)`
  return undefined
}

export const providersText = (config: Config, env: Readonly<Record<string, string | undefined>>): string =>
  PROVIDERS.map(provider => {
    const enabled = config.providers[provider.id]?.enabled ? 'enabled' : 'disabled'
    const blocker = enableBlocker(provider, env)
    return `- ${provider.id}: ${enabled}, ${provider.kind}, ${provider.status}${blocker ? ` (${blocker})` : ''}`
  }).join('\n') + '\nNative Claude workers need no provider; nothing leaves the session unless a provider is implemented, configured and enabled by you.'
