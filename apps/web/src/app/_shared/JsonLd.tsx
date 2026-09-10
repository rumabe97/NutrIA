/**
 * A block of structured data, as the one script tag a search engine reads it from.
 *
 * `<` is escaped rather than trusted: JSON inside a `<script>` ends at the first
 * `</script>` the parser sees, wherever it appears, so a stray one in a piece of
 * copy would close the tag early and spill the rest of the object onto the page.
 * Everything here comes from the dictionary today, which is exactly the kind of
 * "it is our own text, it is fine" that stops being true later.
 */
export function JsonLd({ data }: Readonly<{ data: object }>) {
  return <script dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} type="application/ld+json" />;
}
