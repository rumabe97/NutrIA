import styles from './TwoFactorQr.module.css';

import { encode } from 'uqr';

/** The quiet zone a scanner needs around the code, in modules. */
const BORDER = 4;

interface TwoFactorQrProps {
  /** The visible caption that says what the picture is for. Never the key itself: that is in text beside it. */
  labelledBy: string;
  /** The `otpauth://` address the authenticator adds. */
  uri: string;
}

/**
 * An authenticator's QR code, drawn as SVG in the page from `uqr`'s module grid —
 * no image request, nothing sent anywhere, and no string of markup injected. One path
 * for every dark module, so the picture is a single element however large the code.
 */
export function TwoFactorQr({ labelledBy, uri }: TwoFactorQrProps) {
  const { data, size } = encode(uri, { border: BORDER, ecc: 'M' });
  const path = data
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
    .filter(Boolean)
    .join('');

  return (
    <svg aria-labelledby={labelledBy} className={styles.qr} role="img" shapeRendering="crispEdges" viewBox={`0 0 ${size} ${size}`}>
      <rect className={styles.light} height={size} width={size} />
      <path className={styles.dark} d={path} />
    </svg>
  );
}
