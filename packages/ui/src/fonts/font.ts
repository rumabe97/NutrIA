import localFont from 'next/font/local';

/**
 * `font.woff2` is a subset of `font.full.woff2`, which is the untouched
 * upstream file and the only reason this one can be rebuilt. The command that
 * derives it is in `packages/ui/AGENTS.md` § Fonts — change one, regenerate the
 * other.
 *
 * `weight` looks redundant on a variable font and is the opposite. Next.js only
 * writes a `font-weight` descriptor when it is given one, and an `@font-face`
 * without that descriptor means `normal` — so the browser pins the `wght` axis
 * at 400 and fakes 500, 600 and 700 by smearing the 400 masters, while still
 * paying to download the axis it refuses to use. Declaring the range is what
 * makes the file's own weights reachable. It matches the range the file
 * carries, which matches `--font-weight-regular` through `--font-weight-bold`;
 * widen all three together or not at all.
 */
export const font = localFont({
  src: './font.woff2',
  variable: '--main-font',
  weight: '400 700'
});
