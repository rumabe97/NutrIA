import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pictureMarks } from 'core/domain/DishPicture';

/*
 * Two 8×8 JPEGs made for this test, not by a model: `marked.jpg` carries an
 * APP1 XMP packet naming `trainedAlgorithmicMedia` and an APP11 JUMBF box
 * labelled `c2pa`, laid out as Gemini's files lay them out; `reencoded.jpg`
 * is the same picture decoded and encoded again, which is what any resize or
 * format change does to a file.
 */
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(__dirname, '../../test/dish-picture', name)));
}

/** A JPEG made of the segments given, then the start of a scan. */
function jpeg(...segments: readonly (readonly [number, Uint8Array])[]): Uint8Array {
  const parts = segments.flatMap(([marker, payload]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload]);

  return new Uint8Array([0xff, 0xd8, ...parts, 0xff, 0xda, 0x00, 0x02]);
}

function text(value: string): Uint8Array {
  return new Uint8Array([...value].map(char => char.charCodeAt(0)));
}

function box(type: string, content: Uint8Array): Uint8Array {
  const size = content.length + 8;

  return new Uint8Array([size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...text(type), ...content]);
}

/** An APP11 packet: `JP`, instance, sequence number, then a `jumb` box whose `jumd` has this type, toggles and label. */
function jumbf(type: string, toggles: number, label: string | null): Uint8Array {
  const description = box('jumd', new Uint8Array([...text(type.padEnd(16, '\0')), toggles, ...(label === null ? [] : text(`${label}\0`))]));

  return new Uint8Array([...text('JP'), 0, 1, 0, 0, 0, 1, ...box('jumb', description)]);
}

const XMP = 'http://ns.adobe.com/xap/1.0/\0';

describe('pictureMarks', () => {
  it('finds the C2PA manifest and the IPTC source type in a file as the model signed it', () => {
    expect(pictureMarks(fixture('marked.jpg'))).toEqual({ c2pa: true, jpeg: true, trainedAlgorithmicMedia: true });
  });

  it('finds neither once the same picture has been re-encoded', () => {
    expect(pictureMarks(fixture('reencoded.jpg'))).toEqual({ c2pa: false, jpeg: true, trainedAlgorithmicMedia: false });
  });

  it('reads a JUMBF box by its label, and by a type that is C2PA’s when the label is absent', () => {
    expect(pictureMarks(jpeg([0xeb, jumbf('other', 0b11, 'c2pa')])).c2pa).toBe(true);
    expect(pictureMarks(jpeg([0xeb, jumbf('c2pa', 0b01, null)])).c2pa).toBe(true);
  });

  it('does not take another JUMBF box for a manifest', () => {
    expect(pictureMarks(jpeg([0xeb, jumbf('other', 0b11, 'jpegxt')])).c2pa).toBe(false);
    expect(pictureMarks(jpeg([0xeb, jumbf('other', 0b01, null)])).c2pa).toBe(false);
    expect(pictureMarks(jpeg([0xeb, jumbf('other', 0b11, 'c2pa-unterminated').slice(0, -1)])).c2pa).toBe(false);
  });

  it('does not take an APP11 segment that is not JUMBF, or not a box, for a manifest', () => {
    const notJumbf = jumbf('c2pa', 0b11, 'c2pa');
    notJumbf[0] = 0x58;
    const notABox = jumbf('c2pa', 0b11, 'c2pa');
    notABox[12] = 0x58;

    expect(pictureMarks(jpeg([0xeb, notJumbf])).c2pa).toBe(false);
    expect(pictureMarks(jpeg([0xeb, notABox])).c2pa).toBe(false);
    expect(pictureMarks(jpeg([0xeb, text('JP')])).c2pa).toBe(false);
  });

  it('reads the source type only from an XMP packet', () => {
    const iptc = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

    expect(pictureMarks(jpeg([0xe1, text(`${XMP}<x ${iptc}/>`)])).trainedAlgorithmicMedia).toBe(true);
    expect(pictureMarks(jpeg([0xe1, text(`Exif\0\0${iptc}`)])).trainedAlgorithmicMedia).toBe(false);
    expect(pictureMarks(jpeg([0xe1, text(`${XMP}<x digitalsourcetype/digitalCapture/>`)])).trainedAlgorithmicMedia).toBe(false);
  });

  it('reads an XMP packet longer than one slice of characters', () => {
    const long = `${XMP}${' '.repeat(20_000)}digitalsourcetype/trainedAlgorithmicMedia`;

    expect(pictureMarks(jpeg([0xe1, text(long)])).trainedAlgorithmicMedia).toBe(true);
  });

  it('stops at the start of the scan: a mark inside the image data is not a mark', () => {
    const afterScan = new Uint8Array([...jpeg(), 0xff, 0xeb, 0x00, 0x40, ...jumbf('c2pa', 0b11, 'c2pa')]);

    expect(pictureMarks(afterScan).c2pa).toBe(false);
  });

  it('steps over fill bytes, and stops at the end of the image or at a broken segment', () => {
    const marked = jpeg([0xeb, jumbf('c2pa', 0b11, 'c2pa')]);
    const filled = new Uint8Array([0xff, 0xd8, 0xff, ...marked.slice(2)]);
    const ended = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, ...marked.slice(2)]);
    const truncated = marked.slice(0, 30);
    const zeroLength = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, ...marked.slice(2)]);
    const notAMarker = new Uint8Array([0xff, 0xd8, 0x00, ...marked.slice(2)]);

    expect(pictureMarks(filled).c2pa).toBe(true);
    expect(pictureMarks(ended).c2pa).toBe(false);
    expect(pictureMarks(truncated).c2pa).toBe(false);
    expect(pictureMarks(zeroLength).c2pa).toBe(false);
    expect(pictureMarks(notAMarker).c2pa).toBe(false);
  });

  it('looks at nothing in a file that is not a JPEG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...jpeg([0xeb, jumbf('c2pa', 0b11, 'c2pa')])]);

    expect(pictureMarks(png)).toEqual({ c2pa: false, jpeg: false, trainedAlgorithmicMedia: false });
    expect(pictureMarks(new Uint8Array())).toEqual({ c2pa: false, jpeg: false, trainedAlgorithmicMedia: false });
  });
});
