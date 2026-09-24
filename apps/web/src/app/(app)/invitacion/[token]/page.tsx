import { notFound } from 'next/navigation';

import { CareInvitation } from 'components/CareInvitation';

import { serverApi } from 'lib/server-api';

import { appMetadata } from '../../../_shared/metadata';

import type { CareInvitationDetailView } from 'core/controllers/Care';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return appMetadata('/invitacion');
}

/**
 * Read before answered: who invites, the consent list, and the separate
 * health line — never a copy in the URL, always the current version
 * (`invitation.consentVersion`), read here and sent back unchanged.
 *
 * One 404 for every reason there is nothing to answer — expired, already
 * answered, sent to a different address, a token that is not ours — so the
 * screen never tells a visitor which of those it was.
 */
export default async function InvitationPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const invitation = await serverApi<CareInvitationDetailView>(`/care/invitations/${token}`);

  if (!invitation) {
    notFound();
  }

  return <CareInvitation invitation={invitation} token={token} />;
}
