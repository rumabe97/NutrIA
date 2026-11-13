/**
 * The one HTML frame every message the product sends is set in, in the look of project 024:
 * cream paper, the heavy heading weight, the leaf, a filled button and a flat note.
 *
 * Mail clients render a fraction of CSS and disagree about which fraction, so:
 *
 * - **Everything that matters is inline.** The light look (Claro) is written on each element, so
 *   a client that drops the `<style>` block — or ignores a dark preference — still shows a
 *   complete, legible mail in Claro.
 * - **Dark is a `prefers-color-scheme` block** with Oscuro's values, over classes, `!important`
 *   to win over the inline Claro. The `color-scheme` meta tells a client that honours it that
 *   the mail draws its own dark, so it does not invert the light one on top.
 * - **A gradient always sits on a solid colour** of its own start, so a client without
 *   gradients (Outlook's desktop engine, some webmails) paints the solid deep fill, which the
 *   label clears on its own.
 * - **No picture, no web font, no remote resource**: the leaf is a coloured box, the type is the
 *   system's at the display weight.
 *
 * The colours are literals because a mail cannot read the web's tokens. Each one copies a token
 * of `apps/web/src/styles/themes.css`, named in the comment on its line; `LayoutTokens.spec.ts`
 * reads both files and fails when a literal and its token differ, and when a colour is written
 * anywhere in these templates without a token beside it.
 *
 * A plain-text twin always travels alongside — some clients show only that, and every client
 * uses it for the preview line.
 */
const BRAND = 'NutrIA';

/** Claro, the light theme: what every client shows unless it honours a dark preference. */
const CLARO = {
  edge: '#e6d8c3', // --border-01
  fill: '#b93a12', // --color-brand-fill
  fillEnd: '#c4501a', // --color-brand-fill-end
  ink: '#2b1e18', // --foreground-01
  label: '#ffffff', // --color-on-brand-fill
  leaf: '#e2512b', // --color-accent-start
  leafEnd: '#f0a22c', // --color-accent-end
  link: '#b23710', // --color-brand-11
  muted: '#6f5a4d', // --foreground-02
  note: '#f3e9d9', // --surface-card
  paper: '#fbf5ea' // --background-01
} as const;

/** Oscuro, the dark theme: aubergine, the brighter accent, dark ink on the fill. */
const OSCURO = {
  edge: '#503848', // --border-01
  fill: '#ff6e45', // --color-brand-fill
  fillEnd: '#ff8a3d', // --color-brand-fill-end
  ink: '#fbefe3', // --foreground-01
  label: '#2a1b26', // --color-on-brand-fill
  leaf: '#ff6e45', // --color-accent-start
  leafEnd: '#ffc65c', // --color-accent-end
  link: '#ff9b7a', // --color-brand-11
  muted: '#c9aeb9', // --foreground-02
  note: '#3a2735', // --surface-card
  paper: '#2a1b26' // --background-01
} as const;

/** The system's own faces: no web font is ever requested from a mail. */
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** The display weight of the web's headings (`--font-weight-heavy`). */
const HEAVY = 800;

/** The radius of a control on the web (`--radius-control`). */
const CONTROL_RADIUS = '10px';

function gradient(from: string, to: string): string {
  return `linear-gradient(135deg,${from},${to})`;
}

/**
 * The dark look, and nothing else: every rule here repaints what the inline styles drew in
 * Claro. It carries no text a reader sees, so the specs that read a mail's words strip it
 * whole (`withoutStylesheet`).
 */
export const STYLESHEET = `<style>
:root{color-scheme:light dark;supported-color-schemes:light dark;}
@media (prefers-color-scheme: dark){
.nutria-paper{background-color:${OSCURO.paper}!important;}
.nutria-ink{color:${OSCURO.ink}!important;}
.nutria-muted{color:${OSCURO.muted}!important;}
.nutria-link{color:${OSCURO.link}!important;}
.nutria-note{background-color:${OSCURO.note}!important;}
.nutria-edge{border-color:${OSCURO.edge}!important;}
.nutria-leaf{background-color:${OSCURO.leaf}!important;background-image:${gradient(OSCURO.leaf, OSCURO.leafEnd)}!important;}
.nutria-fill{background-color:${OSCURO.fill}!important;background-image:${gradient(OSCURO.fill, OSCURO.fillEnd)}!important;color:${OSCURO.label}!important;}
}
</style>`;

/**
 * A mail's HTML without its stylesheet: what a spec looking for a word, an `@` or an address reads.
 *
 * @knipignore Exported for the templates' specs and the end-to-end suites that read an owner's
 * mail, its only callers.
 */
export function withoutStylesheet(html: string): string {
  return html.replace(STYLESHEET, '');
}

export type EmailLocale = 'en-GB' | 'es-ES';

/**
 * Which message this is, as the log may name it. A subject can carry a
 * person's name (an invitation's does) and is never logged; this is a fixed
 * label per template, and says nothing about anybody.
 */
