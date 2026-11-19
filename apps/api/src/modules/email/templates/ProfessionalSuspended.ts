import { layout, paragraph } from './Layout.js';
import { fill, oneLine } from './ProfessionalBadgeCode.js';

import type { RestrictionSource } from 'core/entities/Professional';
import type { EmailLocale, RenderedEmail } from './Layout.js';

/**
 * The owner's statement of reasons for a suspension or a close (`docs/legal/textos/06`
 * § W bis, P2B art. 4.5, DSA art. 17.3): the facts the owner wrote, the section of
 * the agreement read with its § 13, and where the decision came from. Shared by
 * the suspension's mail and the close's.
 */
export type PracticeStatement = {
  readonly authority: string | null;
  readonly clause: number | null;
  readonly facts: string;
  readonly source: RestrictionSource;
};

/** The longest facts the owner's words carry into a mail; the schema already bounds them. */
const FACTS_LIMIT = 1000;

/**
 * The owner's words as plain text, whatever was typed: control characters and
 * markup removed, whitespace folded to single spaces, bounded. The HTML part
 * escapes them again (`paragraph`); this is what keeps the text part one plain
 * paragraph too.
 */
export function plainFacts(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- the owner's words are one plain paragraph
      .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, FACTS_LIMIT)
  );
}

/** The facts as a sentence of their own: closed with a full stop when the owner did not close it. */
export function asSentence(text: string): string {
  const plain = plainFacts(text);

  return plain === '' || /[.!?…»"”)]$/.test(plain) ? plain : `${plain}.`;
}

/** The facts as the end of somebody else's sentence (§ W bis.2 «Lo hemos revisado y {facts}.»): no closing stop of their own. */
export function asClause(text: string): string {
  return plainFacts(text).replace(/[.\s]+$/, '');
}

const WHY: Record<EmailLocale, { readonly clause: string; readonly source: Readonly<Record<RestrictionSource, string>>; readonly why: string }> = {
  'en-GB': {
    clause: ', read with its section {n}',
    source: {
      authority: '{authority} requires it of us.',
      notice: 'We looked into it after a notice we received.',
      own_review: 'We decided it ourselves, from our own review.'
    },
    why: 'Why: {reason} That is what section 13 of the professional’s agreement you accepted says{clause}. {source}'
  },
  'es-ES': {
    clause: ', en relación con su § {n}',
    source: {
      authority: 'Nos lo exige {authority}.',
      notice: 'Lo hemos revisado tras un aviso que nos llegó.',
      own_review: 'Lo hemos decidido nosotros, por nuestra propia revisión.'
    },
    why: 'Por qué: {reason} Es lo que dice el § 13 del acuerdo del profesional que aceptaste{clause}. {source}'
  }
};

/** § W bis.1's `why`, which § W bis.3 repeats: the facts, § 13 and the clause read with it, and the source. */
export function statementWhy(statement: PracticeStatement, locale: EmailLocale): string {
  const copy = WHY[locale];
  const authority = statement.authority === null ? '' : oneLine(plainFacts(statement.authority));

  return fill(copy.why, {
    clause: statement.clause === null ? '' : fill(copy.clause, { n: String(statement.clause) }),
    reason: asSentence(statement.facts),
    source: fill(copy.source[statement.source], { authority })
  });
}

const COPY: Record<EmailLocale, { readonly redress: string; readonly subject: string; readonly what: string }> = {
  'en-GB': {
    redress:
      'To clarify the facts or ask us to look again, reply to this email: a person reviews it and answers you. If we lift the suspension, we will tell you and you will be able to open your practice again. You can also go to the courts.',
    subject: 'We have suspended your account as a professional on NutrIA',
    what: 'From today your account is suspended as a professional: you see no client’s data, you cannot invite anyone and you cannot open a practice until we lift the suspension. Your personal NutrIA account carries on as it was.'
  },
  'es-ES': {
    redress:
      'Para aclarar los hechos o pedir que lo revisemos, responde a este correo: lo revisa una persona y te contesta. Si levantamos la suspensión, te lo diremos y podrás volver a abrir tu consulta. También puedes acudir a los tribunales.',
    subject: 'Hemos suspendido tu cuenta como profesional en NutrIA',
    what: 'Desde hoy tu cuenta está suspendida como profesional: no ves los datos de ningún cliente, no puedes invitar a nadie y no puedes abrir una consulta hasta que levantemos la suspensión. Tu cuenta personal de NutrIA sigue como estaba.'
  }
};

/**
 * The statement of reasons when the owner suspends an account as a practitioner
 * (`docs/legal/textos/06` § W bis.1, approved by the owner on 2026-11-19; P2B
 * art. 4.1: before or as it takes effect, on a durable medium). What it means,
 * why, and how to ask again. No health word and no client's name: it names no
 * client at all.
 */
export function professionalSuspendedEmail({ locale, statement }: { locale: EmailLocale; statement: PracticeStatement }): RenderedEmail {
  const copy = COPY[locale];
  const why = statementWhy(statement, locale);
  const html = layout({ body: [paragraph(copy.what), paragraph(why), paragraph(copy.redress, 'muted')].join('\n'), locale, title: copy.subject });

  return { html, kind: 'professional-suspended', subject: copy.subject, text: [copy.what, '', why, '', copy.redress].join('\n') };
}
