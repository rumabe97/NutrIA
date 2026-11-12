/**
 * A title split around the words the approved sheets draw in the accent («Nutrición que se
 * adapta *a ti.*», project 024 phase 7). Both halves come from the dictionary, so the heading's
 * text — what a search engine and a screen reader read — is the title, unchanged.
 *
 * The accent must be the title's own last words; anything else (a translation that moved
 * them) draws the whole title plain rather than a sentence assembled wrongly.
 */
export function titleAccent(title: string, accent: string): { readonly accent: string; readonly lead: string } {
  if (!accent || !title.endsWith(accent) || accent === title) {
    return { accent: '', lead: title };
  }

  return { accent, lead: title.slice(0, title.length - accent.length) };
}
