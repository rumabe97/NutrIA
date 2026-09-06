import { describe, expect, it } from 'vitest';

import { generateColors } from './generateColors';

const PALETTE = ['#f00', '#0f0', '#00f', '#ff0'];

describe('generateColors', () => {
  describe('shape', () => {
    it('returns an array of length `elements`', () => {
      expect(generateColors('Pablo', PALETTE, 5, 80)).toHaveLength(5);
      expect(generateColors('Pablo', PALETTE, 0, 80)).toHaveLength(0);
    });

    it('each entry exposes color, rotate, scale, translateX, translateY', () => {
      const [first] = generateColors('Pablo', PALETTE, 3, 80);
      expect(first).toEqual({
        color: expect.any(String) as string,
        rotate: expect.any(Number) as number,
        scale: expect.any(Number) as number,
        translateX: expect.any(Number) as number,
        translateY: expect.any(Number) as number
      });
    });
  });

  describe('determinism', () => {
    it('returns identical output for the same inputs', () => {
      const a = generateColors('Pablo', PALETTE, 4, 80);
      const b = generateColors('Pablo', PALETTE, 4, 80);
      expect(a).toEqual(b);
    });

    it('differs across distinct names', () => {
      const a = generateColors('Pablo', PALETTE, 4, 80);
      const b = generateColors('Anna', PALETTE, 4, 80);
      expect(a).not.toEqual(b);
    });
  });

  describe('color selection', () => {
    it('always picks colors from the supplied palette', () => {
      const result = generateColors('Pablo', PALETTE, 10, 80);

      for (const { color } of result) {
        expect(PALETTE).toContain(color);
      }
    });
  });

  describe('numeric ranges', () => {
    it('rotate stays in (-360, 360)', () => {
      const result = generateColors('Pablo', PALETTE, 20, 80);

      for (const { rotate } of result) {
        expect(rotate).toBeGreaterThan(-360);
        expect(rotate).toBeLessThan(360);
      }
    });

    it('translateX / translateY scale with size', () => {
      const result = generateColors('Pablo', PALETTE, 20, 100);

      for (const { translateX, translateY } of result) {
        expect(Math.abs(translateX)).toBeLessThan(10);
        expect(Math.abs(translateY)).toBeLessThan(10);
      }
    });
  });
});
