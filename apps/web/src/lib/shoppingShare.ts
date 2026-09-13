/**
 * The shopping list as something to send, and the way to the nearest shop.
 *
 * Pure on purpose: what goes in a message, and which map opens, are the parts
 * worth a test, and neither needs a browser to decide.
 */

export type ShareGroup = {
  readonly items: readonly { readonly id: string; readonly name: string; readonly quantity: string }[];
  /** The aisle, already in the reader's language. */
  readonly label: string;
};

/**
 * What is left to buy, as plain text: a title, one aisle per paragraph, one
 * line per item. Plain text rather than anything richer, because it goes into
 * WhatsApp, a note or a message, and all of them read plain text the same way.
 *
 * Ticked items are left out: they are already in the trolley, and a list sent
 * to whoever is going to the shop is a list of what they still have to find.
 * `null` when nothing is left.
 */
export function shoppingListText(title: string, groups: readonly ShareGroup[], ticked: (id: string) => boolean): string | null {
  const paragraphs = groups
    .map(group => ({ ...group, items: group.items.filter(item => !ticked(item.id)) }))
    .filter(group => group.items.length > 0)
    .map(group => [group.label, ...group.items.map(item => `• ${item.name} — ${item.quantity}`)].join('\n'));

  return paragraphs.length === 0 ? null : [title, ...paragraphs].join('\n\n');
}

/**
 * A map searching for supermarkets around wherever the phone is.
 *
 * The map finds the place, not this app: nothing here asks for or learns
 * anybody's location. Apple Maps on an iPhone, iPad or Mac, where it is the
 * one already there; Google Maps everywhere else.
 */
export function nearbyShopsUrl(query: string, userAgent: string): string {
  const apple = /iPhone|iPad|iPod|Macintosh/.test(userAgent);
  const search = encodeURIComponent(query);

  return apple ? `https://maps.apple.com/?q=${search}` : `https://www.google.com/maps/search/${search}/`;
}
