import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { parsePeriod } from 'core/domain/Period';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { Card } from 'components/Card';
import { FeedbackToggle } from 'components/FeedbackToggle';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { DEFAULT_PERIOD } from 'core/entities/Period';
import { feedbackQuerySchema } from 'core/entities/AdminQuery';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AdminPeopleView } from 'core/controllers/Admin';
import type { AdminTableColumn } from 'components/AdminTable';
import type { FeedbackView } from 'core/controllers/Feedback';
import type { Metadata } from 'next';
import type { Paged } from 'core/controllers/User';
import type { PageQuery } from 'components/PeriodSelector';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/buzon');
}

const PATHNAME = '/admin/buzon';

/**
 * Buzón (`0037`, `0068`): messages per week over the period, then every message as a
 * table that searches the text and the sender, filters seen or not, sorts by date and
 * pages. The message is shown whole, as it was typed — wrapped, never cut.
 */
export default async function AdminInboxPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const table = readTableQuery(feedbackQuerySchema, query);
  const [dictionary, locale, inbox, people] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<Paged<FeedbackView> & { readonly waiting: number }>(`/admin/feedback?${apiSearch(table)}`),
    serverApi<AdminPeopleView>(`/admin/people?period=${period}`)
  ]);

  if (!inbox) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminInbox;
  const kinds: Readonly<Record<string, string>> = dictionary.feedback.kinds;

  const columns: AdminTableColumn[] = [
    { header: t.columns.date, key: 'date', sort: { first: 'desc', phrase: t.sortBy.createdAt, value: 'createdAt' } },
    { header: t.columns.sender, key: 'sender' },
    { header: t.columns.kind, key: 'kind' },
    { header: t.columns.message, key: 'message' },
    { header: t.columns.state, key: 'state' },
    { header: t.columns.actions, key: 'actions' }
  ];

  const rows = inbox.rows.map(message => ({
    id: message.id,
    cells: {
      actions: <FeedbackToggle email={message.email} handled={message.handled} id={message.id} />,
      date: formatDate(message.createdAt.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' }),
      kind: kinds[message.kind] ?? message.kind,
      // Their words, as typed. Nothing here summarises, interprets or cuts them.
      message: <p className={styles.message}>{message.message}</p>,
      sender: <span className={styles.sender}>{message.email}</span>,
      state: message.handled ? t.seenState : <span className={styles.waiting}>{t.waitingState}</span>
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      {people ? (
        <AdminSection title={t.messagesTitle}>
          <Card>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.messagesEmpty}
              labels={people.messages.weeks}
              labelsHeader={common.week}
              locale={locale}
              series={[{ name: t.messagesSeries, values: people.messages.values }]}
              title={t.messagesChart}
            />
          </Card>
        </AdminSection>
      ) : null}

      <AdminSection note={interpolate(t.waiting, { count: formatNumber(inbox.waiting, locale) })} title={t.tableTitle}>
        <AdminTable
          caption={t.caption}
          columns={columns}
          empty={t.empty}
          filters={[
            {
              anyLabel: t.states.all,
              label: t.state,
              name: 'state',
              options: [
                { label: t.states.waiting, value: 'waiting' },
                { label: t.states.seen, value: 'seen' }
              ],
              // `all` is the default: the address says nothing, and the select says "Todos".
              value: table.state === 'all' ? undefined : table.state
            }
          ]}
          locale={locale}
          noMatch={t.noMatch}
          paging={{ offset: inbox.offset, size: inbox.size }}
          pathname={PATHNAME}
          query={query}
          rows={rows}
          search={{ label: t.search, value: table.q }}
          sort={{ dir: table.dir, value: table.sort }}
          total={inbox.total}
          words={common.table}
        />
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
