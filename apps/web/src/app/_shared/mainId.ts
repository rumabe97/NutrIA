/**
 * The id every `<main>` on the site carries.
 *
 * A module of its own because the two things that need it sit on opposite sides
 * of the server/client boundary: the skip link is rendered on the server and
 * reads the dictionary, the route announcer runs in the browser. Either one
 * importing the other would drag `next/headers` into a client bundle.
 *
 * Spanish, like every other route and anchor on this site — `#contenido` is a
 * URL fragment somebody may have saved, not copy.
 */
export const MAIN_ID = 'contenido';
