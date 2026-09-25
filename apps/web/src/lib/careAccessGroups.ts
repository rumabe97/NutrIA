import type { CareAccessEntryView } from 'core/controllers/Care';

const GROUP_GAP_MS = 10 * 60 * 1000;

export type CareAccessRow = { entry: CareAccessEntryView; kind: 'entry' } | { id: string; entries: readonly CareAccessEntryView[]; kind: 'group' };

function sameRun(a: CareAccessEntryView, b: CareAccessEntryView): boolean {
  return (
    a.professionalName === b.professionalName &&
    a.kind === b.kind &&
    a.action === b.action &&
    Math.abs(Date.parse(a.at) - Date.parse(b.at)) <= GROUP_GAP_MS
  );
}

/**
 * Folds consecutive rows of the client's own access trail (`0059`) into one
 * for display, for the same reason `accessLog` paginates in the first place: a
 * professional's screen polls a running plan generation every few seconds,
 * and every poll is an audited read, so a single visit can leave 8–12
 * identical rows. Grouping is display-only — `care_access_log` keeps every
 * row, and this function never drops one, only presents a run of two or more
 * as a single expandable row.
 *
 * A run needs the same professional, the same kind of access and the same
 * action — a write is never folded into a read, or the reverse — with no more
 * than ten minutes between one entry and the next. `entries` is read
 * newest-first, as `CareController.accessLog` returns it, and a run of
 * exactly one entry stays a plain row: grouping only ever shortens the list,
 * never relabels a single access.
 *
 * Pass the whole list loaded so far on every call, not just a new page: a run
 * that spans a `loadMore` boundary is simply a longer run once both pages
 * share one array, so nothing here needs to know about pagination at all.
 */
export function groupCareAccessEntries(entries: readonly CareAccessEntryView[]): readonly CareAccessRow[] {
  const rows: CareAccessRow[] = [];
  let run: CareAccessEntryView[] = [];

  function flush(): void {
    const [newest] = run;

    if (!newest) {
      return;
    }

    rows.push(run.length === 1 ? { entry: newest, kind: 'entry' } : { id: newest.id, entries: run, kind: 'group' });
    run = [];
  }

  for (const entry of entries) {
    const last = run.at(-1);

    if (last && !sameRun(last, entry)) {
      flush();
    }

    run.push(entry);
  }

  flush();

  return rows;
}
