/**
 * The one HTML frame every message the product sends is set in.
 *
 * Mail clients render a fraction of CSS and disagree about which fraction, so
 * everything is inline, the palette is two colours, and the layout is a single
 * centred column. A plain-text twin always travels alongside — some clients
 * show only that, and every client uses it for the preview line.
 */
const BRAND = 'NutrIA';
const ACCENT = '#5b7f3a';
const INK = '#1f2419';
const MUTED = '#6b7263';

export type EmailLocale = 'en-GB' | 'es-ES';

export interface RenderedEmail {
  html: string;
  subject: string;
  text: string;
}

/** Text placed inside HTML must not become HTML — a URL carries `&`, a name may carry `<`. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function layout({ body, locale, title }: { body: string; locale: EmailLocale; title: string }): string {
  const lang = locale.split('-')[0] ?? 'es';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
<div style="max-width:32rem;margin:0 auto;padding:2rem 1.25rem;">
<p style="margin:0 0 1.5rem;font-size:1.125rem;font-weight:600;color:${ACCENT};">${BRAND}</p>
${body}
<p style="margin:2rem 0 0;font-size:0.8125rem;color:${MUTED};">${BRAND}</p>
</div>
</body>
</html>`;
}

/** A button that is also a link, because that is the only kind mail clients agree on. */
export function button(url: string, label: string): string {
  return `<p style="margin:1.5rem 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:0.75rem 1.5rem;background:${ACCENT};color:#ffffff;text-decoration:none;border-radius:0.5rem;font-weight:500;">${escapeHtml(label)}</a></p>`;
}

export function paragraph(text: string, tone: 'body' | 'muted' = 'body'): string {
  const colour = tone === 'muted' ? MUTED : INK;
  const size = tone === 'muted' ? '0.875rem' : '1rem';

  return `<p style="margin:0 0 1rem;font-size:${size};line-height:1.5;color:${colour};">${escapeHtml(text)}</p>`;
}
