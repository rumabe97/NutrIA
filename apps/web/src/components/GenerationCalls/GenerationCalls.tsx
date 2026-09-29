import styles from './GenerationCalls.module.css';

import { formatNumber, interpolate } from 'lib/format';

import type { AiCallRecord, DishRejection } from 'core/entities/Plan';
import type { Dictionary } from 'i18n/dictionaries/es-ES';
import type { Locale } from 'i18n/config';

interface GenerationCallsProps {
  calls: readonly AiCallRecord[];
  locale: Locale;
  /** The meal names, for the call's slot. */
  slots: Dictionary['slots'];
  words: Dictionary['adminLog'];
}

/**
 * Every model call one generation made, folded until somebody opens it (`0050`, `0068`):
 * which meal and round, who answered and through whom, how long it took, what it cost
 * in tokens and which dishes it kept — or how it failed. The same fields the log has
 * always shown, as a table of its own inside the generation's row.
 *
 * What a call dropped is shown by reason as the API sends it: the addressed log comes
 * without the reasons that would describe the person (`allergen`, `unwanted`, `0028`),
 * and nothing here puts them back.
 *
 * A plain `<table>`, not `DataTable`: it sits in a cell that sizes to its content, where
 * a measured scroll region of its own would have no width to measure. The outer table
 * already scrolls sideways.
 */
export function GenerationCalls({ calls, locale, slots, words }: GenerationCallsProps) {
  if (calls.length === 0) {
    return <span className={styles.none}>{words.logNoCalls}</span>;
  }

  const number = (value: number) => formatNumber(value, locale);
  // Milliseconds as seconds with one decimal: the grain a model call is felt at.
  const seconds = (ms: number | null) =>
    ms === null ? '—' : formatNumber(ms / 1000, locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const columns = words.logCallColumns;

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <svg aria-hidden="true" className={styles.chevron} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {interpolate(words.logCalls, { count: number(calls.length) })}
      </summary>
      <table className={styles.table}>
        <caption className="visually-hidden">{words.logCallsCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{columns.call}</th>
            <th scope="col">{columns.model}</th>
            <th className={styles.end} scope="col">
              {columns.seconds}
            </th>
            <th scope="col">{columns.result}</th>
            <th scope="col">{columns.request}</th>
            <th scope="col">{columns.error}</th>
          </tr>
        </thead>
        <tbody>
          {calls.map(call => {
            const answered = call.answeredModel ?? call.model;
            const dropped = Object.entries(call.rejected ?? {})
              .map(([reason, count]) => `${words.rejection[reason as DishRejection] ?? reason} ${number(count ?? 0)}`)
              .join(', ');
            const model = [
              answered,
              answered === call.model ? null : `(${interpolate(words.logCallAsked, { model: call.model })})`,
              call.provider ? `· ${interpolate(words.logCallVia, { provider: call.provider })}` : null
            ]
              .filter(Boolean)
              .join(' ');
            const result = call.error
              ? [
                  interpolate(words.logCallFailed, { status: call.error.status === null ? '—' : String(call.error.status) }),
                  call.error.quota
                    ? interpolate(words.logCallQuota, {
                        limit: call.error.quota.limit === null ? '?' : number(call.error.quota.limit),
                        seconds: call.error.quota.retryAfterSeconds === null ? '?' : number(call.error.quota.retryAfterSeconds)
                      })
                    : null
                ]
                  .filter(Boolean)
                  .join(' · ')
              : [
                  interpolate(words.logCallTokens, { input: number(call.inputTokens ?? 0), output: number(call.outputTokens ?? 0) }) +
                    (call.reasoningTokens ? ` (${interpolate(words.logCallReasoning, { count: number(call.reasoningTokens) })})` : ''),
                  interpolate(words.logCallKept, { dishes: number(call.dishes), kept: number(call.kept) }),
                  dropped ? interpolate(words.logCallDropped, { reasons: dropped }) : null
                ]
                  .filter(Boolean)
                  .join(' · ');

            return (
              <tr key={`${call.round}-${call.slot}`}>
                <th scope="row">{interpolate(words.logCall, { round: number(call.round), slot: slots[call.slot] })}</th>
                <td>{model}</td>
                <td className={styles.end}>{seconds(call.ms)}</td>
                <td className={call.error ? styles.failed : undefined}>{result}</td>
                <td className={styles.request}>{call.requestId ?? '—'}</td>
                <td>{call.error ? <p className={styles.message}>{call.error.message}</p> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}
