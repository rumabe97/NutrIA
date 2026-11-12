import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';

import { accountWaitingEmail } from './AccountWaiting.js';
import { careInvitationEmail } from './CareInvitation.js';
import { checkInReminderEmail } from './CheckInReminder.js';
import { checkInSubmittedEmail } from './CheckInSubmitted.js';
import { existingAccountSignUpEmail } from './ExistingAccountSignUp.js';
import { ownerAlertEmail } from './OwnerAlert.js';
import { ownerDigestEmail } from './OwnerDigest.js';
import { passkeyAddedEmail } from './PasskeyAdded.js';
import { passwordChangedEmail } from './PasswordChanged.js';
import { passwordResetEmail } from './PasswordReset.js';
import { professionalGrantedEmail } from './ProfessionalGranted.js';
import { twoFactorChangedEmail } from './TwoFactorChanged.js';
import { twoFactorRemovalEmail } from './TwoFactorRemoval.js';
import { verifyEmail } from './VerifyEmail.js';

import type { EmailLocale, RenderedEmail } from './Layout.js';
import type { OwnerAlert } from './OwnerAlert.js';
import type { TwoFactorEvent } from './TwoFactorChanged.js';
import type { TwoFactorRemovalEvent } from './TwoFactorRemoval.js';
import type { OwnerDigest } from 'core/controllers/Admin';

/**
 * What every mail says, held to what it said before project 024 gave the mails a new look
 * (phase 7b, PRD criterion 2): the subject, the plain-text part, and the words and links of the
 * HTML part, byte for byte.
 *
 * `__fixtures__/mail-text.json` was written from the templates as they were on `main` before the
 * look changed, in a commit of its own that touched no template; the commit that changed the
 * look did not touch it. A change of look keeps this green. A change of words fails it, and the
 * fixture is then rewritten on purpose, in the same change as the words, where a reviewer sees
 * both.
 *
 * The HTML's text is what a reader gets of it: the `<body>`'s words, a line per block, links'
 * targets listed apart, the `<title>` and `<html lang>` beside them. Styles, classes and empty
 * decoration are not text, so a new frame around the same words reads the same.
 */
const LINK = 'https://nutria.example/es/acceder?next=/plan&x=<1>';
const RECOVER = 'https://nutria.example/es/recuperar';
const PRIVACY = 'https://nutria.example/es/privacidad';
const AT = new Date('2026-10-01T13:05:00.000Z');
const DUE = new Date('2026-10-03T13:05:00.000Z');
const IPHONE = { browser: 'safari', system: 'iphone' } as const;
const NOTHING = {} as const;

function link(path: string): string {
  return `https://nutria.example${path}`;
}

const DIGEST: OwnerDigest = {
  crons: ['rewrite', 'reminders'],
  failedGenerations: [
    { code: 'GENERATION_AI_UNAVAILABLE', n: 3 },
    { code: 'OTHER', n: 1 }
  ],
  failedMail: [{ kind: 'verify-email', n: 2 }],
  newMessages: 4,
  pictureSpend: { capUsd: 10, share: 0.93, spentUsd: 9.3 },
  shouldBeZero: { mealsOutsideServingBounds: 2, overBound: 5, refusalLimit: 1, uncosted: 1, unserved: 3 },
  textSpend: { capUsd: 25, share: 0.84, spentUsd: 21 },
  waitingAccounts: 2
};

const QUIET_DIGEST: OwnerDigest = {
  crons: [],
  failedGenerations: [],
  failedMail: [],
  newMessages: 0,
  pictureSpend: { capUsd: 10, share: 0.1, spentUsd: 1 },
  shouldBeZero: { mealsOutsideServingBounds: 0, overBound: 0, refusalLimit: 0, uncosted: 0, unserved: 0 },
  textSpend: undefined,
  waitingAccounts: 1
};

const ALERTS: readonly OwnerAlert[] = [
  { codes: ['GENERATION_AI_UNAVAILABLE', 'GENERATION_TIMED_OUT', 'OTHER'], type: 'failures' },
  { capUsd: 25, share: 0.84, source: 'text', spentUsd: 21, threshold: 80, type: 'spend' },
  { capUsd: 10, share: 1.02, source: 'pictures', spentUsd: 10.2, threshold: 100, type: 'spend' },
  { type: 'reminders-silent' },
  {
    reasons: [
      { n: 2, reason: 'judge_allergen' },
      { n: 1, reason: 'no_provenance' }
    ],
    type: 'picture-failures'
  },
  {
    reasons: [
      { n: 2, reason: 'payment_refused' },
      { n: 1, reason: 'model_refused' }
    ],
    type: 'picture-payment-refused'
  }
];

const TWO_FACTOR: readonly TwoFactorEvent[] = [
  { kind: 'enabled', otherSessionsClosed: true },
  { kind: 'enabled', otherSessionsClosed: false },
  { kind: 'disabled' },
  { kind: 'backup-code-used', remaining: 1 },
  { kind: 'backup-code-used', remaining: 7 },
  { kind: 'backup-codes-regenerated' }
];

const REMOVAL: readonly TwoFactorRemovalEvent[] = [{ dueAt: DUE, kind: 'requested' }, { kind: 'cancelled' }, { kind: 'removed' }];

const LOCALES: readonly EmailLocale[] = ['es-ES', 'en-GB'];

