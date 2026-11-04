// OpenTelemetry GenAI spans for the ledger (issue #14), pure: one
// `invoke_agent <role>` span per started task, encoded as OTLP/JSON
// (ExportTraceServiceRequest) so any collector's /v1/traces accepts it.
//
// NOT WIRED into register.tsx: the mod runtime has no network call on `$`,
// so exporting needs a decision (a sidecar that tails the payloads, or a
// runtime capability). Until then `otlpPayload` is what a sender would post.
// Never objectives, descriptions or reports: ids, roles, models, statuses
// and token counts only.

import type { Task } from '../types'

/** FNV-1a 64-bit, hex: deterministic ids with no crypto dependency. */
const fnv64 = (text: string): string => {
  let h = 0xcbf29ce484222325n
  for (const ch of new TextEncoder().encode(text)) h = BigInt.asUintN(64, (h ^ BigInt(ch)) * 0x100000001b3n)
  return h.toString(16).padStart(16, '0')
}

export const traceIdOf = (runId: string): string => fnv64(`trace:${runId}`) + fnv64(`trace2:${runId}`)
export const spanIdOf = (runId: string, taskId: string, attempt = 0): string => fnv64(`span:${runId}:${taskId}:${attempt}`)

type Attr = { key: string; value: { stringValue: string } | { intValue: string } }
const str = (key: string, v: string | undefined): Attr[] => (v === undefined ? [] : [{ key, value: { stringValue: v } }])
const int = (key: string, v: number | undefined): Attr[] => (v === undefined ? [] : [{ key, value: { intValue: String(Math.trunc(v)) } }])

const ERROR_STATES = ['failed', 'blocked', 'cancelled']

export type OtlpSpan = {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  kind: number
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes: Attr[]
  status: { code: number; message?: string }
}

const nanos = (ms: number): string => (BigInt(Math.trunc(ms)) * 1000000n).toString()

/** The span for one task, or nothing if it never started. */
export const taskSpan = (runId: string, task: Task, now: number = Date.now()): OtlpSpan | undefined => {
  if (task.startedAt === undefined) return undefined
  return {
    traceId: traceIdOf(runId),
    spanId: spanIdOf(runId, task.id, task.retries + task.escalations),
    parentSpanId: spanIdOf(runId, '<run>'),
    name: `invoke_agent ${task.role}`,
    kind: 1, // INTERNAL
    startTimeUnixNano: nanos(task.startedAt),
    endTimeUnixNano: nanos(task.endedAt ?? now),
    attributes: [
      ...str('gen_ai.operation.name', 'invoke_agent'),
      ...str('gen_ai.agent.name', String(task.role)),
      ...str('gen_ai.agent.id', task.agentId),
      ...str('gen_ai.request.model', task.requested.model),
      ...str('gen_ai.response.model', task.resolvedModel),
      ...int('gen_ai.usage.total_tokens', task.tokens),
      ...str('orchestrator.task.id', task.id),
      ...str('orchestrator.task.class', String(task.taskClass)),
      ...str('orchestrator.task.status', task.status),
      ...int('orchestrator.task.retries', task.retries),
      ...int('orchestrator.task.escalations', task.escalations),
    ],
    status: ERROR_STATES.includes(task.status) ? { code: 2, message: task.status } : { code: task.endedAt ? 1 : 0 },
  }
}

/** The run's root span plus one per started task, as an OTLP/JSON request body. */
export const otlpPayload = (runId: string, ledger: readonly Task[], service = 'task-orchestrator', now: number = Date.now()) => {
  const spans = ledger.map(task => taskSpan(runId, task, now)).filter((s): s is OtlpSpan => s !== undefined)
  const start = Math.min(...ledger.map(t => t.createdAt), now)
  const root: OtlpSpan = {
    traceId: traceIdOf(runId),
    spanId: spanIdOf(runId, '<run>'),
    name: 'invoke_agent orchestrator',
    kind: 1,
    startTimeUnixNano: nanos(start),
    endTimeUnixNano: nanos(now),
    attributes: [...str('gen_ai.operation.name', 'invoke_agent'), ...str('gen_ai.agent.name', 'orchestrator'), ...str('orchestrator.run.id', runId), ...int('orchestrator.tasks', ledger.length)],
    status: { code: 0 },
  }
  return {
    resourceSpans: [{
      resource: { attributes: str('service.name', service) },
      scopeSpans: [{ scope: { name: 'ai-toolbox.task-orchestrator' }, spans: [root, ...spans] }],
    }],
  }
}
