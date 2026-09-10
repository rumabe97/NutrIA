import { SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, shareImage } from '../_shared/ogImage';

/** The English card. One per language, because the tagline on it is copy and copy has a language. */
export const contentType = SHARE_IMAGE_TYPE;
export const size = SHARE_IMAGE_SIZE;

export default function OpenGraphImage() {
  return shareImage('en-GB');
}
