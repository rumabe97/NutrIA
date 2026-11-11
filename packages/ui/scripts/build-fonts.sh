#!/bin/sh
# Rebuilds the two font files the apps load from the untouched upstream originals beside them.
#
# Usage: sh packages/ui/scripts/build-fonts.sh <bin-dir-with-fonttools>
#
# `fonttools`, `brotli` and `zopfli` are Python and not workspace dependencies. Install them into
# a throwaway virtualenv outside the repository and pass its `bin` directory:
#
#   python3 -m venv /tmp/fontenv
#   /tmp/fontenv/bin/pip install 'fonttools[woff]' brotli zopfli
#   sh packages/ui/scripts/build-fonts.sh /tmp/fontenv/bin
#
# What each flag is for, and what must stay true afterwards, is in packages/ui/AGENTS.md § Fonts.
# Change a range here and the `weight` strings in src/fonts/font.ts and the weight tokens in
# src/styles/variables.css change with it, or the browser silently clamps.
set -eu

bin="${1:?the bin directory of a virtualenv with fonttools, brotli and zopfli installed}"
fonts="$(cd "$(dirname "$0")/../src/fonts" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Google Fonts' `latin` and `latin-ext`, plus the arrows, operators and Mac modifier keys the
# products print. A glyph the upstream font does not draw is simply absent: the system font draws it.
UNICODES='U+0000-00FF,U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2000-206F,U+20A0-20C0,U+2113,U+2122,U+2190-2199,U+21E7,U+2200-22FF,U+2300-232B,U+2325,U+2713,U+2717,U+26A0,U+2C60-2C7F,U+A720-A7FF,U+FEFF,U+FFFD'

subset() {
  # `+=tnum`: tabular figures are not in pyftsubset's defaults, and `=` would drop kern/calt/mark.
  "$bin/pyftsubset" "$1" \
    --output-file="$2" \
    --unicodes="$UNICODES" \
    --layout-features+=tnum \
    --flavor=woff2 \
    --with-zopfli
}

# Text: Figtree, the weights --font-weight-regular … --font-weight-bold span.
"$bin/fonttools" varLib.instancer "$fonts/text.full.ttf" wght=400:700 --output="$work/text.ttf" -q
subset "$work/text.ttf" "$fonts/text.woff2"

# Display: Bricolage Grotesque for headings, --font-weight-semibold … --font-weight-heavy, at its
# normal width. The optical-size axis is kept whole: headings run from a card title to the hero.
"$bin/fonttools" varLib.instancer "$fonts/display.full.ttf" wght=600:800 wdth=100 --output="$work/display.ttf" -q
subset "$work/display.ttf" "$fonts/display.woff2"

wc -c "$fonts/text.woff2" "$fonts/display.woff2"
