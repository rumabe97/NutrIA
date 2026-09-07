/**
 * Fills `{name}` placeholders in a dictionary string.
 *
 * A function rather than a template literal in the dictionary because the
 * dictionary crosses the server/client boundary: functions do not serialise,
 * strings do. An unknown placeholder is left as written rather than replaced
 * with "undefined" — a visible `{count}` in the interface is a bug report; the
 * word "undefined" is a mystery.
 */
export function interpolate(template: string, values: Readonly<Record<string, number | string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];

    return value === undefined ? match : String(value);
  });
}
