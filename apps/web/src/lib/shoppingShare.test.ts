import { describe, expect, it } from 'vitest';

import { nearbyShopsUrl, shoppingListText } from './shoppingShare';

const GROUPS = [
  {
    items: [
      { id: 'tomato', name: 'Tomate', quantity: '500 g' },
      { id: 'banana', name: 'Plátano', quantity: '6 ud.' }
    ],
    label: 'Fruta y verdura'
  },
  { items: [{ id: 'chicken', name: 'Pechuga de pollo', quantity: '1,2 kg' }], label: 'Carne y pescado' }
];

describe('shoppingListText', () => {
  it('writes what is left to buy, one aisle per paragraph, one line per item', () => {
    expect(shoppingListText('Lista de la compra', GROUPS, () => false)).toBe(
      ['Lista de la compra', 'Fruta y verdura\n• Tomate — 500 g\n• Plátano — 6 ud.', 'Carne y pescado\n• Pechuga de pollo — 1,2 kg'].join('\n\n')
    );
  });

  /* Already in the trolley, and a list for whoever goes to the shop is a list of what is still to find. */
  it('leaves out what is ticked, and an aisle with nothing left in it', () => {
    const ticked = new Set(['tomato', 'banana']);

    expect(shoppingListText('Lista', GROUPS, id => ticked.has(id))).toBe('Lista\n\nCarne y pescado\n• Pechuga de pollo — 1,2 kg');
  });

  it('has nothing to send when everything is ticked', () => {
    expect(shoppingListText('Lista', GROUPS, () => true)).toBeNull();
  });
});

describe('nearbyShopsUrl', () => {
  it('opens Apple Maps on an Apple device', () => {
    expect(nearbyShopsUrl('supermercado', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('https://maps.apple.com/?q=supermercado');
  });

  it('opens Google Maps everywhere else, with the search in the reader’s language', () => {
    expect(nearbyShopsUrl('supermarket', 'Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('https://www.google.com/maps/search/supermarket/');
  });
});
