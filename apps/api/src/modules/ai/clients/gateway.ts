/**
 * What an OpenAI-compatible gateway says about a call, beyond the call itself.
 *
 * OmniRoute answers every request with `x-omniroute-*` headers: which model and
 * provider actually answered — a combo may have fallen to its second or third —
 * its own latency, what the call cost, whether it came from its cache, and the
 * ids its dashboard files the call under. None of that is in the body. A
 * direct provider sends none of these headers, so a null here is also how a
 * call that did not go through a gateway is told apart (`0050`).
 */
export type GatewayCall = {
  /** HIT or MISS, as the gateway's own response cache saw it. */
  readonly cache: string | null;
  /** The combo execution this call was a hop of. */
  readonly comboTrace: string | null;
  readonly correlationId: string | null;
  readonly costUsd: number | null;
  /** The gateway's latency for the hop that answered, not counting ours. */
  readonly latencyMs: number | null;
  /** The model that answered — for a combo, not the name that was asked for. */
  readonly model: string | null;
  readonly provider: string | null;
  /** The id the gateway's dashboard lists this call under. */
  readonly requestId: string | null;
  /** The session it was filed under: "ext:<ours>" when we sent one, the gateway's own otherwise. */
  readonly session: string | null;
  /** How the combo chose the model, e.g. "priority". */
  readonly strategy: string | null;
  readonly version: string | null;
};

const PREFIX = 'x-omniroute-';

export function readGateway(headers: Readonly<Record<string, string>> | undefined): GatewayCall | null {
  const lower = new Map(Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));

  if (![...lower.keys()].some(key => key.startsWith(PREFIX))) {
    return null;
  }

  const text = (name: string) => lower.get(name)?.trim() || null;

  const number = (name: string) => {
    const value = Number.parseFloat(text(name) ?? '');

    return Number.isFinite(value) ? value : null;
  };

  return {
    cache: text(`${PREFIX}cache`),
    comboTrace: text(`${PREFIX}combo-trace`),
    correlationId: text('x-correlation-id'),
    costUsd: number(`${PREFIX}response-cost`),
    latencyMs: number(`${PREFIX}latency-ms`),
    model: text(`${PREFIX}model`),
    provider: text(`${PREFIX}provider`),
    requestId: text(`${PREFIX}request-id`),
    session: text(`${PREFIX}session-id`),
    strategy: /strategy=([^;]+)/.exec(text(`${PREFIX}decision`) ?? '')?.[1]?.trim() ?? null,
    version: text(`${PREFIX}version`)
  };
}

/** A refusal for quota, as far as the provider's own message says. */
export type QuotaRefusal = {
  readonly limit: number | null;
  readonly metric: string | null;
  readonly model: string | null;
  readonly retryAfterSeconds: number | null;
};

/**
 * What a quota refusal says about the allowance, read out of its text.
 *
 * Google writes the metric, the limit and the model into the message itself —
 * "Quota exceeded for metric: …free_tier_requests, limit: 20, model:
 * gemini-3.6-flash. Please retry in 25.2s." — and publishes no endpoint for
 * the allowance otherwise, so a refusal is the one place the number is
 * written down. A message that is not about quota reads as null.
 */
export function readQuota(message: string): QuotaRefusal | null {
  const metric = /Quota exceeded for metric:\s*([^\s,]+)/i.exec(message)?.[1] ?? null;

  if (!metric && !/quota|RESOURCE_EXHAUSTED/i.test(message)) {
    return null;
  }

  const limit = /\blimit:\s*(\d+)/i.exec(message)?.[1];
  const model = /\bmodel:\s*([\w./-]+)/i.exec(message)?.[1]?.replace(/\.$/, '') ?? null;
  const retry = /retry in\s*([\d.]+)\s*s/i.exec(message)?.[1] ?? /"retryDelay"\s*:\s*"([\d.]+)s"/i.exec(message)?.[1];

  return {
    limit: limit === undefined ? null : Number(limit),
    metric,
    model,
    retryAfterSeconds: retry === undefined ? null : Math.ceil(Number(retry))
  };
}
