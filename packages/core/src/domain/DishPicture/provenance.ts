/**
 * Whether a picture's file still carries the marks Google signs it with
 * (`0066`): a C2PA manifest store in a JUMBF box, and the IPTC digital source
 * type `trainedAlgorithmicMedia` in its XMP. Both live in the JPEG's header
 * segments, and any re-encode — a resize, a format change, a strip — drops
 * them, which is why the file is stored untouched and this is checked before
 * it is.
 *
 * Presence only. Validating the signature needs the C2PA trust list and a
 * certificate chain; what is checked here is that nothing between the model and
 * the store threw the manifest away.
 */

export type PictureMarks = {
  /** An APP11 JUMBF superbox whose description box is labelled `c2pa`. */
  readonly c2pa: boolean;
  /** The file starts as a JPEG does. Nothing else is looked at otherwise. */
  readonly jpeg: boolean;
  /** XMP naming `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`. */
  readonly trainedAlgorithmicMedia: boolean;
};

const APP1 = 0xe1;
const APP11 = 0xeb;
/** Start of scan: the header segments are over, and the compressed image follows. */
const SOS = 0xda;
const EOI = 0xd9;

const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';
const TRAINED = 'digitalsourcetype/trainedAlgorithmicMedia';

/** The C2PA manifest store's label, and the start of its description box's type (`c2pa` + a fixed suffix). */
const C2PA_LABEL = 'c2pa';

/** Bytes as one character each, in slices: an XMP segment is up to 64 KB, too many arguments for one call. */
function ascii(bytes: Uint8Array, from: number, to: number): string {
  const parts: string[] = [];

  for (let at = from; at < Math.min(to, bytes.length); at += 4096) {
    parts.push(String.fromCharCode(...bytes.subarray(at, Math.min(at + 4096, to, bytes.length))));
  }

  return parts.join('');
}

/**
 * Whether one APP11 segment's payload is the first packet of a JUMBF box
 * holding a C2PA manifest store.
 *
 * The payload is ISO 19566-5's: `JP`, a two-byte instance, a four-byte packet
 * sequence number, then the box — `jumb`, whose first child is its `jumd`
 * description: a 16-byte type, a toggles byte and, when bit 1 of it is set, a
 * null-terminated label. C2PA's manifest store is labelled `c2pa`, and its type
 * begins with the same four letters.
 */
function isC2paPacket(payload: Uint8Array): boolean {
  if (payload.length < 8 + 8 + 8 + 17 || ascii(payload, 0, 2) !== 'JP') {
    return false;
  }

  const box = 8;

  if (ascii(payload, box + 4, box + 8) !== 'jumb' || ascii(payload, box + 12, box + 16) !== 'jumd') {
    return false;
  }

  const type = box + 16;
  const toggles = payload[type + 16] ?? 0;

  if (ascii(payload, type, type + 4) === C2PA_LABEL) {
    return true;
  }

  if ((toggles & 0b10) === 0) {
    return false;
  }

  const label = type + 17;
  const end = payload.indexOf(0, label);

  return end !== -1 && ascii(payload, label, end) === C2PA_LABEL;
}

/** Reads the header segments of a JPEG, and stops at the first thing that is not one. */
export function pictureMarks(bytes: Uint8Array): PictureMarks {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  let c2pa = false;
  let trainedAlgorithmicMedia = false;

  for (let at = 2; jpeg && at + 4 <= bytes.length;) {
    if (bytes[at] !== 0xff) {
      break;
    }

    const marker = bytes[at + 1] ?? 0;

    // Fill bytes before a marker.
    if (marker === 0xff) {
      at += 1;
      continue;
    }

    if (marker === SOS || marker === EOI) {
      break;
    }

    const length = ((bytes[at + 2] ?? 0) << 8) + (bytes[at + 3] ?? 0);
    const start = at + 4;
    const end = at + 2 + length;

    if (length < 2 || end > bytes.length) {
      break;
    }

    const payload = bytes.subarray(start, end);

    if (marker === APP11 && isC2paPacket(payload)) {
      c2pa = true;
    }

    if (marker === APP1 && ascii(payload, 0, XMP_HEADER.length) === XMP_HEADER && ascii(payload, 0, payload.length).includes(TRAINED)) {
      trainedAlgorithmicMedia = true;
    }

    at = end;
  }

  return { c2pa, jpeg, trainedAlgorithmicMedia };
}
