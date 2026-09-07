import { ImageResponse } from 'next/og';

import { BrandMark } from 'lib/brandIcon';

/**
 * The favicon and the manifest's large icon, from one file: the bare mark at
 * 512px, which every browser downscales for a tab and every home screen accepts
 * as is. One size on purpose — a multi-size route needs an id Next hands the
 * renderer, and the shape of that changed underfoot.
 */
export const contentType = 'image/png';
export const size = { height: 512, width: 512 };

export default function Icon() {
  return new ImageResponse(<BrandMark size={size.width} />, size);
}
