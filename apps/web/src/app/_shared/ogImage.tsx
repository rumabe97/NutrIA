import { ImageResponse } from 'next/og';

import { dictionaryFor } from 'i18n/server';

import { BRAND_GREEN, BrandMark, TILE_BACKGROUND } from 'lib/brandIcon';

import type { Locale } from 'i18n/config';

/** 1200×630 is what every card renderer crops to; anything else gets cut somewhere. */
export const SHARE_IMAGE_SIZE = { height: 630, width: 1200 };
export const SHARE_IMAGE_TYPE = 'image/png';

const MUTED = '#a1a1a1';
const PAPER = '#fcfcfc';

/**
 * The picture a shared link shows, in the language of the tree it is mounted
 * under.
 *
 * Drawn here rather than shipped as two PNGs for the same reason the favicon is
 * (`lib/brandIcon`): one definition of the mark, and copy that comes from the
 * dictionary so a change of tagline reaches the card too. Without it every
 * share of NutrIA rendered as a grey rectangle with a URL under it.
 *
 * `next/og` renders with Satori, which lays out flexbox only — every container
 * declares `display: flex`, and there is no `gap` shorthand to lean on.
 */
export function shareImage(locale: Locale): ImageResponse {
  const dictionary = dictionaryFor(locale);

  return new ImageResponse(
    <div
      style={{
        background: TILE_BACKGROUND,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        padding: 80,
        width: '100%'
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex' }}>
        <BrandMark size={72} />
        <span style={{ color: PAPER, fontSize: 44, fontWeight: 600, marginLeft: 28 }}>NutrIA</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: PAPER, fontSize: 76, lineHeight: 1.15 }}>{dictionary.landing.title}</span>
        <span style={{ color: MUTED, fontSize: 34, marginTop: 28 }}>{dictionary.manifest.description}</span>
      </div>

      {/* The brand's one colour, as a rule the eye reads before the words. */}
      <div style={{ background: BRAND_GREEN, borderRadius: 4, display: 'flex', height: 8, width: 180 }} />
    </div>,
    SHARE_IMAGE_SIZE
  );
}
