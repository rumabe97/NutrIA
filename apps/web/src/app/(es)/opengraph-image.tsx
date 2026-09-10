import { SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, shareImage } from '../_shared/ogImage';

/** The card every Spanish page shares as. Next attaches it to `og:image` for this whole tree. */
export const contentType = SHARE_IMAGE_TYPE;
export const size = SHARE_IMAGE_SIZE;

export default function OpenGraphImage() {
  return shareImage('es-ES');
}
