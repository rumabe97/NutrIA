import { ImageResponse } from 'next/og';

import { BrandMark } from 'lib/brandIcon';

/**
 * The favicon and the manifest's large icon, from one file: the bare mark at
 * 512px, which every browser downscales for a tab and every home screen accepts
 * as is. One size on purpose — a multi-size route needs an id Next hands the
 * renderer, and the shape of that changed underfoot.
 *
 * `favicon.ico` beside this file is the same mark at 16, 32 and 48px, made by scaling this
 * route's own picture down: Next declares it in every page's head, and it is what answers
 * anything that asks for `/favicon.ico` without reading the page — a search result, a link's
 * preview, Safari's tab overview. When the mark or its colours change, make that file again.
 */
export const contentType = 'image/png';
export const size = { height: 512, width: 512 };

export default function Icon() {
  return new ImageResponse(<BrandMark size={size.width} />, size);
}
