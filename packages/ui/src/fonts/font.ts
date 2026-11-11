import localFont from 'next/font/local';

/**
 * Two families, each a subset of the untouched upstream file beside it (`*.full.ttf`),
 * which is the only reason it can be rebuilt: `packages/ui/scripts/build-fonts.sh` derives
 * both, and `packages/ui/AGENTS.md` § Fonts says why each flag is there. Change one,
 * regenerate the other.
 *
 * - `font` is Figtree, the text face, on `--main-font`: every word that is not a heading.
 * - `displayFont` is Bricolage Grotesque, the heading face, on `--display-font`. `ui/styles/base`
 *   gives it to `h1`–`h6`; an app that never mounts it (`apps/docs`) keeps the text face there.
 *
 * `weight` looks redundant on a variable font and is the opposite. Next.js only writes a
 * `font-weight` descriptor when it is given one, and an `@font-face` without that descriptor
 * means `normal` — so the browser pins the `wght` axis at 400 and fakes the heavier weights by
 * smearing the 400 masters, while still paying to download the axis it refuses to use.
 * Declaring the range is what makes the file's own weights reachable. Each range matches the
 * range its file carries, which matches the weight tokens (`--font-weight-regular` …
 * `--font-weight-bold` for text, `--font-weight-semibold` … `--font-weight-heavy` for
 * headings); widen all three together or not at all.
 */
export const font = localFont({ src: './text.woff2', variable: '--main-font', weight: '400 700' });

export const displayFont = localFont({ src: './display.woff2', variable: '--display-font', weight: '600 800' });
