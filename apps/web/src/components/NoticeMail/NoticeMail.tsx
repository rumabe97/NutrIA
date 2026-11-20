import styles from './NoticeMail.module.css';

import { interpolate } from 'lib/format';

/** The four approved fields of the notice (`docs/legal/textos/06` § Z), in one language. */
export interface NoticeMailWords {
  choose: string;
  intro: string;
  subject: string;
  what: string;
}

interface NoticeMailProps {
  /** The day as that language's mail writes it (the preview's `dateAsWritten`), or null before a preview. */
  date: string | null;
  /** What stands in for the day before there is one: «[el día que elijas]». */
  dateUnset: string;
  /** The address the service answers at. */
  email: string;
  /** The mail's language, for a screen reader: `es` or `en`. */
  lang: 'en' | 'es';
  /** The language's name in the console's own language, over the mail. */
  language: string;
  /** That language's privacy policy (at «Tu profesional en NutrIA») and terms, whole. */
  links: { privacyUrl: string; termsUrl: string };
  /** "Asunto" / "Subject". */
  subjectLabel: string;
  words: NoticeMailWords;
}

/**
 * The change notice as one language's accounts will read it: the subject, then the
 * three paragraphs the template sends (`TermsChangeNotice`), with the day, the links
 * and the address filled in the same way. A quotation, not an instruction: a sunken
 * block, marked with the mail's language.
 */
export function NoticeMail({ date, dateUnset, email, lang, language, links, subjectLabel, words }: NoticeMailProps) {
  return (
    <figure className={styles.mail}>
      <figcaption className={styles.language}>{language}</figcaption>
      <blockquote className={styles.quote} lang={lang}>
        <p className={styles.subject}>
          <span className={styles.subjectLabel}>{subjectLabel}</span> {words.subject}
        </p>
        <p>{interpolate(words.intro, { date: date ?? dateUnset })}</p>
        <p>{words.what}</p>
        <p>{interpolate(words.choose, { email, privacyUrl: links.privacyUrl, termsUrl: links.termsUrl })}</p>
      </blockquote>
    </figure>
  );
}
