/**
 * Which of the three states the assistant's warning is in (`docs/legal/2026-11-11-redesign.md`
 * § 6.5): FULL while the conversation has no message, FOLDED once it has one, EXPANDED after
 * «Aviso completo» is pressed on a folded warning.
 */
export type WarningState = 'expanded' | 'folded' | 'full';

export function warningState(messages: number, opened: boolean): WarningState {
  if (messages === 0) {
    return 'full';
  }

  return opened ? 'expanded' : 'folded';
}

/**
 * Whether the warning stays opened after the conversation changed. An emptied conversation
 * shows it FULL; when a message arrives again it folds, as it did the first time — an
 * «opened» kept from before would bring it back already expanded, which § 6.5 does not allow.
 * Nothing is stored: this is the visit's React state only.
 */
export function warningOpenedAfter(opened: boolean, messages: number): boolean {
  return messages === 0 ? false : opened;
}
