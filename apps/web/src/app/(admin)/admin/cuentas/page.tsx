import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { ColumnChart } from 'ui/components/ColumnChart';
import { parsePeriod } from 'core/domain/Period';

import { AccountActions } from 'components/AccountActions';
import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { Card } from 'components/Card';
import { HowCounted } from 'components/HowCounted';
import { PeriodSelector } from 'components/PeriodSelector';

import { accountQuerySchema } from 'core/entities/AdminQuery';
import { DEFAULT_PERIOD } from 'core/entities/Period';

import { formatDate, formatNumber, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../consoleMetadata';

import type { AccountView, Paged } from 'core/controllers/User';
import type { AdminPeopleView } from 'core/controllers/Admin';
import type { AdminTableColumn, AdminTableFilter } from 'components/AdminTable';
import type { Metadata } from 'next';
import type { PageQuery } from 'components/PeriodSelector';
import type { SettingsView } from 'core/controllers/Settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/cuentas');
}

const PATHNAME = '/admin/cuentas';

/**
 * Cuentas (`0068`): sign-ups per week over the period, then every account as a table
 * that searches by address, filters by its locks and milestones, sorts and pages — all
 * in the address. Each row has the actions the old list had.
 *
 * Milestones only, never content (`0028`): whether onboarding was finished and when,
 * how many plans, when the account last did anything, whether it is a professional.
 *
 * The mailed activation link lands on `/admin?abierta=…`, and Resumen sends it here:
 * the banner says which account was opened.
 */
export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const period = parsePeriod(query.period) ?? DEFAULT_PERIOD;
  const table = readTableQuery(accountQuerySchema, query);
  const [dictionary, locale, accounts, people, settings] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<Paged<AccountView>>(`/admin/accounts?${apiSearch(table)}`),
    serverApi<AdminPeopleView>(`/admin/people?period=${period}`),
    serverApi<SettingsView>('/admin/settings')
  ]);

  if (!accounts) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminAccounts;
  const premium = settings?.flags?.premium ?? false;
  const opened = typeof query.abierta === 'string' ? [query.abierta] : (query.abierta ?? []);
  const date = (iso: string) => formatDate(iso.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const yesNo = (value: boolean) => (value ? common.yes : common.no);
  const yesNoOptions = [
    { label: common.yes, value: 'yes' },
    { label: common.no, value: 'no' }
  ];

  const columns: AdminTableColumn[] = [
    { header: t.columns.email, key: 'email', sort: { first: 'asc', phrase: t.sortBy.email, value: 'email' } },
    { header: t.columns.created, key: 'created', sort: { first: 'desc', phrase: t.sortBy.createdAt, value: 'createdAt' } },
    { header: t.columns.confirmed, key: 'confirmed' },
    { header: t.columns.activated, key: 'activated' },
    { header: t.columns.tier, key: 'tier' },
    { header: t.columns.role, key: 'role' },
    { header: t.columns.onboarded, key: 'onboarded' },
    { align: 'end', header: t.columns.plans, key: 'plans', sort: { first: 'desc', phrase: t.sortBy.plans, value: 'plans' } },
    { header: t.columns.lastActive, key: 'lastActive', sort: { first: 'desc', phrase: t.sortBy.lastActiveAt, value: 'lastActiveAt' } },
    { header: t.columns.professional, key: 'professional' },
    { header: t.columns.actions, key: 'actions' }
  ];

  const filters: AdminTableFilter[] = [
    { anyLabel: common.table.any, label: t.columns.confirmed, name: 'confirmed', options: yesNoOptions, value: table.confirmed },
    { anyLabel: common.table.any, label: t.columns.activated, name: 'activated', options: yesNoOptions, value: table.activated },
    {
      anyLabel: common.table.any,
      label: t.columns.tier,
      name: 'tier',
      options: [
        { label: t.tiers.free, value: 'free' },
        { label: t.tiers.premium, value: 'premium' }
      ],
      value: table.tier
    },
    {
      anyLabel: common.table.any,
      label: t.columns.role,
      name: 'role',
      options: [
        { label: t.roles.user, value: 'user' },
        { label: t.roles.admin, value: 'admin' }
      ],
      value: table.role
    },
    { anyLabel: common.table.any, label: t.columns.professional, name: 'professional', options: yesNoOptions, value: table.professional },
    { anyLabel: common.table.any, label: t.columns.onboarded, name: 'onboarded', options: yesNoOptions, value: table.onboarded }
  ];

  const rows = accounts.rows.map(account => ({
    id: account.id,
    cells: {
      actions: <AccountActions account={account} premium={premium} />,
      activated: <span data-state={account.activated ? undefined : 'off'}>{yesNo(account.activated)}</span>,
      confirmed: <span data-state={account.emailVerified ? undefined : 'off'}>{yesNo(account.emailVerified)}</span>,
      created: date(account.createdAt),
      email: <span className={styles.email}>{account.email}</span>,
      lastActive: account.lastActiveAt ? date(account.lastActiveAt) : '—',
      onboarded: account.onboardedAt ? date(account.onboardedAt) : '—',
      plans: formatNumber(account.plans, locale),
      professional: yesNo(account.professional),
      role: t.roles[account.role],
      tier: t.tiers[account.tier]
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title}>
        <PeriodSelector current={period} label={common.period} optionLabel={common.periodOption} pathname={PATHNAME} query={query} />
      </AdminPageHeader>

      {opened.length > 0 ? (
        <p className={styles.opened} role="status">
          {interpolate(t.justOpened, { email: opened.join(', ') })}
        </p>
      ) : null}

      {people ? (
        <AdminSection title={t.signUpsTitle}>
          <Card>
            <ColumnChart
              className={styles.chart}
              dataLabel={common.dataLabel}
              emptyLabel={t.signUpsEmpty}
              labels={people.signUps.weeks}
              labelsHeader={common.week}
              locale={locale}
              series={[{ name: t.signUpsSeries, values: people.signUps.values }]}
              title={t.signUpsChart}
            />
          </Card>
        </AdminSection>
      ) : null}

      <AdminSection title={t.tableTitle}>
        <AdminTable
          caption={t.caption}
          columns={columns}
          empty={t.empty}
          filters={filters}
          locale={locale}
          noMatch={t.noMatch}
          paging={{ offset: accounts.offset, size: accounts.size }}
          pathname={PATHNAME}
          query={query}
          rows={rows}
          search={{ label: t.search, value: table.q }}
          sort={{ dir: table.dir, value: table.sort }}
          total={accounts.total}
          words={common.table}
        />
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
