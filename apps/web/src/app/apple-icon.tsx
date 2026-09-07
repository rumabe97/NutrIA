import { ImageResponse } from 'next/og';

import { BrandMark } from 'lib/brandIcon';

/** What iOS shows for "Add to Home Screen". Without it Safari asked for a file that was not there, on every load. */
export const contentType = 'image/png';
export const size = { height: 180, width: 180 };

export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={size.width} tiled={true} />, size);
}
