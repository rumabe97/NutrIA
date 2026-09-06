import monk from 'eslint-plugin-monk';

function regex(directory) {
  return [`^(@|app/${directory})`, `^(@|app/_${directory})`, `^(@|./${directory})`, `^(@|./_${directory})`, `^(@|${directory})`];
}

const EXTERNAL_LIBRARIES = ['^@?\\w'];
const NOT_MATCHED = ['^'];
const STYLES = ['^.+\\.?(.styles)$', '^.+\\.?(.scss)$', '^.+\\.?(.css)$'];
const TYPES = [['^\\.'], ['^.+\\u0000$']];

// CSS cascade — the four design-system style files share one outer group so they print
// as a tight block (no blank lines between them), but the patterns are ordered so the
// items emit in cascade order. monk's output rule: items within an outer group are joined
// by single newlines; items between outer groups are joined by a blank line. The cascade
// order matters because:
//
//   1. `ui/styles/colors`     — raw palette (primitives only, never referenced directly)
//   2. `ui/styles/variables`  — semantic tokens (--background-01, --foreground-01, ...)
//   3. `ui/styles/base`       — shared CSS reset (box-sizing, body defaults, ...)
//   4. `ui/styles/classnames` — shared utility classes
//
// Followed (in the separate STYLES outer group below) by app-level CSS:
//
//   5. `styles/globals.css`   — app-specific globals
//   6. `styles/variables.css` — app-level token OVERRIDES (must load last so it wins the
//                                cascade and the documented branding pattern — remap
//                                --color-brand-01..12 etc. — actually works)
//
// Without this split, monk's generic STYLES group catches only `.css`-suffixed imports
// and leaves the extension-less `ui/styles/*` imports unmatched, so they end up at the
// bottom of the file. That silently reverses the cascade and breaks branding overrides.
//
// IMPORTANT: monk prefixes side-effect imports (the ones we care about here) with `\0`
// before running them through the patterns — see `imports.js` in the plugin source. So
// each pattern starts with `\\u0000?` to optionally match that null prefix. Without it,
// these patterns silently miss every side-effect `import 'ui/styles/…'`.
const UI_STYLES = [
  '^\\u0000?ui/styles/colors$',
  '^\\u0000?ui/styles/variables$',
  '^\\u0000?ui/styles/base$',
  '^\\u0000?ui/styles/classnames$'
];

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config}
 * */
export default [
  {
    plugins: {
      monk: monk
    },
    rules: {
      'monk/imports': [
        'error',
        {
          groups: [
            ['react', 'react-dom', 'recoil-lite', 'motion'],
            ['^next', '^@next'],
            // CSS cascade — order matters; see the comment above the constants for the reasoning.
            UI_STYLES,
            STYLES,
            EXTERNAL_LIBRARIES,
            regex('components'),
            regex('hooks'),
            regex('stores'),
            regex('utils'),
            ['core/entities'],
            ['core/repositories'],
            ['core/controllers'],
            ['core/^'],
            ['lib'],
            ...TYPES,
            NOT_MATCHED
          ]
        }
      ]
    }
  }
];
