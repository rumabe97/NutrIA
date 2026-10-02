import { Fragment } from 'react';

import { notFound } from 'next/navigation';

import styles from './page.module.css';

import { activeLocale, getDictionary } from 'i18n/server';
import { FLAGS } from 'core/domain/Flag';

import { AdminPageHeader } from 'components/AdminPageHeader';
import { AdminSection } from 'components/AdminSection';
import { AdminTable, apiSearch, readTableQuery } from 'components/AdminTable';
import { HowCounted } from 'components/HowCounted';

import { AUDIT_ACTIONS, auditQuerySchema } from 'core/entities/Audit';

import { formatInstant, interpolate } from 'lib/format';
import { serverApi } from 'lib/server-api';

import { consoleMetadata } from '../../consoleMetadata';
import { overriddenAllergens } from './overriddenAllergens';
import { removedAcceptedBy } from './removedAcceptedBy';

import type { AdminTableColumn, AdminTableFilter } from 'components/AdminTable';
import type { Allergen } from 'core/entities/Safety';
import type { AuditLogView } from 'core/controllers/Audit';
import type { FlagName } from 'core/domain/Flag';
import type { Metadata } from 'next';
import type { Paged } from 'core/controllers/User';
import type { PageQuery } from 'components/PeriodSelector';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return consoleMetadata('/admin/ajustes/registro');
}

const PATHNAME = '/admin/ajustes/registro';

/** The row's own key, back to the flag it belongs to — the reverse of `FLAGS`. */
const FLAG_BY_KEY = new Map<string, FlagName>((Object.keys(FLAGS) as FlagName[]).map(name => [FLAGS[name].key, name]));

/**
 * Ajustes › Registro de acciones (`0071`): the owner's own trail, filtered by action and
 * paged, newest first. Every row is a mutation that already happened — nothing here is
 * clickable, and nothing here is a person's plan, meal or health value (`0028`): only who
 * did what to which account, and when. A picture accepted against the judge (`0072`) says
 * which allergens the judge had flagged, in the catalogue's words; a removed picture says
 * who had accepted it (project 010).
 */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  const table = readTableQuery(auditQuerySchema, query);
  const [dictionary, locale, log, allergens] = await Promise.all([
    getDictionary(),
    activeLocale(),
    serverApi<Paged<AuditLogView>>(`/admin/audit?${apiSearch(table)}`),
    serverApi<readonly Allergen[]>('/safety/allergens')
  ]);

  if (!log) {
    notFound();
  }

  const common = dictionary.adminConsole;
  const t = dictionary.adminAudit;
  const admin = dictionary.admin;
  const tiers = dictionary.adminAccounts.tiers;

  const flagLabel: Readonly<Record<FlagName, string>> = {
    accompaniments: admin.accompanimentsLabel,
    automaticActivation: admin.automaticActivation,
    checkInReminders: admin.remindersTitle,
    dishPictures: admin.picturesLabel,
    premium: admin.premiumLabel,
    professional: admin.professionalLabel
  };

  const settingLabel = (key: string): string => {
    const name = FLAG_BY_KEY.get(key);

    return name ? flagLabel[name] : key;
  };

  const allergenName = new Map((allergens ?? []).map(allergen => [allergen.key, allergen.labelEs]));

  const tierLabel = (tier: string): string => (tier === 'free' || tier === 'premium' ? tiers[tier] : tier);

  const at = (iso: string) =>
    formatInstant(Date.parse(iso), locale, { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short', timeZone: 'Europe/Madrid' });

  function detail(row: AuditLogView): ReactNode {
    const data = row.detail;

    if (!data) {
      return '—';
    }

    if (row.action === 'account.tier_changed' && typeof data.from === 'string' && typeof data.to === 'string') {
      return interpolate(t.tierChange, { from: tierLabel(data.from), to: tierLabel(data.to) });
    }

    if (row.action === 'setting.changed' && typeof data.key === 'string' && typeof data.enabled === 'boolean') {
      return interpolate(t.settingChange, { key: settingLabel(data.key), state: data.enabled ? t.state.on : t.state.off });
    }

    if (row.action === 'auth.password_changed' && (data.via === 'change' || data.via === 'reset')) {
      return t.passwordVia[data.via];
    }

    if (row.action === 'auth.backup_code_used' && typeof data.remaining === 'number') {
      return interpolate(t.backupCodesLeft, { remaining: data.remaining });
    }

    if (row.action === 'auth.sessions_revoked' && (data.scope === 'one' || data.scope === 'others' || data.scope === 'all')) {
      return t.sessionsScope[data.scope];
    }

    // With no actor, the actor column already says how (`actor` below); say it once.
    if (row.action === 'account.activated' && row.actor && typeof data.via === 'string' && data.via in t.via) {
      return t.via[data.via as keyof typeof t.via];
    }

    const acceptedBy = row.action === 'picture.removed' ? removedAcceptedBy(data) : null;

    if (acceptedBy !== null) {
      return t.removedAcceptedBy[acceptedBy];
    }

    const overridden = row.action === 'picture.accepted' ? overriddenAllergens(data) : null;

    if (overridden !== null) {
      // The labels the console uses for allergens everywhere, Spanish only: marked so, for a screen reader on the English page.
      return overridden.length === 0 ? (
        t.allergensOverriddenNone
      ) : (
        <Fragment>
          {t.allergensOverridden} <span lang="es">{overridden.map(key => allergenName.get(key) ?? key).join(', ')}</span>
        </Fragment>
      );
    }

    return '—';
  }

  function actor(row: AuditLogView): string {
    if (row.actor) {
      return row.actor;
    }

    const via = row.detail && typeof row.detail.via === 'string' && row.detail.via in t.via ? (row.detail.via as keyof typeof t.via) : 'automatic';

    return t.via[via];
  }

  const columns: AdminTableColumn[] = [
    { header: t.columns.date, key: 'date' },
    { header: t.columns.action, key: 'action' },
    { header: t.columns.account, key: 'account' },
    { header: t.columns.actor, key: 'actor' },
    { header: t.columns.detail, key: 'detail' }
  ];

  const filters: AdminTableFilter[] = [
    {
      anyLabel: common.table.any,
      label: t.columns.action,
      name: 'action',
      options: AUDIT_ACTIONS.map(action => ({ label: t.actions[action], value: action })),
      value: table.action
    }
  ];

  const rows = log.rows.map((row, index) => ({
    id: `${row.at}-${index}`,
    cells: {
      account: row.subject ?? '—',
      action: t.actions[row.action as (typeof AUDIT_ACTIONS)[number]] ?? row.action,
      actor: actor(row),
      date: at(row.at),
      detail: detail(row)
    }
  }));

  return (
    <div className={styles.page}>
      <AdminPageHeader intro={t.intro} title={t.title} />

      <AdminSection note={t.tableNote} title={t.tableTitle}>
        <AdminTable
          caption={t.caption}
          columns={columns}
          empty={t.empty}
          filters={filters}
          locale={locale}
          noMatch={t.noMatch}
          paging={{ offset: log.offset, size: log.size }}
          pathname={PATHNAME}
          query={query}
          rows={rows}
          total={log.total}
          words={common.table}
        />
      </AdminSection>

      <HowCounted notes={t.howCounted} summary={common.howCounted} />
    </div>
  );
}
