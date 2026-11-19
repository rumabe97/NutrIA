import { Fragment } from 'react';

import { Link } from 'ui/components/Link';

interface MailtoTextProps {
  /** The address that `{email}` stands for, drawn as a `mailto:` link. */
  email: string;
  /** A dictionary sentence, its other placeholders already filled, still carrying `{email}`. */
  text: string;
}

/** The one placeholder this draws as a link. */
const EMAIL_PLACEHOLDER = '{email}';

/**
 * A sentence whose `{email}` is a link that opens a message to it (`docs/legal/textos/05`
 * § G.2, § G.3: "escríbenos a {email}"). The words stay the dictionary's exactly; only the
 * address becomes something a tap can act on. Renders on the server or inside a client
 * component alike.
 */
export function MailtoText({ email, text }: MailtoTextProps) {
  return (
    <Fragment>
      {text.split(/(\{email\})/).map((part, index) =>
        part === EMAIL_PLACEHOLDER ? (
          // Index keys: the parts are a fixed split of one sentence and never reorder.
          // eslint-disable-next-line react/no-array-index-key
          <Link href={`mailto:${email}`} inline={true} key={index}>
            {email}
          </Link>
        ) : (
          // eslint-disable-next-line react/no-array-index-key
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </Fragment>
  );
}