/** Every mail the product sends, in each form its words can take, named so a failure says which. */
function cases(): readonly (readonly [string, RenderedEmail])[] {
  const perLocale = LOCALES.flatMap(locale => [
    [`accountWaiting ${locale}`, accountWaitingEmail({ locale, url: LINK })] as const,
    [`careInvitation ${locale}`, careInvitationEmail({ inviterName: 'Ana <b>Dietista</b>', locale, privacyUrl: PRIVACY, url: LINK })] as const,
    [`checkInReminder ${locale}`, checkInReminderEmail({ locale, url: LINK })] as const,
    [`checkInSubmitted ${locale}`, checkInSubmittedEmail({ clientName: 'Lucía & co', locale, url: LINK })] as const,
    [`existingAccountSignUp ${locale}`, existingAccountSignUpEmail({ locale, recoverUrl: RECOVER, signInUrl: LINK })] as const,
    [`passkeyAdded ${locale}`, passkeyAddedEmail({ at: AT, device: IPHONE, locale, recoverUrl: RECOVER })] as const,
    [`passkeyAdded no-device ${locale}`, passkeyAddedEmail({ at: AT, device: NOTHING, locale, recoverUrl: RECOVER })] as const,
    [`passwordChanged ${locale}`, passwordChangedEmail({ at: AT, device: IPHONE, locale, recoverUrl: RECOVER })] as const,
    [`passwordChanged no-device ${locale}`, passwordChangedEmail({ at: AT, device: NOTHING, locale, recoverUrl: RECOVER })] as const,
    [
      `passwordChanged one-passkey ${locale}`,
      passwordChangedEmail({ at: AT, device: IPHONE, locale, passkeysRemoved: 1, recoverUrl: RECOVER })
    ] as const,
    [
      `passwordChanged passkeys ${locale}`,
      passwordChangedEmail({ at: AT, device: IPHONE, locale, passkeysRemoved: 3, recoverUrl: RECOVER })
    ] as const,
    [`passwordReset ${locale}`, passwordResetEmail({ locale, url: LINK })] as const,
    [`professionalGranted ${locale}`, professionalGrantedEmail({ collegiateNumber: 'MAD00123', locale, url: LINK })] as const,
    ...TWO_FACTOR.map(
      event =>
        [
          `twoFactorChanged ${JSON.stringify(event)} ${locale}`,
          twoFactorChangedEmail({ at: AT, device: IPHONE, event, locale, recoverUrl: RECOVER })
        ] as const
    ),
    [
      `twoFactorChanged no-device ${locale}`,
      twoFactorChangedEmail({ at: AT, device: NOTHING, event: { kind: 'disabled' }, locale, recoverUrl: RECOVER })
    ] as const,
    ...REMOVAL.map(event => [`twoFactorRemoval ${event.kind} ${locale}`, twoFactorRemovalEmail({ event, locale, signInUrl: LINK })] as const),
    [`verifyEmail ${locale}`, verifyEmail({ locale, url: LINK })] as const
  ]);

  // The owner's mails are Spanish only (`OWNER_LOCALE`).
  const owner = [
    ...ALERTS.map(alert => [`ownerAlert ${JSON.stringify(alert)}`, ownerAlertEmail({ alert, link })] as const),
    ['ownerDigest full', ownerDigestEmail({ digest: DIGEST, link })] as const,
    ['ownerDigest quiet', ownerDigestEmail({ digest: QUIET_DIGEST, link })] as const
  ];

  return [...perLocale, ...owner];
}

/** The five escapes `escapeHtml` writes, and any numeric one, back to their characters. */
function decode(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** A block element starts a new line of text; an inline one does not. */
const BLOCK = /<\/?(?:address|blockquote|br|center|div|h[1-6]|hr|li|ol|p|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

/** The words a reader of the HTML part gets, a line per block, and nothing of how it is drawn. */
function textOfHtml(html: string): {
  readonly lang: string | null;
  readonly links: readonly string[];
  readonly title: string | null;
  readonly words: string;
} {
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  const words = decode(
    body
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/\s+/g, ' ')
      .replace(BLOCK, '\n')
      .replace(/<[^>]*>/g, '')
  )
    .split('\n')
    .map(line => line.replace(/ +/g, ' ').trim())
    .filter(line => line !== '')
    .join('\n');

  return {
    lang: /<html\b[^>]*\blang="([^"]*)"/i.exec(html)?.[1] ?? null,
    links: [...body.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)].map(match => decode(match[1] ?? '')),
    title: (() => {
      const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1];

      return title === undefined ? null : decode(title);
    })(),
    words
  };
}

/**
 * The dates are written by `Intl`, whose wording moves with the ICU data a Node release ships;
 * the fixture holds a placeholder, so this spec checks the templates and not the runtime.
 */
function withoutDates(value: string): string {
  return LOCALES.reduce(
    (out, locale) =>
      [AT, DUE].reduce(
        (inner, at, i) =>
          inner.replaceAll(
            new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(at),
            `{date${String(i)}}`
          ),
        out
      ),
    value
  );
}

function readable(mail: RenderedEmail) {
  const html = textOfHtml(mail.html);

  return {
    html: { ...html, title: html.title === null ? null : withoutDates(html.title), words: withoutDates(html.words) },
    kind: mail.kind,
    subject: withoutDates(mail.subject),
    text: withoutDates(mail.text)
  };
}

const BEFORE = JSON.parse(readFileSync(new URL('./__fixtures__/mail-text.json', import.meta.url), 'utf8')) as Record<string, unknown>;

describe('what every mail says', () => {
  const all = cases();

  it('covers every case the fixture holds, and no other', () => {
    expect(all.map(([name]) => name).sort()).toEqual(Object.keys(BEFORE).sort());
  });

  it.each(all)('%s says what it said before the new look', (name, mail) => {
    expect(readable(mail)).toEqual(BEFORE[name]);
  });
});
