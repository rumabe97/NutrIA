import { ACCENT_END, ACCENT_START, TILE_BACKGROUND } from 'lib/brandColours';

/**
 * The brand mark as an image: the same leaf the headers draw in CSS — a square with one square
 * corner and three round ones — rendered by `next/og` for the favicon, the home-screen icon and
 * the manifest, in the accent's gradient.
 *
 * Drawn rather than shipped as PNGs so there is one definition of the mark. The colours come
 * from `lib/brandColours`, fixed: an icon is rendered once and lives on a home screen, where
 * there is no theme to follow.
 *
 * `next/og` renders with Satori, which lays out flexbox only: every container declares
 * `display: flex`, and radii are pixels, not percentages.
 */
function markRadius(markSize: number): string {
  const round = markSize / 2;

  return `${Math.round(markSize * 0.22)}px ${round}px ${round}px ${round}px`;
}

const LEAF = `linear-gradient(135deg, ${ACCENT_START}, ${ACCENT_END})`;

/**
 * The mark alone, filling the canvas — for a favicon, where a tile would just be a dark dot — or
 * centred on the aubergine tile for a home screen, where the platform masks the corners itself.
 */
export function BrandMark({ size, tiled = false }: { readonly size: number; readonly tiled?: boolean }) {
  const mark = tiled ? Math.round(size * 0.56) : size;
  const shape = <div style={{ backgroundImage: LEAF, borderRadius: markRadius(mark), display: 'flex', height: mark, width: mark }} />;

  if (!tiled) {
    return shape;
  }

  return (
    <div style={{ alignItems: 'center', background: TILE_BACKGROUND, display: 'flex', height: size, justifyContent: 'center', width: size }}>
      {shape}
    </div>
  );
}