export type EmailKind =
  | 'account-waiting'
  | 'backup-code-used'
  | 'backup-codes-regenerated'
  | 'care-invitation'
  | 'check-in-reminder'
  | 'checkin-submitted'
  | 'existing-account-sign-up'
  | 'owner-alert'
  | 'owner-digest'
  | 'owner-picture-alert'
  | 'passkey-added'
  | 'password-changed'
  | 'password-reset'
  | 'professional-granted'
  | 'two-factor-disabled'
  | 'two-factor-enabled'
  | 'two-factor-removal-cancelled'
  | 'two-factor-removal-requested'
  | 'two-factor-removed'
  | 'verify-email';

export interface RenderedEmail {
  html: string;
  kind: EmailKind;
  subject: string;
  text: string;
}

/** Text placed inside HTML must not become HTML — a URL carries `&`, a name may carry `<`. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * The leaf the web's header draws: a square with one square corner and three round ones, in the
 * accent's gradient over its first colour. Empty and hidden from a screen reader — the name
 * beside it is the brand.
 */
const LEAF = `<span class="nutria-leaf" aria-hidden="true" style="display:inline-block;width:0.875em;height:0.875em;margin-right:0.375em;vertical-align:-0.0625em;background-color:${CLARO.leaf};background-image:${gradient(CLARO.leaf, CLARO.leafEnd)};border-radius:0.19em 0.44em 0.44em 0.44em;"></span>`;

export function layout({ body, locale, title }: { body: string; locale: EmailLocale; title: string }): string {
  const lang = locale.split('-')[0] ?? 'es';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
${STYLESHEET}
</head>
<body class="nutria-paper" style="margin:0;padding:0;background-color:${CLARO.paper};font-family:${FONT};color:${CLARO.ink};">
<div class="nutria-paper" style="background-color:${CLARO.paper};">
<div style="max-width:32rem;margin:0 auto;padding:2rem 1.25rem;overflow-wrap:break-word;word-wrap:break-word;">
<p class="nutria-ink" style="margin:0 0 1.75rem;font-size:1.25rem;line-height:1.2;font-weight:${HEAVY};letter-spacing:-0.01em;color:${CLARO.ink};">${LEAF}${BRAND}</p>
${body}
<p class="nutria-muted nutria-edge" style="margin:2rem 0 0;padding-top:1rem;border-top:1px solid ${CLARO.edge};font-size:0.8125rem;font-weight:${HEAVY};color:${CLARO.muted};">${BRAND}</p>
</div>
</div>
</body>
</html>`;
}

/**
 * The filled button: the deep gradient over its solid start, so a client without gradients
 * still paints a fill the label clears 4.5:1 on. A link, because that is the only kind of button
 * mail clients agree on; it wraps inside its column rather than running off it.
 */
export function button(url: string, label: string): string {
  return `<p style="margin:1.5rem 0;"><a class="nutria-fill" href="${escapeHtml(url)}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:0.8125rem 1.5rem;background-color:${CLARO.fill};background-image:${gradient(CLARO.fill, CLARO.fillEnd)};color:${CLARO.label};text-decoration:none;border-radius:${CONTROL_RADIUS};font-size:1rem;line-height:1.25;font-weight:700;text-align:center;overflow-wrap:anywhere;">${escapeHtml(label)}</a></p>`;
}

export function paragraph(text: string, tone: 'body' | 'muted' = 'body'): string {
  const colour = tone === 'muted' ? CLARO.muted : CLARO.ink;
  const size = tone === 'muted' ? '0.875rem' : '1rem';

  return `<p class="nutria-${tone === 'muted' ? 'muted' : 'ink'}" style="margin:0 0 1rem;font-size:${size};line-height:1.5;color:${colour};">${escapeHtml(text)}</p>`;
}

/** A body paragraph whose HTML the caller built — and escaped — itself: a title in bold over a few lines, say. */
export function markup(html: string): string {
  return `<p class="nutria-ink" style="margin:0 0 1rem;font-size:1rem;line-height:1.5;color:${CLARO.ink};">${html}</p>`;
}

/** A link in the one solid accent that small text may wear; the address shown is the address followed. */
export function anchor(url: string, text: string = url): string {
  return `<a class="nutria-link" href="${escapeHtml(url)}" style="color:${CLARO.link};text-decoration:underline;">${escapeHtml(text)}</a>`;
}

/** An address on a line of its own, broken anywhere so a long one never runs off a narrow screen. */
export function linkLine(url: string): string {
  return `<p style="margin:0 0 1rem;font-size:0.875rem;line-height:1.5;word-break:break-all;">${anchor(url)}</p>`;
}

/**
 * "If the button does not work, copy this address": the flat note — a square-cornered block on
 * the card colour, no coloured edge — holding the sentence and the address it names.
 */
export function fallbackLink(sentence: string, url: string): string {
  return `<div class="nutria-note" style="margin:1.5rem 0 0;padding:0.875rem 1rem;background-color:${CLARO.note};border-radius:0;">
<p class="nutria-muted" style="margin:0 0 0.375rem;font-size:0.8125rem;line-height:1.5;color:${CLARO.muted};">${escapeHtml(sentence)}</p>
<p style="margin:0;font-size:0.8125rem;line-height:1.5;word-break:break-all;">${anchor(url)}</p>
</div>`;
}
